import { useEffect, useState } from "react";
import { C, INP, BTN_SM } from "../lib/constants.js";
import { Card, SectionTitle } from "./ui.jsx";
import { cargarNovedadesObra, guardarNovedadesObra, TIPOS_HORA } from "../lib/nominaObra.js";

// Novedades de nómina (Miguel, 2026-11-19): el ingeniero reporta los días y
// las horas extra de su personal de obra para cada quincena; Talento Humano
// (Kelly) las pasa a la nómina en SYD Gestión. Kelly recibe novedades hasta
// el 5 y el 20 de cada mes.
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const etiquetaQuincena = (inicio) => {
  if (!inicio) return "";
  const [a, m, d] = inicio.split("-").map(Number);
  const fin = d === 1 ? 15 : new Date(a, m, 0).getDate();
  return `${d} al ${fin} de ${MESES[m - 1]} de ${a}`;
};
const ESTADO = {
  borrador: { label: "Borrador sin enviar", color: C.muted },
  enviada: { label: "Enviada a nómina", color: C.green },
  aplicada: { label: "Ya está en la nómina", color: C.blue },
};
const num = (v) => (v === "" || v == null ? "" : String(v));

function filaDesde(t) {
  const n = t.novedad;
  return {
    trabajador_id: t.id,
    dias_trabajados: num(n ? n.dias_trabajados : 15),
    dias_incapacidad: num(n ? n.dias_incapacidad : 0),
    dias_vacaciones: num(n ? n.dias_vacaciones : 0),
    horas: Object.fromEntries(TIPOS_HORA.map(([k]) => [k, num(n?.horas?.[k] ?? "")])),
    nota: n?.nota || "",
  };
}

export function NovedadesNomina() {
  const [datos, setDatos] = useState(null);
  const [filas, setFilas] = useState({});
  const [quincena, setQuincena] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [trabajando, setTrabajando] = useState(false);

  const aplicar = (d) => {
    setDatos(d);
    setQuincena(d.inicio);
    setFilas(Object.fromEntries(d.trabajadores.map((t) => [t.id, filaDesde(t)])));
  };
  const cargar = async (inicio) => {
    setError("");
    try { aplicar(await cargarNovedadesObra(inicio)); } catch (e) { setError(e.message); }
  };
  useEffect(() => { cargar(null); }, []);

  if (error && !datos) return <Card><div style={{ color: C.danger, fontSize: 14 }}>⚠️ {error}</div><button style={{ ...BTN_SM, marginTop: 10 }} onClick={() => cargar(quincena)}>Reintentar</button></Card>;
  if (!datos) return <div style={{ color: C.muted, fontSize: 14 }}>Cargando...</div>;

  const editable = (t) => !t.cerrada && t.novedad?.estado !== "aplicada";
  const editables = datos.trabajadores.filter(editable);
  const cambiar = (id, campo, valor) => setFilas((f) => ({ ...f, [id]: { ...f[id], [campo]: valor } }));
  const cambiarHora = (id, k, valor) => setFilas((f) => ({ ...f, [id]: { ...f[id], horas: { ...f[id].horas, [k]: valor } } }));
  const totalDias = (f) => (+f.dias_trabajados || 0) + (+f.dias_incapacidad || 0) + (+f.dias_vacaciones || 0);
  const horasDe = (f) => TIPOS_HORA.reduce((s, [k]) => s + (+f.horas[k] || 0), 0);

  const guardar = async (enviar) => {
    const lista = editables.map((t) => filas[t.id]);
    const malo = editables.find((t) => totalDias(filas[t.id]) > 15);
    if (malo) { setError(`Los días de ${malo.nombre} pasan de 15.`); setAbierto(malo.id); return; }
    setTrabajando(true); setError(""); setAviso("");
    try {
      aplicar(await guardarNovedadesObra(quincena, lista, enviar));
      setAviso(enviar ? "Novedades enviadas a Talento Humano." : "Borrador guardado. Recuerda enviarlo.");
    } catch (e) { setError(e.message); }
    finally { setTrabajando(false); }
  };

  const porProyecto = datos.trabajadores.reduce((m, t) => m.set(t.proyecto, [...(m.get(t.proyecto) || []), t]), new Map());

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <Card style={{ marginBottom: 14 }}>
        <SectionTitle>Novedades de nómina del personal de obra</SectionTitle>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>
          Reporta los días y las horas extra de tu personal en cada quincena. Talento Humano las recibe hasta el <b>5</b> y el <b>20</b> de cada mes y las pasa a la nómina.
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          {datos.quincenas.map((q) => (
            <button key={q} onClick={() => { setAbierto(null); setAviso(""); cargar(q); }}
              style={{ ...BTN_SM, background: q === quincena ? C.blue : "none", color: q === quincena ? "#fff" : C.muted }}>
              {etiquetaQuincena(q)}
            </button>
          ))}
        </div>
      </Card>

      {aviso && <div style={{ background: C.green + "18", color: C.green, borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 12 }}>✅ {aviso}</div>}
      {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}

      {datos.trabajadores.length === 0 ? (
        <Card><div style={{ color: C.muted, fontSize: 14 }}>No tienes personal de obra a cargo en la nómina. Si es un error, avísale a Talento Humano.</div></Card>
      ) : (
        [...porProyecto].map(([proyecto, lista]) => (
          <Card key={proyecto} style={{ marginBottom: 14 }}>
            <SectionTitle>{proyecto}</SectionTitle>
            {lista.map((t) => {
              const f = filas[t.id];
              const e = t.novedad ? ESTADO[t.novedad.estado] : null;
              const puede = editable(t);
              const resumen = `${f.dias_trabajados || 0} días trabajados${+f.dias_incapacidad ? ` · ${f.dias_incapacidad} incapacidad` : ""}${+f.dias_vacaciones ? ` · ${f.dias_vacaciones} vacaciones` : ""}${horasDe(f) ? ` · ${horasDe(f)} h extra/recargos` : ""}`;
              return (
                <div key={t.id} style={{ borderTop: `1px solid ${C.border}`, padding: "10px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, cursor: "pointer" }} onClick={() => setAbierto(abierto === t.id ? null : t.id)}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{t.nombre}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{t.cargo || "—"} · {resumen}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {e ? <span style={{ background: e.color + "1c", color: e.color, borderRadius: 20, padding: "3px 10px", fontSize: 11.5, fontWeight: 600 }}>{e.label}</span>
                        : <span style={{ fontSize: 11.5, color: C.muted }}>Sin reportar</span>}
                      <div style={{ fontSize: 11.5, color: C.blueMid || C.blue, marginTop: 4 }}>{abierto === t.id ? "Cerrar" : puede ? "Editar" : "Ver"}</div>
                    </div>
                  </div>
                  {t.cerrada && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Esta quincena ya se envió a aprobación; para cambiarla avísale a Talento Humano.</div>}
                  {abierto === t.id && (
                    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                        {[["dias_trabajados", "Días trabajados"], ["dias_incapacidad", "Incapacidad"], ["dias_vacaciones", "Vacaciones"]].map(([k, l]) => (
                          <label key={k} style={{ fontSize: 12, color: C.muted }}>{l}
                            <input type="number" min="0" max="15" step="0.5" inputMode="decimal" disabled={!puede} value={f[k]}
                              onChange={(ev) => cambiar(t.id, k, ev.target.value)} style={{ ...INP, marginTop: 3 }} />
                          </label>
                        ))}
                      </div>
                      {totalDias(f) > 15 && <div style={{ color: C.danger, fontSize: 12 }}>Entre trabajados, incapacidad y vacaciones no pueden pasar de 15 días.</div>}
                      <div style={{ fontSize: 12, color: C.muted }}>Ausencias o permisos no pagados: bájalos de los días trabajados y explícalo en la nota.</div>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, marginBottom: 6 }}>Horas extra y recargos (número de horas)</div>
                        {TIPOS_HORA.map(([k, l]) => (
                          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ flex: 1, fontSize: 12.5, color: C.text }}>{l}</span>
                            <input type="number" min="0" step="0.5" inputMode="decimal" disabled={!puede} value={f.horas[k]} placeholder="0"
                              onChange={(ev) => cambiarHora(t.id, k, ev.target.value)} style={{ ...INP, width: 90 }} />
                          </div>
                        ))}
                      </div>
                      <label style={{ fontSize: 12, color: C.muted }}>Nota para Talento Humano (opcional)
                        <input disabled={!puede} value={f.nota} onChange={(ev) => cambiar(t.id, "nota", ev.target.value)}
                          placeholder="Ej. no vino el 20 (permiso no remunerado)" style={{ ...INP, marginTop: 3 }} />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        ))
      )}

      {editables.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <button disabled={trabajando} onClick={() => guardar(true)}
            style={{ background: C.blue, border: "none", color: "#fff", borderRadius: 12, padding: "12px 18px", cursor: "pointer", fontSize: 15, fontWeight: 600, flex: 1, opacity: trabajando ? 0.6 : 1 }}>
            {trabajando ? "Enviando..." : "Enviar a nómina"}
          </button>
          <button disabled={trabajando} onClick={() => guardar(false)} style={{ ...BTN_SM, padding: "0 16px" }}>Guardar borrador</button>
        </div>
      )}
    </div>
  );
}
