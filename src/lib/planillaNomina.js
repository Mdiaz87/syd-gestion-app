// Planilla día por día de las novedades de nómina (pedido de Kelly, 2026-11-20:
// "este es el modelo sobre el cual los ingenieros y coordinadores suben las
// novedades"). El ingeniero llena por cada día: novedad, hora de entrada y de
// salida; la app calcula sola los días y las horas extra y recargos que
// Talento Humano pasa a la nómina en SYD Gestión.
//
// Reglas (Colombia):
// - Trabajo nocturno: de 7:00 p. m. a 6:00 a. m. (Ley 2466 de 2025, desde el
//   25 de diciembre de 2025).
// - Dominical/festivo: las horas que caen en domingo o festivo (festivos con
//   Ley Emiliani, calculados abajo).
// - Horas extra: las que pasan de HORAS_ORDINARIAS_DIA en el mismo turno.
// - Descanso (almuerzo): se descuenta 1 hora por defecto si el turno pasa por
//   el mediodía completo (12:00 a 1:00 p. m.); el ingeniero la puede cambiar.
// Las tarifas de cada tipo de hora las aplica la nómina en SYD Gestión.

export const HORAS_ORDINARIAS_DIA = 8;
const INICIO_NOCHE = 19 * 60; // 7:00 p. m.
const FIN_NOCHE = 6 * 60; // 6:00 a. m.

export const NOVEDADES_DIA = [
  ["", "Día normal (sin novedad)"],
  ["trabajo", "Trabajó (con horario)"],
  ["descanso", "Descanso"],
  ["incapacidad", "Incapacidad"],
  ["accidente", "Accidente de trabajo"],
  ["vacaciones", "Vacaciones"],
  ["permiso_remunerado", "Permiso remunerado"],
  ["permiso_no_remunerado", "Permiso no remunerado"],
  ["ausencia", "Ausencia injustificada"],
];
export const etiquetaNovedad = (k) => (NOVEDADES_DIA.find(([v]) => v === k) || [k, k])[1];

// ── Festivos de Colombia ────────────────────────────────────────────────
const iso = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
const fechaUTC = (a, m, d) => new Date(Date.UTC(a, m - 1, d));
const sumar = (d, n) => new Date(d.getTime() + n * 86400000);
const alLunes = (d) => { const w = d.getUTCDay(); return w === 1 ? d : sumar(d, (8 - w) % 7); };

function pascua(a) {
  const b = a % 19, c = Math.floor(a / 100), d = a % 100, e = Math.floor(c / 4), f = c % 4, g = Math.floor((c + 8) / 25),
    h = Math.floor((c - g + 1) / 3), i = (19 * b + c - e - h + 15) % 30, k = Math.floor(d / 4), l = d % 4,
    m = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * m) / 451), mes = Math.floor((i + m - 7 * n + 114) / 31),
    dia = ((i + m - 7 * n + 114) % 31) + 1;
  return fechaUTC(a, mes, dia);
}

const cacheFestivos = {};
export function festivosColombia(a) {
  if (cacheFestivos[a]) return cacheFestivos[a];
  const p = pascua(a);
  const lista = [
    fechaUTC(a, 1, 1), alLunes(fechaUTC(a, 1, 6)), alLunes(fechaUTC(a, 3, 19)),
    sumar(p, -3), sumar(p, -2), // Jueves y Viernes Santo
    fechaUTC(a, 5, 1), alLunes(sumar(p, 39)), alLunes(sumar(p, 60)), alLunes(sumar(p, 68)), // Ascensión, Corpus, Sagrado Corazón
    alLunes(fechaUTC(a, 6, 29)), fechaUTC(a, 7, 20), fechaUTC(a, 8, 7), alLunes(fechaUTC(a, 8, 15)),
    alLunes(fechaUTC(a, 10, 12)), alLunes(fechaUTC(a, 11, 1)), alLunes(fechaUTC(a, 11, 11)),
    fechaUTC(a, 12, 8), fechaUTC(a, 12, 25),
  ].map(iso);
  return (cacheFestivos[a] = new Set(lista));
}
export const esDominicalOFestivo = (f) => {
  const d = new Date(`${f}T00:00:00Z`);
  return d.getUTCDay() === 0 || festivosColombia(d.getUTCFullYear()).has(f);
};

// ── Días de la quincena ─────────────────────────────────────────────────
export function diasQuincena(inicio) {
  const [a, m, d] = inicio.split("-").map(Number);
  const fin = d === 1 ? 15 : new Date(Date.UTC(a, m, 0)).getUTCDate();
  const dias = [];
  for (let x = d; x <= fin; x++) dias.push(iso(fechaUTC(a, m, x)));
  return dias;
}
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const diaSemana = (f) => DIAS[new Date(`${f}T00:00:00Z`).getUTCDay()];

// "18:00" -> 1080 minutos
const minutos = (h) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || "").trim());
  return m ? +m[1] * 60 + +m[2] : null;
};

// Descanso por defecto: 1 hora si el turno cubre de 12:00 a 13:00.
export function descansoSugerido(entrada, salida) {
  const e = minutos(entrada), s0 = minutos(salida);
  if (e == null || s0 == null) return 0;
  const s = s0 <= e ? s0 + 1440 : s0;
  return e <= 720 && s >= 780 ? 1 : 0;
}

// Horas de un turno clasificadas. Devuelve { total, ordinarias, horas: {tipo: h} } o null si falta el horario.
export function clasificarTurno(fecha, entrada, salida, descansoHoras = 0) {
  const e = minutos(entrada), s0 = minutos(salida);
  if (e == null || s0 == null || e === s0) return null;
  const s = s0 < e ? s0 + 1440 : s0; // cruza la medianoche
  const manana = iso(sumar(new Date(`${fecha}T00:00:00Z`), 1));
  // El descanso se quita del medio del turno (evita adivinar a qué hora fue).
  const desc = Math.max(0, Math.round((+descansoHoras || 0) * 60));
  const iniDesc = Math.round((e + s) / 2 - desc / 2);
  const limiteOrd = HORAS_ORDINARIAS_DIA * 60;
  const conteo = {};
  let trabajados = 0;
  for (let t = e; t < s; t++) {
    if (t >= iniDesc && t < iniDesc + desc) continue;
    const dia = t >= 1440 ? manana : fecha;
    const hora = t % 1440;
    const noche = hora >= INICIO_NOCHE || hora < FIN_NOCHE;
    const dom = esDominicalOFestivo(dia);
    const extra = trabajados >= limiteOrd;
    trabajados++;
    let tipo = null;
    if (extra) tipo = noche ? (dom ? "extra_nocturna_dominical" : "extra_nocturna") : (dom ? "extra_diurna_dominical" : "extra_diurna");
    else if (noche && dom) tipo = "recargo_nocturno_dominical";
    else if (noche) tipo = "recargo_nocturno";
    else if (dom) tipo = "recargo_dominical";
    if (tipo) conteo[tipo] = (conteo[tipo] || 0) + 1;
  }
  const horas = Object.fromEntries(Object.entries(conteo).map(([k, v]) => [k, Math.round((v / 60) * 100) / 100]));
  return { total: Math.round((trabajados / 60) * 100) / 100, ordinarias: Math.round((Math.min(trabajados, limiteOrd) / 60) * 100) / 100, horas };
}

// Totales de la quincena a partir de la planilla [{fecha, novedad, entrada, salida, descanso, nota}].
export function totalesPlanilla(planilla) {
  let incap = 0, vac = 0, noPagados = 0;
  const horas = {};
  const errores = [];
  for (const d of planilla || []) {
    if (d.novedad === "incapacidad" || d.novedad === "accidente") incap++;
    else if (d.novedad === "vacaciones") vac++;
    else if (d.novedad === "permiso_no_remunerado" || d.novedad === "ausencia") noPagados++;
    else if (d.novedad === "trabajo") {
      const c = clasificarTurno(d.fecha, d.entrada, d.salida, d.descanso);
      if (!c) { errores.push(d.fecha); continue; }
      for (const [k, v] of Object.entries(c.horas)) horas[k] = Math.round(((horas[k] || 0) + v) * 100) / 100;
    }
  }
  return {
    dias_trabajados: Math.max(0, 15 - incap - vac - noPagados),
    dias_incapacidad: Math.min(15, incap),
    dias_vacaciones: Math.min(15 - Math.min(15, incap), vac),
    dias_no_pagados: noPagados,
    horas,
    errores,
  };
}
