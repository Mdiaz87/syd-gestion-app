import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const body = await req.json();
    const { cuentaId } = body;
    // facturas: [{nombre, url}] (varios archivos). facturaUrl: forma vieja, un solo archivo.
    const facturas = (Array.isArray(body.facturas) ? body.facturas : body.facturaUrl ? [{ nombre: "Factura", url: body.facturaUrl }] : [])
      .filter((f: { url?: string }) => f?.url)
      .map((f: { nombre?: string; url: string }) => ({ nombre: String(f.nombre || "Factura"), url: String(f.url) }));
    if (!cuentaId || !facturas.length) {
      return new Response(JSON.stringify({ ok: false, error: "Falta cuentaId o facturas" }), { status: 400, headers: corsHeaders });
    }
    const facturaUrl = facturas[0].url;

    // Cliente con la sesión del que llama, solo para verificar permisos (RLS normal).
    const supabaseComoUsuario = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseComoUsuario.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: "No autenticado" }), { status: 401, headers: corsHeaders });
    }

    const { data: cuenta, error } = await supabaseComoUsuario
      .from("cuentas_cobro")
      .select("*")
      .eq("id", cuentaId)
      .single();

    if (error || !cuenta) {
      return new Response(JSON.stringify({ ok: false, error: "Cuenta no encontrada" }), { status: 404, headers: corsHeaders });
    }

    const { data: perfil } = await supabaseComoUsuario
      .from("profiles")
      .select("rol")
      .eq("id", user.id)
      .single();
    const esAutor = cuenta.autor_id === user.id;
    const esDirectivo = perfil?.rol === "Directivo";
    if (!esAutor && !esDirectivo) {
      return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), { status: 403, headers: corsHeaders });
    }
    if (cuenta.estado !== "aprobado_total") {
      return new Response(JSON.stringify({ ok: false, error: "La cuenta no está aprobada todavía" }), { status: 400, headers: corsHeaders });
    }

    // De aquí en adelante, escritura con llave de servicio: una cuenta
    // aprobada está bloqueada para el autor por RLS (a propósito), pero
    // ya validamos arriba que quien llama tiene permiso para esta acción
    // puntual, así que usamos la llave de servicio solo para los campos
    // de factura de legalización.
    const supabaseServicio = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabaseServicio.from("cuentas_cobro").update({
      factura_legalizacion_url: facturaUrl,
      factura_legalizacion_urls: facturas,
    }).eq("id", cuentaId);

    const resp = await fetch(Deno.env.get("LEGALIZACION_UPDATE_WEBHOOK_URL")!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": Deno.env.get("LEGALIZACION_WEBHOOK_SECRET")!,
      },
      body: JSON.stringify({
        referenciaExterna: String(cuentaId),
        facturaLegalizacionUrl: facturaUrl,
        // Todos los archivos; facturaLegalizacionUrl sigue siendo el primero.
        facturasLegalizacion: facturas,
      }),
    });

    if (!resp.ok) {
      const texto = await resp.text();
      await supabaseServicio.from("cuentas_cobro").update({
        factura_legalizacion_estado: "error",
        factura_legalizacion_error: `HTTP ${resp.status}: ${texto.slice(0, 500)}`,
      }).eq("id", cuentaId);
      return new Response(JSON.stringify({ ok: false, error: texto }), { status: 200, headers: corsHeaders });
    }

    await supabaseServicio.from("cuentas_cobro").update({
      factura_legalizacion_estado: "enviado",
      factura_legalizacion_error: null,
    }).eq("id", cuentaId);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200, headers: corsHeaders });
  }
});