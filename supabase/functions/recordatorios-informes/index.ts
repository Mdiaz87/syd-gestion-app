import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Recordatorios por correo de informes vencidos. La llama pg_cron cada 2 días
// a las 7 a.m. (Colombia) con x-cron-secret. Se despliega con --no-verify-jwt.
// Con ?dry=1 no envía nada: devuelve lo que mandaría (para probar).
//
// Las reglas son las mismas de src/lib/recordatorios.js (Dashboard); si
// cambian allá, cambiarlas aquí también.
// - Coordinador: semana (lunes) vence el lunes siguiente 12 m; la semana se
//   toma de las fechas de los días del informe.
// - Ingeniero: mes anterior, del 1 al 5; ing_mensual_desde = primer mes exigido.
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
type Obligacion = { project: string; coord_semanal: boolean; ing_mensual: boolean; ing_mensual_desde: string | null; coord_responsable: string | null; ing_responsable: string | null };
type Pendiente = { project: string; tipo: "coord" | "ing"; detalle: string; responsableId: string | null };

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
    if (o.coord_semanal) {
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

    const [{ data: filas }, { data: obligaciones }, { data: perfiles }, { data: contactos }] = await Promise.all([
      db.from("reports").select("data"),
      db.from("obligaciones_informes").select("*"),
      db.from("profiles").select("id,nombre,rol,activo,email_notificaciones,proyecto_asignado"),
      db.from("contactos_notificacion").select("profile_id,email"),
    ]);
    const reports = (filas || []).map((f: { data: Report }) => f.data);
    const pendientes = calcularPendientes(reports, (obligaciones || []) as Obligacion[]);

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
        asunto: `SYD — Tienes ${items.length === 1 ? "un informe pendiente" : `${items.length} informes pendientes`}`,
        html: `<p>Hola ${esc(nombre)},</p><p>Según el Sistema de Gestión de Proyectos de SYD, aún no se ha enviado:</p>${lista(items.map(i => `${i.project}: ${i.detalle}`))}<p>Por favor cárgalo en <a href="${APP_URL}">${APP_URL}</a>. Si ya lo hiciste, revisa que haya quedado como <b>Enviado</b> y no como borrador.</p><p>Este recordatorio se repite cada 2 días mientras siga pendiente.</p>`,
      });
    }
    // Resumen para Directivos sin restricción de proyecto (los limitados a un
    // proyecto, ej. cuentas externas, no reciben el de toda la empresa).
    const directivos = (perfiles || []).filter((p: { rol: string; activo: boolean; proyecto_asignado: string[] | null }) => p.rol === "Directivo" && p.activo && !p.proyecto_asignado?.length)
      .map((p: { id: string; email_notificaciones?: string }) => correoDe.get(p.id) || p.email_notificaciones).filter(Boolean) as string[];
    if (pendientes.length && directivos.length) {
      const nombreDe = (p: Pendiente) => p.responsableId ? String((perfil.get(p.responsableId) as { nombre?: string })?.nombre || "sin nombre") : "sin responsable";
      correos.push({
        destinatarios: [...new Set(directivos)],
        asunto: `SYD — ${pendientes.length} informe${pendientes.length === 1 ? "" : "s"} vencido${pendientes.length === 1 ? "" : "s"}`,
        html: `<p>Informes vencidos a la fecha:</p>${lista(pendientes.map(p => `${p.project}: ${p.detalle} — ${nombreDe(p)}${sinCorreo.includes(p) ? " (no se le pudo avisar: sin correo registrado)" : ""}`))}<p>Los responsables con correo registrado ya recibieron su recordatorio. Puedes asignar responsables y correos en <b>Equipo</b>.</p>`,
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
