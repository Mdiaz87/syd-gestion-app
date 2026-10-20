import { useState, useEffect, useMemo, useRef } from "react";
import { C, BTN_SM } from "../lib/constants.js";
import { Card, SectionTitle } from "./ui.jsx";

// ── RESUMEN DEL ÚLTIMO DÍA REPORTADO (Directivo) ───────────────────────────────
// Al entrar, el Directivo escucha lo que los coordinadores registraron el día
// anterior (o el último día con registros, ej. el sábado si hoy es lunes).
// Texto armado por plantilla con los datos tal cual; voz del navegador.

const DIAS_ATRAS_MAX = 7;        // más viejo que esto no se considera "ayer"
const DIAS_PROYECTO_ACTIVO = 14; // ventana para listar proyectos sin registro

const UNIDAD_HABLADA = { "m³": "metros cúbicos", "m²": "metros cuadrados", "ml": "metros lineales", "und": "unidades" };

const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const sumarDias = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return isoLocal(d); };
const fechaLarga = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
const otro = (v, vOtro) => (v === "Otro" ? (vOtro || "").trim() : (v || "").trim());
const conPunto = (t) => (/[.!?]$/.test(t) ? t : `${t}.`);

const tieneRegistro = (day) => day?.date && ((day.activities || []).some(a => a.actividad) || (day.novelties || "").trim());

const fraseActividad = (a) => {
  const nombre = otro(a.actividad, a.actividadOtro);
  if (!nombre) return null;
  const partes = [a.etapa && a.etapa !== "General" ? `${nombre} en ${a.etapa}` : nombre];
  const unidad = otro(a.unidad, a.unidadOtro);
  if (a.cantidad !== "" && a.cantidad != null) partes.push(`${a.cantidad} ${UNIDAD_HABLADA[unidad] || unidad}`.trim());
  const equipo = otro(a.equipo, a.equipoOtro);
  if (equipo) partes.push(`con ${equipo}`);
  const personal = otro(a.personal, a.personalOtro);
  if (personal) partes.push(personal.toLowerCase());
  let t = partes.join(", ");
  if ((a.observaciones || "").trim()) t += ` (${a.observaciones.trim()})`;
  return t;
};

export function construirResumen(reports, proyectosVisibles, nombreUsuario, hoy = isoLocal(new Date())) {
  const visibles = new Set(proyectosVisibles);
  const registros = []; // { project, author, day }
  for (const r of reports) {
    if (r.role !== "Coordinador" || !visibles.has(r.project)) continue;
    for (const day of r.days || []) if (tieneRegistro(day) && day.date < hoy) registros.push({ project: r.project, author: r.author, day });
  }
  const limite = sumarDias(hoy, -DIAS_ATRAS_MAX);
  const fecha = registros.map(x => x.day.date).filter(d => d >= limite).sort().pop() || null;

  const hora = new Date().getHours();
  const saludo = `${hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches"}, ${(nombreUsuario || "").split(" ")[0]}.`;

  if (!fecha) {
    return { fecha: null, entradas: [], sinRegistro: [], parrafos: [saludo, `No hay informes de coordinadores en los últimos ${DIAS_ATRAS_MAX} días.`] };
  }

  const entradas = registros.filter(x => x.day.date === fecha).sort((a, b) => a.project.localeCompare(b.project));
  const activos = new Set(registros.filter(x => x.day.date >= sumarDias(fecha, -DIAS_PROYECTO_ACTIVO)).map(x => x.project));
  const conRegistro = new Set(entradas.map(x => x.project));
  const sinRegistro = [...activos].filter(p => !conRegistro.has(p)).sort();

  const cuando = fecha === sumarDias(hoy, -1) ? `Ayer, ${fechaLarga(fecha)}` : `El último día con registros fue el ${fechaLarga(fecha)}. Ese día`;
  const nProy = conRegistro.size;
  const parrafos = [saludo, `${cuando}, hubo ${entradas.length === 1 ? "un reporte" : `${entradas.length} reportes`} de coordinadores en ${nProy === 1 ? "un proyecto" : `${nProy} proyectos`}.`];

  for (const { project, author, day } of entradas) {
    let p = `En ${project}, ${author || "el coordinador"} reportó jornada de ${day.inicioJornada || "—"} a ${day.finJornada || "—"}`;
    p += day.climaPrincipal ? `, clima ${day.climaPrincipal.toLowerCase()}.` : ".";
    const acts = (day.activities || []).map(fraseActividad).filter(Boolean);
    if (acts.length) p += ` ${acts.length === 1 ? "Actividad" : "Actividades"}: ${acts.join("; ")}.`;
    p += (day.novelties || "").trim() ? ` Novedades: ${conPunto(day.novelties.trim())}` : " Sin novedades.";
    parrafos.push(p);
  }
  if (sinRegistro.length) parrafos.push(`Sin registro ese día: ${sinRegistro.join(", ")}.`);
  return { fecha, entradas, sinRegistro, parrafos };
}

// Voz en español; en Mac suelen estar Paulina (México) o Mónica (España).
const elegirVoz = () => {
  const voces = window.speechSynthesis?.getVoices() || [];
  const es = voces.filter(v => v.lang?.toLowerCase().startsWith("es"));
  return es.find(v => /paulina|m[oó]nica|sabina|helena/i.test(v.name))
    || es.find(v => /es-(co|mx|us|419)/i.test(v.lang))
    || es[0] || null;
};

// Se lee automáticamente una sola vez por sesión de pestaña y por fecha, para
// que no vuelva a hablar cada vez que el Directivo regresa al Dashboard.
const CLAVE_LEIDO = "syd-resumen-leido";

export function ResumenAyer({ reports, proyectosVisibles, usuario, autoLeer }) {
  const resumen = useMemo(() => construirResumen(reports, proyectosVisibles, usuario.nombre), [reports, proyectosVisibles, usuario.nombre]);
  const [estado, setEstado] = useState("detenido"); // detenido | hablando | pausado
  const [abierto, setAbierto] = useState(true);
  const soportado = typeof window !== "undefined" && "speechSynthesis" in window;
  const cola = useRef(0);

  const detener = () => { if (soportado) window.speechSynthesis.cancel(); cola.current = 0; setEstado("detenido"); };

  const leer = () => {
    if (!soportado) return;
    window.speechSynthesis.cancel();
    const voz = elegirVoz();
    // Un párrafo por utterance: Chrome corta las muy largas a los ~15 s.
    cola.current = resumen.parrafos.length;
    for (const texto of resumen.parrafos) {
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = voz?.lang || "es-CO";
      if (voz) u.voice = voz;
      u.rate = 1;
      u.onend = u.onerror = () => { cola.current -= 1; if (cola.current <= 0) setEstado("detenido"); };
      window.speechSynthesis.speak(u);
    }
    setEstado("hablando");
  };

  const pausarReanudar = () => {
    if (estado === "hablando") { window.speechSynthesis.pause(); setEstado("pausado"); }
    else if (estado === "pausado") { window.speechSynthesis.resume(); setEstado("hablando"); }
    else leer();
  };

  useEffect(() => {
    if (!autoLeer || !soportado || !reports.length) return;
    const clave = `${resumen.fecha || "sin-fecha"}`;
    try { if (sessionStorage.getItem(CLAVE_LEIDO) === clave) return; sessionStorage.setItem(CLAVE_LEIDO, clave); } catch (e) {}
    // Las voces cargan asíncronas la primera vez.
    if (window.speechSynthesis.getVoices().length) leer();
    else window.speechSynthesis.addEventListener("voiceschanged", leer, { once: true });
  }, [autoLeer, reports.length, resumen.fecha]);

  useEffect(() => () => { if (soportado) window.speechSynthesis.cancel(); }, []);

  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <SectionTitle>🗣️ Resumen {resumen.fecha ? `del ${fechaLarga(resumen.fecha)}` : "de ayer"}</SectionTitle>
        <div style={{ display: "flex", gap: 8 }}>
          {soportado && (
            <button onClick={pausarReanudar} style={{ ...BTN_SM, color: C.blue, borderColor: C.blue, fontWeight: 600 }}>
              {estado === "hablando" ? "⏸ Pausar" : estado === "pausado" ? "▶️ Continuar" : "▶️ Escuchar"}
            </button>
          )}
          {estado !== "detenido" && <button onClick={detener} style={BTN_SM}>⏹ Detener</button>}
          <button onClick={() => setAbierto(a => !a)} style={BTN_SM}>{abierto ? "Ocultar texto" : "Ver texto"}</button>
        </div>
      </div>
      {abierto && (
        <div style={{ fontSize: 14, lineHeight: 1.55, color: C.text }}>
          {resumen.parrafos.slice(1, resumen.sinRegistro.length ? -1 : undefined).map((p, i) => <p key={i} style={{ margin: "8px 0" }}>{p}</p>)}
          {resumen.sinRegistro.length > 0 && (
            <div style={{ background: C.warn + "18", border: `1px solid ${C.warn}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, marginTop: 6 }}>
              📵 Sin registro ese día: <b>{resumen.sinRegistro.join(", ")}</b>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
