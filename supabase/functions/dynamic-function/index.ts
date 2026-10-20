import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// SYD Recaudo y Cartera -> SYD Técnica: avisa cuando una legalización queda
// "por_vencer" o "bloqueada" por vencimiento del plazo (27 días desde
// fecha_causado). Llamada servidor-a-servidor (no viene de un navegador),
// por eso no necesita CORS. Mismo patrón que revision-contable-callback.
//
// Se desplegó desde el Dashboard con el nombre "dynamic-function"; se deja
// así para no romper la URL que llama cron-legalizaciones.
Deno.serve(async (req) => {
  try {
    const secret = req.headers.get("x-webhook-secret");
    if (secret !== Deno.env.get("LEGALIZACION_BLOQUEO_CALLBACK_SECRET")) {
      return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), { status: 401 });
    }

    const {
      evento,
      legalizacionId,
      referenciaExterna,
      proyecto,
      lote,
      cuentaCobroId,
      ingenieroEmail,
      fechaLimite,
      diasRestantes,
      estado,
      monto,
    } = await req.json();

    if (!legalizacionId || !["bloqueada", "por_vencer"].includes(evento)) {
      return new Response(JSON.stringify({ ok: false, error: "Falta legalizacionId o evento inválido" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // referenciaExterna = cuentas_cobro.id de esta app; es lo que usa la UI
    // para saber a qué cuenta (y a qué ingeniero) corresponde el aviso.
    const referencia = referenciaExterna ?? cuentaCobroId ?? null;

    const { error } = await supabase
      .from("legalizaciones_alertas_externas")
      .upsert(
        {
          legalizacion_id: legalizacionId,
          evento,
          referencia_externa: referencia != null ? String(referencia) : null,
          proyecto: proyecto ?? null,
          lote: lote ?? null,
          cuenta_cobro_id: referencia != null ? String(referencia) : null,
          ingeniero_email: ingenieroEmail ?? null,
          fecha_limite: fechaLimite ?? null,
          dias_restantes: diasRestantes ?? null,
          estado: estado ?? null,
          monto: monto ?? null,
          recibido_en: new Date().toISOString(),
        },
        { onConflict: "legalizacion_id,evento" },
      );

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
