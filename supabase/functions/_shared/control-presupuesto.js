// ── CONTROL DEL PRESUPUESTO: proyectado vs. ejecutado ──────────────────────────
// Lógica pura (sin red). Lo ejecutado sale de las cuentas de cobro cargadas a
// cada actividad (por su linaje) y de la ejecución manual.
// - Pagado: cuenta aprobada y marcada como pagada, en el mes del pago.
// - Comprometido: aprobada y aún sin pagar (mes de la aprobación).
// - En trámite: radicada, todavía en revisión contable o de Gerencia.
// - Proyectado: el total de cada actividad repartido por días entre su
//   inicio y fin (o las fechas del presupuesto si no tiene).

import { mismaActividad, normalizar } from "./plan-semanal.js";

const num = (v) => (v === "" || v == null ? 0 : +v || 0);
export const mesDe = (fecha) => String(fecha).slice(0, 7);
const aDia = (s) => new Date(`${s}T00:00:00Z`);

export function mesesEntre(desde, hasta) {
  if (!desde || !hasta || hasta < desde) return [];
  const res = []; let [y, m] = desde.slice(0, 7).split("-").map(Number);
  const [yf, mf] = hasta.slice(0, 7).split("-").map(Number);
  while (y < yf || (y === yf && m <= mf)) { res.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
  return res;
}

// Actividades que reciben costos: subactividades y actividades sin subactividades.
export function hojas(partidas) {
  const conHijos = new Set(partidas.filter(p => p.padre_id).map(p => p.padre_id));
  return partidas.filter(p => !conHijos.has(p.id));
}

// Códigos como en la tabla: PO1, PO1.1 en preoperativa; 1, 1.1 en operativa.
export function codigos(partidas) {
  const c = {};
  for (const [fase, pref] of [["pre_operativa", "PO"], ["operativa", ""]]) {
    partidas.filter(p => p.fase === fase && !p.padre_id).forEach((a, i) => {
      c[a.id] = `${pref}${i + 1}`;
      partidas.filter(s => s.padre_id === a.id).forEach((s, j) => { c[s.id] = `${pref}${i + 1}.${j + 1}`; });
    });
  }
  return c;
}

const fechaPago = (c) => [...(c.historial || [])].reverse().find(h => h.accion === "Marcado como pagado")?.fecha || null;
export const valorCuenta = (c) => num(c.valor_final_pagar ?? c.valor);

// Avance físico sugerido: cantidades que registraron los coordinadores para
// una actividad con el mismo nombre y unidad, entre sus fechas, sobre la
// cantidad presupuestada. Es una ayuda: el % físico lo confirma el ingeniero.
export function fisicoSugerido(partida, reports, project, desde, hasta, hoy) {
  if (!(num(partida.cantidad) > 0) || !partida.unidad) return null;
  const a = partida.fecha_inicio || desde, b = partida.fecha_fin || hasta || hoy;
  let suma = 0, hubo = false;
  for (const r of reports || []) {
    if (r.role !== "Coordinador" || r.project !== project) continue;
    for (const d of r.days || []) {
      if (!d.date || (a && d.date < a) || (b && d.date > b) || d.date > hoy) continue;
      for (const x of d.activities || []) {
        const n = x.actividad === "Otro" ? x.actividadOtro : x.actividad;
        const u = x.unidad === "Otro" ? x.unidadOtro : x.unidad;
        if (mismaActividad(n, partida.nombre) && normalizar(u) === normalizar(partida.unidad) && x.cantidad !== "" && x.cantidad != null) { suma += +x.cantidad || 0; hubo = true; }
      }
    }
  }
  return hubo ? Math.min(100, Math.round(suma / num(partida.cantidad) * 1000) / 10) : null;
}

export function controlPresupuesto(pres, partidas, cuentas, manuales, hoy, extra = {}) {
  const { avances = [], reports = null } = extra;
  const lista = hojas(partidas);
  const porLinaje = Object.fromEntries(lista.map(p => [p.linaje, p]));
  const total = (p) => num(p.cantidad) * num(p.precio_unitario);
  const ini = pres.fecha_inicio || partidas.map(p => p.fecha_inicio).filter(Boolean).sort()[0];
  const fin = pres.fecha_fin || partidas.map(p => p.fecha_fin).filter(Boolean).sort().pop();
  const meses = mesesEntre(ini || hoy, fin || hoy);

  const filas = {};
  lista.forEach(p => { filas[p.linaje] = { partida: p, total: total(p), pagado: 0, comprometido: 0, tramite: 0, manual: 0, proyectadoHoy: 0, proyectadoMes: {}, realMes: {}, cuentas: [] }; });

  // Proyectado: reparto por días.
  lista.forEach(p => {
    const f = filas[p.linaje], a = p.fecha_inicio || ini, b = p.fecha_fin || fin;
    if (!a || !b || b < a || !f.total) return;
    const dias = (aDia(b) - aDia(a)) / 86400000 + 1;
    for (let d = aDia(a); d <= aDia(b); d = new Date(d.getTime() + 86400000)) {
      const s = d.toISOString().slice(0, 10), parte = f.total / dias;
      f.proyectadoMes[mesDe(s)] = (f.proyectadoMes[mesDe(s)] || 0) + parte;
      if (s <= hoy) f.proyectadoHoy += parte;
    }
  });

  for (const c of cuentas) {
    const f = filas[c.partida_linaje]; if (!f) continue;
    const v = valorCuenta(c);
    if (c.estado === "aprobado_total" && c.pago_realizado) {
      f.pagado += v; const m = mesDe(fechaPago(c) || c.revisado_at || c.created_at);
      f.realMes[m] = (f.realMes[m] || 0) + v; f.cuentas.push({ ...c, _tipo: "pagado" });
    } else if (c.estado === "aprobado_total") { f.comprometido += v; f.cuentas.push({ ...c, _tipo: "comprometido" }); }
    else if (["pendiente_contable", "aprobado_contable", "devuelto"].includes(c.estado)) { f.tramite += v; f.cuentas.push({ ...c, _tipo: "tramite" }); }
  }
  for (const m of manuales) {
    const f = filas[m.linaje]; if (!f) continue;
    f.manual += num(m.valor); const k = mesDe(m.mes); f.realMes[k] = (f.realMes[k] || 0) + num(m.valor);
  }

  // Último avance físico registrado por actividad.
  const ultimo = {};
  for (const a of [...avances].sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)))) ultimo[a.linaje] = a;

  const res = Object.values(filas).map(f => {
    const ejecutado = f.pagado + f.manual;
    const pct = f.total ? ejecutado / f.total * 100 : null;
    const pctComprometido = f.total ? (ejecutado + f.comprometido) / f.total * 100 : null;
    const alerta = pctComprometido == null ? null : pctComprometido >= 100 ? "sobrecosto" : pctComprometido >= 90 ? "cerca" : null;
    const av = ultimo[f.partida.linaje];
    const fisico = av ? num(av.pct) : null;
    // Brecha: % pagado menos % construido. Positiva = se ha pagado más de lo construido.
    const brecha = fisico != null && pct != null ? pct - fisico : null;
    const fin = f.partida.fecha_fin || pres.fecha_fin;
    const atraso = !!fin && fin < hoy && (fisico ?? 0) < 100;
    const sugerido = reports ? fisicoSugerido(f.partida, reports, pres.project, ini, fin, hoy) : null;
    return { ...f, ejecutado, pct, pctComprometido, saldo: f.total - ejecutado - f.comprometido, alerta,
      fisico, fisicoFecha: av?.fecha || null, fisicoPor: av?.creado_nombre || null, sugerido, brecha, alertaBrecha: brecha != null && brecha > 10, atraso };
  });
  const sum = (k) => res.reduce((s, f) => s + f[k], 0);
  const totalPres = sum("total"), ejecutado = sum("ejecutado");
  let acP = 0, acR = 0;
  const mensual = meses.map(m => {
    const p = res.reduce((s, f) => s + (f.proyectadoMes[m] || 0), 0), r = res.reduce((s, f) => s + (f.realMes[m] || 0), 0);
    acP += p; acR += r;
    return { mes: m, proyectado: Math.round(p), real: Math.round(r), proyectadoAcum: totalPres ? Math.round(acP / totalPres * 1000) / 10 : 0, realAcum: m <= mesDe(hoy) && totalPres ? Math.round(acR / totalPres * 1000) / 10 : null };
  });
  return {
    filas: res, mensual, total: totalPres, ejecutado, comprometido: sum("comprometido"), tramite: sum("tramite"),
    proyectadoHoy: sum("proyectadoHoy"),
    // Avance físico ponderado por el valor de cada actividad (sin registro cuenta como 0).
    pctFisico: totalPres ? res.reduce((s, f) => s + f.total * (f.fisico || 0), 0) / totalPres : 0,
    sinFisico: res.filter(f => f.fisico == null && f.total).length,
    pctFinanciero: totalPres ? ejecutado / totalPres * 100 : 0,
    pctProgramado: totalPres ? sum("proyectadoHoy") / totalPres * 100 : 0,
  };
}

// Alertas de un presupuesto para Dashboard y correo.
export function alertasPresupuesto(ctrl, codigo = (p) => p.nombre) {
  const res = [];
  for (const f of ctrl.filas) {
    const n = codigo(f.partida);
    if (f.alerta === "sobrecosto") res.push({ nivel: "alta", tipo: "sobrecosto", texto: `${n}: sobrecosto, va en ${Math.round(f.pctComprometido)}% (pagado + aprobado) de lo presupuestado` });
    else if (f.alerta === "cerca") res.push({ nivel: "media", tipo: "cerca", texto: `${n}: lleva ${Math.round(f.pctComprometido)}% del presupuesto (pagado + aprobado)` });
    if (f.alertaBrecha) res.push({ nivel: "alta", tipo: "brecha", texto: `${n}: se ha pagado ${Math.round(f.pct)}% pero solo se ha construido ${Math.round(f.fisico)}%` });
    if (f.atraso) res.push({ nivel: "media", tipo: "atraso", texto: `${n}: debía terminar el ${f.partida.fecha_fin || "fin del presupuesto"} y va en ${f.fisico ?? 0}% de avance físico` });
  }
  return res;
}
