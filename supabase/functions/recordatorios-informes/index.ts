import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { alertasPlanes, hoyColombia } from "../_shared/plan-semanal.js";
import { controlPresupuesto, alertasPresupuesto, codigos, hojas } from "../_shared/control-presupuesto.js";

// Recordatorios por correo de informes vencidos. La llama pg_cron cada 2 días
// a las 7 a.m. (Colombia) con x-cron-secret. Se despliega con --no-verify-jwt.
// Con ?dry=1 no envía nada: devuelve lo que mandaría (para probar).
//
// Las reglas son las mismas de src/lib/recordatorios.js (Dashboard); si
// cambian allá, cambiarlas aquí también.
// - Coordinador: semana (lunes) vence el lunes siguiente 12 m; la semana se
//   toma de las fechas de los días del informe.
// - Ingeniero: mes anterior, del 1 al 5; ing_mensual_desde = primer mes exigido.
// - Plan semanal: lunes (martes si es festivo); ver _shared/plan-semanal.js.
// - Presupuestos vigentes: sobrecosto, pagado más de lo construido, atraso y
//   cuentas aprobadas sin actividad; ver _shared/control-presupuesto.js.
//
// El correo sale por el Apps Script de SYD (tipoAlerta recordatorio_informes),
// autenticado con GAS_RECORDATORIOS_SECRET.

const TZ_OFFSET_HORAS = -5; // Colombia, sin horario de verano
const HORA_VENCE_SEMANAL = 12;
const DIA_GRACIA_MENSUAL = 5;
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Fechas en "hora de Colombia" representadas como UTC (getUTC*).
const ahoraColombia = () => new Date(Date.now() + TZ_OFFSET_HORAS * 3600_000);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const deIso = (s: string) => new Date(`${s}T00:00:00Z`);
const sumarDias = (s: string, n: number) => { const d = deIso(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const lunesDe = (s: string) => { const d = deIso(s); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return iso(d); };
const corta = (s: string) => { const d = deIso(s); return `${d.getUTCDate()} ${MESES_CORTOS[d.getUTCMonth()]}`; };
const etiquetaSemana = (lunes: string) => `${corta(lunes)} – ${corta(sumarDias(lunes, 6))}`;

type Report = { role?: string; project?: string; type?: string; mes?: string; estado?: string; semana?: string; author?: string; coordinadorId?: string; date?: string; days?: { date?: string }[]; history?: { uid?: string }[] };
type Obligacion = { project: string; coord_semanal: boolean; ing_mensual: boolean; ing_mensual_desde: string | null; coord_semanal_desde?: string | null; coord_responsable: string | null; ing_responsable: string | null };
type Pendiente = { project: string; tipo: "coord" | "ing" | "plan"; detalle: string; responsableId: string | null };

const coincideMes = (texto: string | undefined, anio: number, mes: number) => {
  if (!texto) return false;
  const [nombre, a] = texto.trim().toLowerCase().split(/\s+/);
  if (nombre !== MESES[mes].toLowerCase()) return false;
  const n = parseInt(a, 10);
  return Number.isFinite(n) ? n === anio : true;
};

const autorDe = (r: Report) => r.coordinadorId || r.history?.[0]?.uid || null;

function calcularPendientes(reports: Report[], obligaciones: Obligacion[]): Pendiente[] {
  const ahora = ahoraColombia();
  const hoy = iso(ahora);
  const lunesActual = lunesDe(hoy);
  const yaVencio = ahora.getUTCDay() !== 1 || ahora.getUTCHours() >= HORA_VENCE_SEMANAL;
  const semana = sumarDias(lunesActual, yaVencio ? -7 : -14);
  const atras = ahora.getUTCDate() > DIA_GRACIA_MENSUAL ? 1 : 2;
  const objetivo = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - atras, 1));
  const anio = objetivo.getUTCFullYear(), mes = objetivo.getUTCMonth();
  const claveMes = `${anio}-${String(mes + 1).padStart(2, "0")}`;

  const ultimoAutor = (rol: string, project: string) => {
    const delRol = reports.filter(r => r.role === rol && r.project === project && autorDe(r))
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    return delRol.length ? autorDe(delRol[0]) : null;
  };

  const res: Pendiente[] = [];
  for (const o of obligaciones) {
    if (o.coord_semanal && (!o.coord_semanal_desde || semana >= o.coord_semanal_desde)) {
      const del = reports.filter(r => r.role === "Coordinador" && r.project === o.project);
      const semanasDe = (r: Report) => new Set((r.days || []).filter(d => d.date).map(d => lunesDe(d.date!)));
      const enviado = del.some(r => r.estado === "enviado" && (semanasDe(r).has(semana) || (r.semana === semana && !semanasDe(r).size)));
      if (!enviado) res.push({ project: o.project, tipo: "coord", detalle: `informe semanal de Coordinador, semana ${etiquetaSemana(semana)}`, responsableId: o.coord_responsable || ultimoAutor("Coordinador", o.project) });
    }
    if (o.ing_mensual && (!o.ing_mensual_desde || claveMes >= o.ing_mensual_desde)) {
      const enviado = reports.some(r => r.role === "Ingeniero" && r.project === o.project && r.type === "mensual" && coincideMes(r.mes, anio, mes));
      if (!enviado) res.push({ project: o.project, tipo: "ing", detalle: `informe mensual de Ingeniero de ${MESES[mes]} ${anio}`, responsableId: o.ing_responsable || ultimoAutor("Ingeniero", o.project) });
    }
  }
  return res;
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const APP_URL = "https://sydinversionestecnica.netlify.app/";
const lista = (items: string[]) => `<ul>${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`;

Deno.serve(async (req) => {
  try {
    if (req.headers.get("x-cron-secret") !== Deno.env.get("RECORDATORIOS_CRON_SECRET")) {
      return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), { status: 401 });
    }
    const dry = new URL(req.url).searchParams.get("dry") === "1";
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [{ data: filas }, { data: obligaciones }, { data: perfiles }, { data: contactos }, { data: planes }] = await Promise.all([
      db.from("reports").select("data"),
      db.from("obligaciones_informes").select("*"),
      db.from("profiles").select("id,nombre,rol,activo,email_notificaciones,proyecto_asignado"),
      db.from("contactos_notificacion").select("profile_id,email"),
      db.from("planes_semanales").select("*").gte("semana", sumarDias(iso(ahoraColombia()), -21)),
    ]);
    const reports = (filas || []).map((f: { data: Report }) => f.data);
    const pendientes = calcularPendientes(reports, (obligaciones || []) as Obligacion[]);

    // Plan semanal: si no se envió, o si la semana pasada no se completó y falta explicar por qué.
    const lineasPlan: string[] = [];
    for (const a of alertasPlanes(planes || [], reports, obligaciones || [], null, hoyColombia())) {
      if (a.entrega.estado === "vencido") {
        pendientes.push({ project: a.project, tipo: "plan", detalle: `plan semanal de actividades, semana ${etiquetaSemana(a.semana)}`, responsableId: a.responsableId });
      }
      const pre = a.cotejoPrevio;
      if (pre && (pre.incumplidas || pre.parciales)) {
        // deno-lint-ignore no-explicit-any
        const faltas = pre.filas.filter((f: any) => f.estado === "incumplida" || f.estado === "parcial");
        // deno-lint-ignore no-explicit-any
        const sinMotivo = faltas.filter((f: any) => !f.motivo);
        if (sinMotivo.length) {
          // deno-lint-ignore no-explicit-any
          pendientes.push({ project: a.project, tipo: "plan", detalle: `explicar en Plan semanal por qué no se completó, semana ${etiquetaSemana(a.anterior)}: ${sinMotivo.map((f: any) => f.actividad).join(", ")}`, responsableId: a.responsableId });
        }
        // deno-lint-ignore no-explicit-any
        const detalle = faltas.map((f: any) => `${f.actividad}${f.pct != null ? ` (${f.pct}%)` : ""}${f.motivo ? `: ${f.motivo}` : ""}`).join("; ");
        lineasPlan.push(`${a.project}, semana ${etiquetaSemana(a.anterior)}: ${pre.cumplidas} de ${pre.total} cumplidas. No se completó: ${detalle}.${pre.causas.length ? ` Registros: ${pre.causas.join(", ")}.` : ""}`);
      }
    }

    // Presupuestos vigentes: alertas para el resumen de Directivos y, lo que
    // le toca hacer al ingeniero (registrar avance, cargar cuentas), a él.
    const lineasPresupuesto: string[] = [];
    const { data: vigentes } = await db.from("presupuestos").select("*").eq("estado", "vigente");
    if (vigentes?.length) {
      const projs = [...new Set(vigentes.map((v: { project: string }) => v.project))];
      const [{ data: parts }, { data: manuales }, { data: avances }, { data: cuentas }] = await Promise.all([
        db.from("partidas").select("*").in("presupuesto_id", vigentes.map((v: { id: string }) => v.id)).order("orden"),
        db.from("ejecucion_manual").select("*").in("project", projs),
        db.from("avance_fisico").select("*").in("project", projs),
        db.from("cuentas_cobro").select("id,project,estado,pago_realizado,valor,valor_final_pagar,partida_linaje,historial,revisado_at,created_at").in("project", projs),
      ]);
      const hoy = hoyColombia();
      // deno-lint-ignore no-explicit-any
      const deProyecto = (xs: any[] | null, proj: string) => (xs || []).filter((x: any) => x.project === proj);
      for (const proj of projs) {
        // deno-lint-ignore no-explicit-any
        const delProyecto = vigentes.filter((v: any) => v.project === proj);
        const linajes = new Set<string>();
        let atrasadas = 0, brechas = 0;
        for (const pres of delProyecto) {
          // deno-lint-ignore no-explicit-any
          const ps = (parts || []).filter((x: any) => x.presupuesto_id === pres.id);
          hojas(ps).forEach((h: { linaje: string }) => linajes.add(h.linaje));
          const ctrl = controlPresupuesto(pres, ps, deProyecto(cuentas, proj), deProyecto(manuales, proj), hoy, { avances: deProyecto(avances, proj), reports });
          const cod = codigos(ps);
          // deno-lint-ignore no-explicit-any
          const al = alertasPresupuesto(ctrl, (p: any) => `${cod[p.id]} ${p.nombre}`);
          atrasadas += al.filter((a: { tipo: string }) => a.tipo === "atraso").length;
          brechas += al.filter((a: { tipo: string }) => a.tipo === "brecha").length;
          if (al.length) lineasPresupuesto.push(`${proj} · ${pres.nombre} (pagado ${ctrl.pctFinanciero.toFixed(1)}%, físico ${ctrl.pctFisico.toFixed(1)}%): ${al.map((a: { texto: string }) => a.texto).join("; ")}`);
        }
        // deno-lint-ignore no-explicit-any
        const sinActividad = deProyecto(cuentas, proj).filter((c: any) => c.estado === "aprobado_total" && !linajes.has(c.partida_linaje)).length;
        if (sinActividad) lineasPresupuesto.push(`${proj}: ${sinActividad} cuenta${sinActividad === 1 ? "" : "s"} de cobro aprobada${sinActividad === 1 ? "" : "s"} sin actividad del presupuesto`);
        // deno-lint-ignore no-explicit-any
        const resp = (obligaciones || []).find((o: any) => o.project === proj)?.ing_responsable || null;
        if (atrasadas || brechas) pendientes.push({ project: proj, tipo: "plan", detalle: `registrar en Presupuestos el avance físico: ${atrasadas ? `${atrasadas} actividad${atrasadas === 1 ? "" : "es"} pasada${atrasadas === 1 ? "" : "s"} de su fecha de fin` : ""}${atrasadas && brechas ? " y " : ""}${brechas ? `${brechas} con más pagado que construido` : ""}`, responsableId: resp });
        if (sinActividad) pendientes.push({ project: proj, tipo: "plan", detalle: `cargar ${sinActividad} cuenta${sinActividad === 1 ? "" : "s"} de cobro aprobada${sinActividad === 1 ? "" : "s"} a su actividad del presupuesto`, responsableId: resp });
      }
    }

    const perfil = new Map((perfiles || []).map((p: { id: string }) => [p.id, p]));
    const correoDe = new Map((contactos || []).map((c: { profile_id: string; email: string }) => [c.profile_id, c.email]));

    // Un correo por responsable con todo lo suyo.
    const porPersona = new Map<string, Pendiente[]>();
    const sinCorreo: Pendiente[] = [];
    for (const p of pendientes) {
      const persona = p.responsableId ? perfil.get(p.responsableId) as { activo?: boolean } | undefined : undefined;
      if (p.responsableId && persona?.activo && correoDe.get(p.responsableId)) {
        porPersona.set(p.responsableId, [...(porPersona.get(p.responsableId) || []), p]);
      } else sinCorreo.push(p);
    }
    const correos: { destinatarios: string[]; asunto: string; html: string }[] = [];
    for (const [id, items] of porPersona) {
      const nombre = String((perfil.get(id) as { nombre?: string })?.nombre || "").split(" ")[0];
      correos.push({
        destinatarios: [correoDe.get(id)!],
        asunto: `SYD — Tienes ${items.length === 1 ? "un pendiente" : `${items.length} pendientes`} en la app`,
        html: `<p>Hola ${esc(nombre)},</p><p>Según el Sistema de Gestión de Proyectos de SYD, tienes pendiente:</p>${lista(items.map(i => `${i.project}: ${i.detalle}`))}<p>Por favor cárgalo en <a href="${APP_URL}">${APP_URL}</a>. Si ya lo hiciste, revisa que haya quedado como <b>Enviado</b> y no como borrador.</p><p>Este recordatorio se repite cada 2 días mientras siga pendiente.</p>`,
      });
    }
    // Resumen para Directivos sin restricción de proyecto (los limitados a un
    // proyecto, ej. cuentas externas, no reciben el de toda la empresa).
    const directivos = (perfiles || []).filter((p: { rol: string; activo: boolean; proyecto_asignado: string[] | null }) => p.rol === "Directivo" && p.activo && !p.proyecto_asignado?.length)
      .map((p: { id: string; email_notificaciones?: string }) => correoDe.get(p.id) || p.email_notificaciones).filter(Boolean) as string[];
    if ((pendientes.length || lineasPlan.length || lineasPresupuesto.length) && directivos.length) {
      const nombreDe = (p: Pendiente) => p.responsableId ? String((perfil.get(p.responsableId) as { nombre?: string })?.nombre || "sin nombre") : "sin responsable";
      correos.push({
        destinatarios: [...new Set(directivos)],
        asunto: `SYD — ${pendientes.length} pendiente${pendientes.length === 1 ? "" : "s"} de informes y planes`,
        html: `<p>Pendientes a la fecha:</p>${lista(pendientes.map(p => `${p.project}: ${p.detalle} — ${nombreDe(p)}${sinCorreo.includes(p) ? " (no se le pudo avisar: sin correo registrado)" : ""}`))}<p>Los responsables con correo registrado ya recibieron su recordatorio. Puedes asignar responsables y correos en <b>Equipo</b>.</p>${lineasPlan.length ? `<p><b>Plan semanal vs. lo registrado por los coordinadores:</b></p>${lista(lineasPlan)}` : ""}${lineasPresupuesto.length ? `<p><b>Presupuestos de obra:</b></p>${lista(lineasPresupuesto)}` : ""}`,
      });
    }

    if (dry) return new Response(JSON.stringify({ ok: true, dry: true, pendientes, correos: correos.map(c => ({ ...c, html: undefined, cuerpo: c.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() })) }, null, 2), { status: 200 });

    const errores: string[] = [];
    for (const c of correos) {
      const resp = await fetch(Deno.env.get("GAS_URL")!, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ tipoAlerta: "recordatorio_informes", secreto: Deno.env.get("GAS_RECORDATORIOS_SECRET"), ...c }),
      });
      const texto = await resp.text();
      let ok = false;
      try { ok = !!JSON.parse(texto).ok; } catch { /* respuesta no JSON */ }
      if (!ok) errores.push(`${c.destinatarios.join(",")}: ${texto.slice(0, 200)}`);
    }
    return new Response(JSON.stringify({ ok: !errores.length, enviados: correos.length - errores.length, errores }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
