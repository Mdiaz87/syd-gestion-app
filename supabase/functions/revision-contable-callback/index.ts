import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// App administrativa (SYD Gestión) -> SYD: la llama Contabilidad cuando
// aprueba o devuelve una cuenta en SU pantalla. Llamada servidor-a-servidor
// (no viene de un navegador), así que no necesita CORS.
//
// Desde 2026-10-30 (pedido de Miguel): cuando Contabilidad aprueba, la cuenta
// queda en "aprobado_contable" esperando las firmas de Gerencia en SYD Técnica
// (aprobar-gerencia-tecnica: Susana -> Miguel; Icon Park: Carmen -> Susana ->
// Miguel). Con la última firma se manda a Cuentas por Pagar de SYD Gestión,
// donde vuelven a aprobar; Gestión avisa la decisión (aprobacion-gerencia-callback).

Deno.serve(async (req) => {
  try {
    const secret = req.headers.get("x-webhook-secret");
    if (secret !== Deno.env.get("REVISION_CONTABLE_CALLBACK_SECRET")) {
      return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), { status: 401 });
    }

    const { referenciaExterna, decision, motivo, revisorNombre, retencion, valorFinalPagar } = await req.json();
    if (!referenciaExterna || !["aprobado", "devuelto"].includes(decision)) {
      return new Response(JSON.stringify({ ok: false, error: "Falta referenciaExterna o decision inválida" }), { status: 400 });
    }
    if (decision === "devuelto" && !motivo) {
      return new Response(JSON.stringify({ ok: false, error: "Falta motivo para la devolución" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const cuentaId = Number(referenciaExterna);
    const { data: cuenta, error } = await supabase
      .from("cuentas_cobro")
      .select("historial")
      .eq("id", cuentaId)
      .single();

    if (error || !cuenta) {
      return new Response(JSON.stringify({ ok: false, error: `No se encontró ninguna cuenta de cobro con id "${referenciaExterna}".` }), { status: 404 });
    }

    const por = revisorNombre || "Contabilidad";
    const nuevoEstado = decision === "aprobado" ? "aprobado_contable" : "devuelto";
    const accion = decision === "aprobado" ? "Aprobado por Contabilidad -- pendiente de firma de Gerencia en SYD Técnica" : "Devuelto por Contabilidad";
    const detalleHistorial = decision === "devuelto"
      ? motivo
      : (valorFinalPagar != null ? `Valor final a pagar: ${valorFinalPagar}${retencion ? ` (retención: ${retencion})` : ""}` : null);
    const historial = [...(cuenta.historial || []), { accion, detalle: detalleHistorial, por, fecha: new Date().toISOString() }];

    const update: Record<string, unknown> = {
      estado: nuevoEstado,
      condicion: decision === "devuelto" ? motivo : null,
      historial,
    };
    if (decision === "aprobado") {
      update.retencion = retencion ?? 0;
      update.valor_final_pagar = valorFinalPagar ?? null;
    }
    // Cada paso por Contabilidad reinicia las firmas de Gerencia.
    update.aprobaciones_gerencia = [];
    update.aprobacion_cxp_estado = null;
    update.aprobacion_cxp_error = null;

    await supabase.from("cuentas_cobro").update(update).eq("id", cuentaId);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200 });
  }
});
