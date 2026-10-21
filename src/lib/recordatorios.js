import { MESES } from "./constants.js";

// ── RECORDATORIOS DE INFORMES ─────────────────────────────────────────────────
// Solo alerta lo que YA venció, y solo en proyectos que deben ese informe
// (tabla obligaciones_informes):
// - Coordinador: el informe semanal (semana = lunes) vence el lunes siguiente
//   a las 12:00 m. Mientras la semana está en curso no hay alerta.
// - Ingeniero: el informe mensual es del mes anterior y se carga del 1 al 5;
//   desde el día 6 se alerta. ing_mensual_desde ('YYYY-MM') marca el primer
//   mes que se exige (proyectos nuevos).

export const HORA_VENCE_SEMANAL = 12;
export const DIA_GRACIA_MENSUAL = 5;

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Lunes (hora local) de la semana de `fecha`, como 'YYYY-MM-DD'.
export const lunesDe = (fecha = new Date()) => {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
};
const sumarDias = (isoStr, n) => { const d = new Date(`${isoStr}T00:00:00`); d.setDate(d.getDate() + n); return iso(d); };

// Semana más reciente cuyo plazo ya venció (su lunes, 'YYYY-MM-DD').
export const semanaVencida = (ahora = new Date()) => {
  const lunesActual = lunesDe(ahora);
  const yaVencioLaAnterior = ahora.getDay() !== 1 || ahora.getHours() >= HORA_VENCE_SEMANAL;
  return sumarDias(lunesActual, yaVencioLaAnterior ? -7 : -14);
};

// Mes cuyo informe de Ingeniero ya debería estar cargado.
export const mesVencido = (ahora = new Date()) => {
  const atras = ahora.getDate() > DIA_GRACIA_MENSUAL ? 1 : 2;
  const d = new Date(ahora.getFullYear(), ahora.getMonth() - atras, 1);
  return { anio: d.getFullYear(), mes: d.getMonth(), etiqueta: `${MESES[d.getMonth()]} ${d.getFullYear()}`, clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` };
};

// Hay informes viejos guardados como "JUNIO 2026" o "JUNIO" sin año: se
// acepta el nombre sin importar mayúsculas y, sin año, se asume que coincide.
const coincideMes = (texto, objetivo) => {
  if (!texto) return false;
  const [nombre, anio] = texto.trim().toLowerCase().split(/\s+/);
  if (nombre !== MESES[objetivo.mes].toLowerCase()) return false;
  const n = parseInt(anio, 10);
  return Number.isFinite(n) ? n === objetivo.anio : true;
};

const fechaCorta = (isoStr) => new Date(`${isoStr}T00:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
export const etiquetaSemana = (lunes) => `${fechaCorta(lunes)} – ${fechaCorta(sumarDias(lunes, 6))}`;

// obligaciones: filas de obligaciones_informes. Devuelve solo lo pendiente.
export function calcularRecordatorios(reports, obligaciones, proyectosVisibles, ahora = new Date()) {
  const visibles = new Set(proyectosVisibles);
  const semana = semanaVencida(ahora);
  const mes = mesVencido(ahora);
  const lunesActual = lunesDe(ahora);
  const res = [];
  for (const o of obligaciones) {
    if (!visibles.has(o.project)) continue;
    const r = { proj: o.project, coordPendiente: false, ingAtrasado: false, semana, semanaEtiqueta: etiquetaSemana(semana), mesObjetivo: mes.etiqueta, diasSemanaEnCurso: null };
    if (o.coord_semanal) {
      // La semana se toma de las FECHAS de los días, no del campo `semana`:
      // ese guarda la semana en que se creó el informe, y quien llena tarde
      // (ej. el lunes, la semana anterior) queda con la etiqueta corrida.
      const delProyecto = reports.filter(x => x.role === "Coordinador" && x.project === o.project);
      const semanasDe = (x) => new Set((x.days || []).filter(d => d.date).map(d => lunesDe(new Date(`${d.date}T00:00:00`))));
      r.coordPendiente = !delProyecto.some(x => x.estado === "enviado" && (semanasDe(x).has(semana) || (x.semana === semana && !semanasDe(x).size)));
      const fechasEnCurso = new Set(delProyecto.flatMap(x => (x.days || [])
        .filter(d => d.date && d.date >= lunesActual && (d.activities || []).some(a => a.actividad)).map(d => d.date)));
      r.diasSemanaEnCurso = fechasEnCurso.size;
    }
    if (o.ing_mensual && (!o.ing_mensual_desde || mes.clave >= o.ing_mensual_desde)) {
      r.ingAtrasado = !reports.some(x => x.role === "Ingeniero" && x.project === o.project && x.type === "mensual" && coincideMes(x.mes, mes));
    }
    res.push(r);
  }
  return res;
}
