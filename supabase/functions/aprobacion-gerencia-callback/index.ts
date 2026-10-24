import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// SYD Gestión -> SYD: avisa la decisión sobre el pago de una cuenta de cobro
// (pedido de Miguel, 2026-10-23). Lo manda la base de Gestión apenas la
// obligación sale de "pendiente de revisión":
//   - aprobado: Susana Sierra y después Miguel Díaz aprobaron el pago. La cuenta
//     pasa a "aprobado_total" y se envía a legalización, igual que antes lo
//     hacía la aprobación del Directivo en esta app.
//   - devuelto / rechazado: un Directivo la devolvió o rechazó en Gestión, con
//     motivo. El ingeniero la ve igual que una devolución de siempre.
//   - pagado: Tesorería registró en Gestión que el banco pagó toda la cuenta
//     (pedido de Miguel, 2026-10-23). La columna "Pago" queda en Pagado sola,
//     con la fecha del pago -- antes había que marcarla a mano.
// Solo cambia el estado de cuentas que están esperando esa decisión
// ("aprobado_contable"); si llega un aviso tarde o repetido, solo se anota.
//
// Llamada servidor-a-servidor: desplegar con "Verify JWT" apagado; la
// autenticación es x-webhook-secret = APROBACION_GERENCIA_CALLBACK_SECRET.

async function enviarALegalizacion(supabase: any, cuenta: any) {
  const soportes = Array.isArray(cuenta.soportes) ? cuenta.soportes : [];
  try {
    const resp = await fetch(Deno.env.get("LEGALIZACION_WEBHOOK_URL")!, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": Deno.env.get("LEGALIZACION_WEBHOOK_SECRET")! },
      body: JSON.stringify({
        referenciaExterna: String(cuenta.id),
        proyecto: cuenta.project,
        descripcionAnticipo: cuenta.cantidad ? `${cuenta.concepto} (${cuenta.cantidad} ${cuenta.unidad || ""})` : cuenta.concepto,
        valor: cuenta.valor_final_pagar ?? cuenta.valor,
        proveedorTercero: cuenta.proveedor,
        centroCosto: cuenta.project,
        responsable: cuenta.autor,
        estadoPago: "No pagado",
        tipoCuentaPago: "",
        fechaCausado: (cuenta.created_at || new Date().toISOString()).slice(0, 10),
        documentoSoporteLibroContable: soportes.map((s: any) => s.url).join("\n") || cuenta.link_soporte || "",
        notas: cuenta.observaciones || "",
      }),
    });
    if (!resp.ok) {
      const texto = await resp.text();
      await supabase.from("cuentas_cobro").update({ legalizacion_estado: "error", legalizacion_error: `HTTP ${resp.status}: ${texto.slice(0, 500)}` }).eq("id", cuenta.id);
      return;
    }
    await supabase.from("cuentas_cobro").update({ legalizacion_estado: "enviado", legalizacion_error: null }).eq("id", cuenta.id);
  } catch (e) {
    await supabase.from("cuentas_cobro").update({ legalizacion_estado: "error", legalizacion_error: String(e).slice(0, 500) }).eq("id", cuenta.id);
  }
}

Deno.serve(async (req) => {
  try {
    if (req.headers.get("x-webhook-secret") !== Deno.env.get("APROBACION_GERENCIA_CALLBACK_SECRET")) {
      return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), { status: 401 });
    }
    const { referenciaExterna, decision, motivo, fechaPago } = await req.json();
    if (!referenciaExterna || !["aprobado", "devuelto", "rechazado", "pagado"].includes(decision)) {
      return new Response(JSON.stringify({ ok: false, error: "Falta referenciaExterna o decision inválida" }), { status: 400 });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const cuentaId = Number(referenciaExterna);
    const { data: cuenta } = await supabase.from("cuentas_cobro").select("*").eq("id", cuentaId).single();
    if (!cuenta) {
      return new Response(JSON.stringify({ ok: false, error: `No existe la cuenta de cobro ${referenciaExterna}` }), { status: 404 });
    }

    const ahora = new Date().toISOString();

    if (decision === "pagado") {
      if (cuenta.pago_realizado) {
        return new Response(JSON.stringify({ ok: true, nota: "Ya estaba marcada como pagada." }), { status: 200 });
      }
      // "Marcado como pagado" es la acción que lee la columna Pago para
      // mostrar la fecha. fechaPago llega como día (AAAA-MM-DD): mediodía de
      // Colombia para que no se corra un día al mostrarla.
      const fecha = fechaPago ? `${fechaPago}T17:00:00.000Z` : ahora;
      const historialPago = [...(cuenta.historial || []), { accion: "Marcado como pagado", detalle: "Pago registrado por Tesorería en SYD Gestión", por: "Tesorería (SYD Gestión)", fecha }];
      await supabase.from("cuentas_cobro").update({ pago_realizado: true, historial: historialPago }).eq("id", cuentaId);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const por = "Gerencia (SYD Gestión)";
    const etiqueta = decision === "aprobado" ? "Aprobado por Gerencia (Susana Sierra -> Miguel Díaz)"
      : decision === "devuelto" ? "Devuelto en Tesorería (SYD Gestión)" : "Rechazado en Tesorería (SYD Gestión)";
    const historial = [...(cuenta.historial || []), { accion: etiqueta, detalle: motivo || null, por, fecha: ahora }];

    if (cuenta.estado !== "aprobado_contable") {
      // Aviso tardío o repetido: no cambia el estado, solo queda anotado.
      await supabase.from("cuentas_cobro").update({ historial }).eq("id", cuentaId);
      return new Response(JSON.stringify({ ok: true, nota: `La cuenta estaba en ${cuenta.estado}; solo se anotó el aviso.` }), { status: 200 });
    }

    if (decision === "aprobado") {
      await supabase.from("cuentas_cobro").update({
        estado: "aprobado_total", condicion: null, motivo_rechazo: null,
        revisado_por: por, revisado_at: ahora, historial,
      }).eq("id", cuentaId);
      await enviarALegalizacion(supabase, { ...cuenta, estado: "aprobado_total" });
    } else if (decision === "devuelto") {
      await supabase.from("cuentas_cobro").update({
        estado: "devuelto", condicion: motivo || "Devuelto en Tesorería", revisado_por: por, revisado_at: ahora, historial,
      }).eq("id", cuentaId);
    } else {
      await supabase.from("cuentas_cobro").update({
        estado: "rechazado", motivo_rechazo: motivo || "Rechazado en Tesorería", revisado_por: por, revisado_at: ahora, historial,
      }).eq("id", cuentaId);
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200 });
  }
});
