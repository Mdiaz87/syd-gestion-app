import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Reenvía a Cuentas por Pagar de SYD Gestión (aprobación de Susana Sierra ->
// Miguel Díaz) una cuenta de cobro ya aprobada por Contabilidad. Normalmente
// eso lo hace solo revision-contable-callback; esta función es para un
// Directivo cuando ese envío falló, y para las cuentas que estaban esperando
// la aprobación del Directivo en SYD Técnica cuando se quitó ese paso
// (2026-10-23). La llama el navegador con la sesión del Directivo.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const responder = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: corsHeaders });

// Mismo mapa que revision-contable-callback.
const RESPONSABLES_CONTABLES: Record<string, { auxiliar: string; correo: string }> = {
  "Aqqua 4": { auxiliar: "Ismael Miranda Almeida", correo: "analistacontable2@sydinversiones.com" },
  "Citrino": { auxiliar: "Ismael Miranda Almeida", correo: "auxcontable5@sydinversiones.com" },
  "Aqqua Club": { auxiliar: "Luis Carlos Alcalá Torres", correo: "auxcontable2@sydinversiones.com" },
  "Itai Equipos": { auxiliar: "Maria Alejandra Lara", correo: "auxcontable2@sydinversiones.com" },
  "Vivante Parque Residencial": { auxiliar: "Maria Jose Meza", correo: "analistacontable1@sydinversiones.com" },
  "Atalí Conjunto Campestre": { auxiliar: "Maria Jose Meza", correo: "analistacontable1@sydinversiones.com" },
  "Vivante Norte": { auxiliar: "Maria Jose Meza", correo: "analistacontable1@sydinversiones.com" },
  "SYD Inversiones": { auxiliar: "Maria Jose Meza", correo: "analistacontable1@sydinversiones.com" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { cuentaId } = await req.json();
    if (!cuentaId) return responder({ ok: false, error: "Falta cuentaId" }, 400);

    const comoUsuario = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await comoUsuario.auth.getUser();
    if (!user) return responder({ ok: false, error: "No autenticado" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: perfil } = await supabase.from("profiles").select("rol, activo, nombre").eq("id", user.id).single();
    if (!perfil?.activo || perfil.rol !== "Directivo") return responder({ ok: false, error: "Solo un Directivo puede reenviar" }, 403);

    const { data: cuenta } = await supabase.from("cuentas_cobro").select("*").eq("id", cuentaId).single();
    if (!cuenta) return responder({ ok: false, error: "Cuenta no encontrada" }, 404);
    if (cuenta.estado !== "aprobado_contable") return responder({ ok: false, error: "La cuenta no está aprobada por Contabilidad" }, 400);

    const responsable = RESPONSABLES_CONTABLES[cuenta.project] || null;
    const resp = await fetch(Deno.env.get("APROBACION_CXP_WEBHOOK_URL")!, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": Deno.env.get("APROBACION_CXP_WEBHOOK_SECRET")! },
      body: JSON.stringify({
        referenciaExterna: String(cuenta.id),
        centroCosto: cuenta.centro_costo || cuenta.project,
        empresa: cuenta.empresa || null,
        categoria: cuenta.categoria || null,
        subcategoria: cuenta.subcategoria || null,
        concepto: cuenta.concepto,
        valor: cuenta.valor_final_pagar ?? cuenta.valor,
        proveedorTercero: cuenta.proveedor,
        auxiliarContable: responsable?.auxiliar || null,
        correoRevisor: responsable?.correo || null,
        soportes: Array.isArray(cuenta.soportes) ? cuenta.soportes : [],
      }),
    });
    if (!resp.ok) {
      const texto = await resp.text();
      await supabase.from("cuentas_cobro").update({ aprobacion_cxp_estado: "error", aprobacion_cxp_error: `HTTP ${resp.status}: ${texto.slice(0, 500)}` }).eq("id", cuentaId);
      return responder({ ok: false, error: texto });
    }
    const historial = [...(cuenta.historial || []), { accion: "Enviado a aprobación de Gerencia (Susana Sierra -> Miguel Díaz)", por: perfil.nombre, fecha: new Date().toISOString() }];
    await supabase.from("cuentas_cobro").update({ aprobacion_cxp_estado: "enviado", aprobacion_cxp_error: null, historial }).eq("id", cuentaId);
    return responder({ ok: true });
  } catch (e) {
    return responder({ ok: false, error: String(e) });
  }
});
