import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/pin.ts";
import { enviarACuentasPorPagar, cadenaAprobadores } from "../_shared/cxp.ts";

// Firma de Gerencia en SYD Técnica (pedido de Miguel, 2026-10-30). Después de
// Contabilidad firman en orden los aprobadores del proyecto (tabla
// aprobadores_gerencia: Susana -> Miguel; en Icon Park Carmen -> Susana ->
// Miguel). Con la última firma la cuenta se manda a Cuentas por Pagar de
// SYD Gestión. Cualquiera de la cadena, en su turno, puede devolver o rechazar.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const comoUsuario = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await comoUsuario.auth.getUser();
    if (!user) return json({ ok: false, error: "No autenticado" }, 401);

    const { cuentaId, decision, motivo } = await req.json();
    if (!cuentaId || !["aprobar", "devolver", "rechazar"].includes(decision)) return json({ ok: false, error: "Datos inválidos" }, 400);
    if (decision !== "aprobar" && !String(motivo || "").trim()) return json({ ok: false, error: "Falta el motivo" }, 400);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: perfil }, { data: cuenta }] = await Promise.all([
      db.from("profiles").select("nombre, activo").eq("id", user.id).single(),
      db.from("cuentas_cobro").select("*").eq("id", cuentaId).single(),
    ]);
    if (!perfil?.activo) return json({ ok: false, error: "No autorizado" }, 403);
    if (!cuenta) return json({ ok: false, error: "Cuenta no encontrada" }, 404);
    if (cuenta.estado !== "aprobado_contable" || cuenta.aprobacion_cxp_estado === "enviado") {
      return json({ ok: false, error: "La cuenta no está esperando la firma de Gerencia en SYD Técnica" }, 400);
    }

    const cadena = await cadenaAprobadores(db, cuenta.project);
    const firmas = Array.isArray(cuenta.aprobaciones_gerencia) ? cuenta.aprobaciones_gerencia : [];
    if (firmas.length >= cadena.length) return json({ ok: false, error: "Ya tiene todas las firmas; usa 'Enviar a Gerencia' para reenviarla" }, 400);
    if (cadena[firmas.length] !== user.id) return json({ ok: false, error: "No es tu turno de firmar esta cuenta" }, 403);

    const ahora = new Date().toISOString();
    if (decision === "aprobar") {
      const nuevas = [...firmas, { profile_id: user.id, nombre: perfil.nombre, fecha: ahora }];
      const completa = nuevas.length === cadena.length;
      const historial = [...(cuenta.historial || []), {
        accion: `Aprobado por Gerencia en SYD Técnica (${nuevas.length}/${cadena.length})`, por: perfil.nombre, fecha: ahora,
      }];
      await db.from("cuentas_cobro").update({ aprobaciones_gerencia: nuevas, historial }).eq("id", cuentaId);
      if (!completa) return json({ ok: true, completa: false });
      const envio = await enviarACuentasPorPagar(db, { ...cuenta, aprobaciones_gerencia: nuevas });
      if (envio.ok) {
        await db.from("cuentas_cobro").update({
          historial: [...historial, { accion: "Enviado a Cuentas por Pagar de SYD Gestión", por: perfil.nombre, fecha: new Date().toISOString() }],
        }).eq("id", cuentaId);
      }
      return json({ ok: true, completa: true, enviada: envio.ok, error: envio.error });
    }

    const devuelto = decision === "devolver";
    const historial = [...(cuenta.historial || []), {
      accion: devuelto ? "Devuelto por Gerencia (SYD Técnica)" : "Rechazado por Gerencia (SYD Técnica)", detalle: String(motivo).trim(), por: perfil.nombre, fecha: ahora,
    }];
    await db.from("cuentas_cobro").update({
      estado: devuelto ? "devuelto" : "rechazado",
      condicion: devuelto ? String(motivo).trim() : null,
      motivo_rechazo: devuelto ? null : String(motivo).trim(),
      revisado_por: perfil.nombre, revisado_at: ahora,
      aprobaciones_gerencia: [], aprobacion_cxp_estado: null, historial,
    }).eq("id", cuentaId);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
