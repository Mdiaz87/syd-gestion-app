// Plan semanal del ingeniero vs. lo que registran los coordinadores a diario.
// Lógica pura, sin dependencias: la usan la app (src/) y la Edge Function
// recordatorios-informes, para que no se descuadren. Fechas como 'YYYY-MM-DD'.

const aUTC = (s) => new Date(`${s}T00:00:00Z`);
const iso = (d) => d.toISOString().slice(0, 10);
export const sumarDias = (s, n) => { const d = aUTC(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const lunesDeFecha = (s) => { const d = aUTC(s); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return iso(d); };

// ── Festivos de Colombia (fijos, Ley Emiliani y los de Semana Santa) ──────────
function domingoPascua(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(new Date(Date.UTC(y, mes - 1, dia)));
}
const alLunesSiguiente = (s) => { const dow = aUTC(s).getUTCDay(); return dow === 1 ? s : sumarDias(s, (8 - dow) % 7); };
export function festivosColombia(y) {
  const f = (m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const pascua = domingoPascua(y);
  return new Set([
    f(1, 1), f(5, 1), f(7, 20), f(8, 7), f(12, 8), f(12, 25),
    ...[f(1, 6), f(3, 19), f(6, 29), f(8, 15), f(10, 12), f(11, 1), f(11, 11)].map(alLunesSiguiente),
    sumarDias(pascua, -3), sumarDias(pascua, -2),
    sumarDias(pascua, 43), sumarDias(pascua, 64), sumarDias(pascua, 71),
  ]);
}
export const esFestivo = (s) => festivosColombia(+s.slice(0, 4)).has(s);

// El plan se entrega el lunes; si el lunes es festivo, el martes.
export const diaEntrega = (semana) => esFestivo(semana) ? sumarDias(semana, 1) : semana;

// Primera semana en que se exige el plan: antes de esto no hay nada que reclamar.
export const PRIMERA_SEMANA_PLAN = "2026-11-02";

// hoy: 'YYYY-MM-DD' en hora de Colombia.
export function estadoEntrega(plan, semana, hoy) {
  const vence = diaEntrega(semana);
  if (!plan && semana < PRIMERA_SEMANA_PLAN) return { estado: "no_aplica", vence, enviadoDia: null };
  if (plan?.estado === "enviado") {
    const enviadoDia = plan.enviado_at ? iso(new Date(new Date(plan.enviado_at).getTime() - 5 * 3600_000)) : null;
    return { estado: enviadoDia && enviadoDia > vence ? "enviado_tarde" : "enviado", vence, enviadoDia };
  }
  return { estado: hoy > vence ? "vencido" : "pendiente", vence, enviadoDia: null };
}

// ── Coincidencia de actividades ───────────────────────────────────────────────
export const normalizar = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const VACIAS = new Set(["de", "del", "la", "el", "los", "las", "y", "en", "a", "para", "con", "al"]);
// Singular y plural cuentan igual: "ENTREGA DE LOTE" = "ENTREGA DE LOTES".
const singular = (p) => p.length > 4 && p.endsWith("es") && !p.endsWith("ies") ? p.slice(0, -2) : p.length > 3 && p.endsWith("s") ? p.slice(0, -1) : p;
const palabras = (t) => normalizar(t).split(" ").filter(p => p && !VACIAS.has(p)).map(singular);
export function mismaActividad(a, b) {
  const na = normalizar(a), nb = normalizar(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const pa = palabras(a), pb = palabras(b);
  if (!pa.length || !pb.length) return false;
  if (pa.join(" ") === pb.join(" ")) return true;
  const [corta, larga] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  return corta.filter(p => larga.includes(p)).length === corta.length && corta.length >= 2;
}
const nombreReal = (a) => a.actividad === "Otro" ? (a.actividadOtro || "") : (a.actividad || "");
const unidadReal = (a) => a.unidad === "Otro" ? (a.unidadOtro || "") : (a.unidad || "");

// Días registrados por coordinadores de un proyecto en [desde, hasta].
export function diasCoordinador(reports, project, desde, hasta) {
  const res = [];
  for (const r of reports) {
    if (r.role !== "Coordinador" || r.project !== project) continue;
    for (const d of r.days || []) {
      if (d.date && d.date >= desde && d.date <= hasta && ((d.activities || []).some(a => a.actividad) || String(d.novelties || "").trim())) res.push(d);
    }
  }
  return res;
}

const DIAS_LABORALES = 6; // lunes a sábado

// Cruza el plan con lo registrado. hoy limita lo que ya pudo pasar.
export function cotejarPlan(plan, reports, hoy) {
  const semana = String(plan.semana).slice(0, 10), domingo = sumarDias(semana, 6);
  const hasta = hoy < domingo ? hoy : domingo;
  const terminada = hoy > sumarDias(semana, 5);
  const dias = diasCoordinador(reports, plan.project, semana, hasta);
  const laborales = [];
  for (let i = 0; i < DIAS_LABORALES; i++) {
    const f = sumarDias(semana, i);
    if (f <= hasta && !esFestivo(f)) laborales.push(f);
  }
  const avanceSemana = laborales.length / DIAS_LABORALES;
  const usadas = new Set();
  const filas = (plan.actividades || []).filter(a => String(a.actividad || "").trim()).map(p => {
    const meta = p.meta === "" || p.meta == null ? null : +p.meta;
    const registros = [];
    dias.forEach((d, di) => (d.activities || []).forEach((a, ai) => {
      if (mismaActividad(p.actividad, nombreReal(a))) { registros.push({ fecha: d.date, cantidad: a.cantidad === "" || a.cantidad == null ? null : +a.cantidad, unidad: unidadReal(a), etapa: a.etapa }); usadas.add(`${di}-${ai}`); }
    }));
    const mismaUnidad = registros.filter(r => normalizar(r.unidad) === normalizar(p.unidad) && r.cantidad != null);
    const ejecutado = mismaUnidad.reduce((s, r) => s + r.cantidad, 0);
    const pct = meta && mismaUnidad.length ? Math.round((ejecutado / meta) * 100) : null;
    let estado;
    if (!registros.length) estado = terminada ? "incumplida" : (avanceSemana >= 0.5 ? "en_riesgo" : "por_iniciar");
    else if (!meta) estado = "cumplida";
    else if (pct != null && pct >= 100) estado = "cumplida";
    else if (terminada) estado = "parcial";
    else estado = pct != null && pct / 100 < avanceSemana * 0.5 ? "en_riesgo" : "en_curso";
    return { ...p, meta, ejecutado: mismaUnidad.length ? ejecutado : null, pct, estado, registros, diasConRegistro: new Set(registros.map(r => r.fecha)).size, otraUnidad: registros.length > 0 && !mismaUnidad.length && !!meta };
  });

  const noPlaneadas = {};
  dias.forEach((d, di) => (d.activities || []).forEach((a, ai) => {
    const n = nombreReal(a);
    if (n && !usadas.has(`${di}-${ai}`)) noPlaneadas[n] = (noPlaneadas[n] || 0) + 1;
  }));

  // Posibles causas, sacadas de lo que escribieron los coordinadores.
  const fechas = new Set(dias.map(d => d.date));
  const diasSinRegistro = laborales.filter(f => !fechas.has(f));
  const diasLluvia = [...new Set(dias.filter(d => /lluv|torment/i.test(d.climaPrincipal || "")).map(d => d.date))].sort();
  const novedades = dias.filter(d => String(d.novelties || "").trim()).map(d => ({ fecha: d.date, texto: String(d.novelties).trim() })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const causas = [];
  if (diasLluvia.length) causas.push(`Lluvia ${diasLluvia.length} día${diasLluvia.length === 1 ? "" : "s"}`);
  if (diasSinRegistro.length) causas.push(`${diasSinRegistro.length} día${diasSinRegistro.length === 1 ? "" : "s"} sin registro del coordinador`);
  const nNo = Object.keys(noPlaneadas).length;
  if (nNo) causas.push(`Se trabajó en ${nNo} actividad${nNo === 1 ? "" : "es"} fuera del plan`);
  if (novedades.length) causas.push(`${novedades.length} novedad${novedades.length === 1 ? "" : "es"} reportada${novedades.length === 1 ? "" : "s"}`);

  const cuenta = (e) => filas.filter(f => f.estado === e).length;
  const cumplidas = cuenta("cumplida");
  return {
    filas, terminada, avanceSemana, cumplidas, total: filas.length,
    pctCumplimiento: filas.length ? Math.round((cumplidas / filas.length) * 100) : null,
    incumplidas: cuenta("incumplida"), parciales: cuenta("parcial"), enRiesgo: cuenta("en_riesgo"),
    noPlaneadas, diasSinRegistro, diasLluvia, novedades, causas,
  };
}

// Revisión automática de si el plan es adecuado, contra el historial de la
// obra. Son señales para que Gerencia decida, no un juicio de ingeniería.
export function revisarPlan(plan, reports, planAnterior, hoy) {
  const semana = String(plan.semana).slice(0, 10);
  const actividades = (plan.actividades || []).filter(a => String(a.actividad || "").trim());
  const avisos = [];
  const av = (nivel, texto) => avisos.push({ nivel, texto });
  if (!actividades.length) { av("alta", "El plan no tiene actividades."); return { avisos, adecuado: false }; }

  const desde = sumarDias(semana, -56), hasta = sumarDias(semana, -1);
  const hist = diasCoordinador(reports, plan.project, desde, hasta);
  const porSemana = {}; // nombre normalizado -> {nombre, semanas:{lunes:{unidad:total}}}
  hist.forEach(d => (d.activities || []).forEach(a => {
    const n = nombreReal(a); if (!n) return;
    const k = normalizar(n), lun = lunesDeFecha(d.date), u = normalizar(unidadReal(a));
    porSemana[k] = porSemana[k] || { nombre: n, semanas: {} };
    const s = porSemana[k].semanas[lun] = porSemana[k].semanas[lun] || {};
    if (a.cantidad !== "" && a.cantidad != null) s[u] = (s[u] || 0) + +a.cantidad;
  }));

  const vistas = new Set();
  for (const p of actividades) {
    const k = normalizar(p.actividad);
    if (vistas.has(k)) av("media", `"${p.actividad}" está repetida en el plan.`);
    vistas.add(k);
    if (p.meta === "" || p.meta == null || !(+p.meta > 0)) av("media", `"${p.actividad}" no tiene meta: no se podrá medir si se cumplió.`);
    const previas = Object.values(porSemana).filter(h => mismaActividad(h.nombre, p.actividad));
    if (!previas.length) { if (hist.length) av("info", `"${p.actividad}" no aparece en los registros de las últimas 8 semanas: es nueva en esta obra.`); continue; }
    if (+p.meta > 0) {
      const u = normalizar(p.unidad);
      const totales = previas.flatMap(h => Object.values(h.semanas).map(s => s[u]).filter(v => v > 0));
      if (totales.length >= 2) {
        const max = Math.max(...totales);
        if (+p.meta > max * 1.5) av("media", `"${p.actividad}": la meta de ${p.meta} ${p.unidad} supera con creces el máximo semanal reciente (${Math.round(max * 10) / 10} ${p.unidad}).`);
      }
    }
  }

  // Lo que quedó sin terminar la semana pasada y no se volvió a planear.
  if (planAnterior?.estado === "enviado") {
    const previo = cotejarPlan(planAnterior, reports, hoy);
    for (const f of previo.filas) {
      if ((f.estado === "incumplida" || f.estado === "parcial") && !actividades.some(p => mismaActividad(p.actividad, f.actividad))) {
        av("alta", `"${f.actividad}" quedó ${f.estado === "parcial" ? "a medias" : "sin hacer"} la semana pasada y no está en este plan.`);
      }
    }
  }

  // Trabajo que se hace casi todas las semanas y el plan no menciona.
  const ultimas = [1, 2, 3, 4].map(i => sumarDias(semana, -7 * i));
  for (const h of Object.values(porSemana)) {
    const veces = ultimas.filter(l => h.semanas[l]).length;
    if (veces >= 3 && !actividades.some(p => mismaActividad(p.actividad, h.nombre))) {
      av("info", `"${h.nombre}" se registró en ${veces} de las últimas 4 semanas y no está en el plan.`);
    }
  }
  return { avisos, adecuado: !avisos.some(a => a.nivel !== "info") };
}

// Nombres que usan los coordinadores en esta obra, para sugerirlos en el plan.
export function actividadesRecientes(reports, project, hoy, dias = 56) {
  const vistos = new Map();
  diasCoordinador(reports, project, sumarDias(hoy, -dias), hoy).forEach(d => (d.activities || []).forEach(a => {
    const n = nombreReal(a).trim();
    if (n && !vistos.has(normalizar(n))) vistos.set(normalizar(n), n);
  }));
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, "es"));
}

export const hoyColombia = () => iso(new Date(Date.now() - 5 * 3600_000));

// Alertas por proyecto para Dashboard y correo.
export function alertasPlanes(planes, reports, obligaciones, proyectosVisibles, hoy) {
  const semana = lunesDeFecha(hoy), anterior = sumarDias(semana, -7);
  const buscar = (p, s) => planes.find(x => x.project === p && String(x.semana).slice(0, 10) === s);
  const res = [];
  for (const o of obligaciones) {
    if (!o.plan_semanal || (proyectosVisibles && !proyectosVisibles.includes(o.project))) continue;
    const plan = buscar(o.project, semana), previo = buscar(o.project, anterior);
    const entrega = estadoEntrega(plan, semana, hoy);
    const cotejoActual = plan?.estado === "enviado" ? cotejarPlan(plan, reports, hoy) : null;
    const cotejoPrevio = previo?.estado === "enviado" ? cotejarPlan(previo, reports, hoy) : null;
    res.push({ project: o.project, semana, anterior, entrega, plan, previo, cotejoActual, cotejoPrevio, responsableId: o.ing_responsable || plan?.autor_id || previo?.autor_id || null });
  }
  return res;
}
