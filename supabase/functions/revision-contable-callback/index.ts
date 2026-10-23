import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// App administrativa (SYD Gestión) -> SYD: la llama Contabilidad cuando
// aprueba o devuelve una cuenta en SU pantalla. Llamada servidor-a-servidor
// (no viene de un navegador), así que no necesita CORS.
//
// Desde 2026-10-23 (pedido de Miguel) ya no hay aprobación del Directivo en
// SYD Técnica: apenas Contabilidad aprueba, la cuenta se envía sola a Cuentas
// por Pagar de SYD Gestión, donde la aprueban Susana Sierra y después Miguel
// Díaz. La cuenta queda en "aprobado_contable" (en aprobación de Gerencia)
// hasta que Gestión avise la decisión (aprobacion-gerencia-callback).

// Mismo mapa que usaba aprobacion-cuenta-cobro.
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

// Crea (o actualiza, si sigue pendiente) la obligación en Cuentas por Pagar
// de Gestión. Gestión le arma el comité Susana -> Miguel automáticamente.
async function enviarACuentasPorPagar(supabase: any, cuentaId: number): Promise<boolean> {
  const { data: cuenta } = await supabase.from("cuentas_cobro").select("*").eq("id", cuentaId).single();
  if (!cuenta) return false;
  const responsableContable = RESPONSABLES_CONTABLES[cuenta.project] || null;
  try {
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
        auxiliarContable: responsableContable?.auxiliar || null,
        correoRevisor: responsableContable?.correo || null,
        soportes: Array.isArray(cuenta.soportes) ? cuenta.soportes : [],
      }),
    });
    if (!resp.ok) {
      const texto = await resp.text();
      await supabase.from("cuentas_cobro").update({ aprobacion_cxp_estado: "error", aprobacion_cxp_error: `HTTP ${resp.status}: ${texto.slice(0, 500)}` }).eq("id", cuentaId);
      return false;
    }
    await supabase.from("cuentas_cobro").update({ aprobacion_cxp_estado: "enviado", aprobacion_cxp_error: null }).eq("id", cuentaId);
    return true;
  } catch (e) {
    await supabase.from("cuentas_cobro").update({ aprobacion_cxp_estado: "error", aprobacion_cxp_error: String(e).slice(0, 500) }).eq("id", cuentaId);
    return false;
  }
}

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
    const accion = decision === "aprobado" ? "Aprobado por Contabilidad -- enviado a aprobación de Gerencia (Susana Sierra -> Miguel Díaz)" : "Devuelto por Contabilidad";
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

    await supabase.from("cuentas_cobro").update(update).eq("id", cuentaId);

    // Si falla, la cuenta queda con aprobacion_cxp_estado = 'error' y un
    // Directivo la reenvía desde SYD Técnica (enviar-a-gerencia). La decisión
    // de Contabilidad ya quedó guardada igual.
    const enviada = decision === "aprobado" ? await enviarACuentasPorPagar(supabase, cuentaId) : null;

    return new Response(JSON.stringify({ ok: true, enviadaAGerencia: enviada }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200 });
  }
});
