import { useEffect, useState } from "react";
import { C, INP, BTN_SM } from "../lib/constants.js";
import { Card, SectionTitle } from "./ui.jsx";
import { cargarNovedadesObra, guardarNovedadesObra, TIPOS_HORA } from "../lib/nominaObra.js";
import { NOVEDADES_DIA, diasQuincena, diaSemana, esDominicalOFestivo, clasificarTurno, descansoSugerido, totalesPlanilla, HORAS_ORDINARIAS_DIA } from "../lib/planillaNomina.js";

// Novedades de nómina (Miguel, 2026-11-19): el ingeniero reporta las
// novedades de su personal de obra para cada quincena; Talento Humano (Kelly)
// las pasa a la nómina en SYD Gestión. Kelly recibe novedades hasta el 5 y el
// 20 de cada mes. Desde el 2026-11-20 se llena como la planilla de Excel que
// ya usaban (día por día: novedad, entrada y salida) y la app calcula los
// días, las horas extra y los recargos (ver lib/planillaNomina.js).
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

function filaDesde(t, inicio) {
  const n = t.novedad;
  const previa = Object.fromEntries((Array.isArray(n?.planilla) ? n.planilla : []).map((d) => [d.fecha, d]));
  return {
    trabajador_id: t.id,
    planilla: diasQuincena(inicio).map((fecha) => {
      const d = previa[fecha] || {};
      return { fecha, novedad: d.novedad || "", entrada: d.entrada || "", salida: d.salida || "", descanso: d.descanso ?? "", nota: d.nota || "" };
    }),
    nota: n?.nota || "",
  };
}
const ETQ_HORA = Object.fromEntries(TIPOS_HORA);
const resumenHoras = (h) => Object.entries(h || {}).filter(([, v]) => v > 0).map(([k, v]) => `${v} h ${ETQ_HORA[k].toLowerCase()}`).join(" · ");

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
    setFilas(Object.fromEntries(d.trabajadores.map((t) => [t.id, filaDesde(t, d.inicio)])));
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
  const cambiarDia = (id, i, cambios) => setFilas((f) => {
    const planilla = f[id].planilla.map((d, j) => {
      if (j !== i) return d;
      const nuevo = { ...d, ...cambios };
      // Descanso sugerido mientras el ingeniero no lo haya escrito a mano.
      if (("entrada" in cambios || "salida" in cambios) && (d.descanso === "" || d.descansoAuto)) {
        nuevo.descanso = descansoSugerido(nuevo.entrada, nuevo.salida); nuevo.descansoAuto = true;
      }
      if ("descanso" in cambios) nuevo.descansoAuto = false;
      return nuevo;
    });
    return { ...f, [id]: { ...f[id], planilla } };
  });
  // Llenar de una vez: el mismo horario en los días que estén sin novedad.
  const llenarHorario = (id, entrada, salida, soloLaborales) => setFilas((f) => ({
    ...f, [id]: { ...f[id], planilla: f[id].planilla.map((d) => (d.novedad === "" && (!soloLaborales || !esDominicalOFestivo(d.fecha))
      ? { ...d, novedad: "trabajo", entrada, salida, descanso: descansoSugerido(entrada, salida), descansoAuto: true } : d)) },
  }));
  const totales = (f) => totalesPlanilla(f.planilla);

  const guardar = async (enviar) => {
    const malo = editables.find((t) => totales(filas[t.id]).errores.length);
    if (malo) { setError(`A ${malo.nombre} le falta la hora de entrada o de salida en algún día marcado "Trabajó".`); setAbierto(malo.id); return; }
    const lista = editables.map((t) => {
      const f = filas[t.id];
      const tot = totales(f);
      return {
        trabajador_id: f.trabajador_id, dias_trabajados: tot.dias_trabajados, dias_incapacidad: tot.dias_incapacidad,
        dias_vacaciones: tot.dias_vacaciones, horas: tot.horas, nota: f.nota,
        planilla: f.planilla.filter((d) => d.novedad).map(({ fecha, novedad, entrada, salida, descanso, nota }) =>
          ({ fecha, novedad, ...(novedad === "trabajo" ? { entrada, salida, descanso: +descanso || 0 } : {}), ...(nota ? { nota } : {}) })),
      };
    });
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
          Llena la planilla de cada trabajador como en el Excel: por cada día, la novedad y, si trabajó, la hora de entrada y de salida. Los días que dejes en "Día normal" se pagan normal. La app calcula los días, las horas extra y los recargos nocturnos y dominicales/festivos. Talento Humano las recibe hasta el <b>5</b> y el <b>20</b> de cada mes.
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
              const tot = totales(f);
              const resumen = `${tot.dias_trabajados} días pagados${tot.dias_incapacidad ? ` · ${tot.dias_incapacidad} incapacidad` : ""}${tot.dias_vacaciones ? ` · ${tot.dias_vacaciones} vacaciones` : ""}${tot.dias_no_pagados ? ` · ${tot.dias_no_pagados} sin pago` : ""}`;
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
                    <PlanillaTrabajador f={f} tot={tot} puede={puede}
                      onDia={(i2, c) => cambiarDia(t.id, i2, c)} onNota={(v) => cambiar(t.id, "nota", v)}
                      onLlenar={(e2, s2, lab) => llenarHorario(t.id, e2, s2, lab)} />
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

function PlanillaTrabajador({ f, tot, puede, onDia, onNota, onLlenar }) {
  const [entrada, setEntrada] = useState("07:00");
  const [salida, setSalida] = useState("17:00");
  const chico = { ...INP, padding: "6px 8px", fontSize: 13 };
  return (
    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
      {puede && (
        <div style={{ background: C.blue + "0d", borderRadius: 10, padding: 10, fontSize: 12.5, color: C.text }}>
          <div style={{ marginBottom: 6 }}>Llenar rápido los días que están en "Día normal" con este horario:</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <input type="time" value={entrada} onChange={(e) => setEntrada(e.target.value)} style={{ ...chico, width: 110 }} />
            <span>a</span>
            <input type="time" value={salida} onChange={(e) => setSalida(e.target.value)} style={{ ...chico, width: 110 }} />
            <button style={BTN_SM} onClick={() => onLlenar(entrada, salida, true)}>Lunes a sábado</button>
            <button style={BTN_SM} onClick={() => onLlenar(entrada, salida, false)}>Todos los días</button>
          </div>
        </div>
      )}
      {f.planilla.map((d, i) => {
        const fest = esDominicalOFestivo(d.fecha);
        const c = d.novedad === "trabajo" ? clasificarTurno(d.fecha, d.entrada, d.salida, d.descanso) : null;
        return (
          <div key={d.fecha} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 62, fontSize: 12.5, color: fest ? C.danger : C.text, fontWeight: fest ? 600 : 400, flexShrink: 0 }}>
                {diaSemana(d.fecha)} {Number(d.fecha.slice(8))}{fest && diaSemana(d.fecha) !== "Dom" ? " F" : ""}
              </div>
              <select disabled={!puede} value={d.novedad} onChange={(e) => onDia(i, { novedad: e.target.value })} style={{ ...chico, flex: 1, minWidth: 0 }}>
                {NOVEDADES_DIA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {d.novedad === "trabajo" && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", margin: "6px 0 0 70px", fontSize: 12, color: C.muted }}>
                <input type="time" disabled={!puede} value={d.entrada} onChange={(e) => onDia(i, { entrada: e.target.value })} style={{ ...chico, width: 130 }} />
                a
                <input type="time" disabled={!puede} value={d.salida} onChange={(e) => onDia(i, { salida: e.target.value })} style={{ ...chico, width: 130 }} />
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>descanso
                  <input type="number" min="0" max="4" step="0.5" inputMode="decimal" disabled={!puede} value={d.descanso}
                    onChange={(e) => onDia(i, { descanso: e.target.value })} style={{ ...chico, width: 58 }} /> h
                </label>
                <div style={{ width: "100%", color: c ? C.muted : C.danger }}>
                  {c ? `${c.total} h trabajadas${resumenHoras(c.horas) ? ` · ${resumenHoras(c.horas)}` : ""}` : "Falta la hora de entrada o de salida."}
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div style={{ background: C.green + "12", borderRadius: 10, padding: 10, fontSize: 12.5, color: C.text, lineHeight: 1.6 }}>
        <b>Total de la quincena:</b> {tot.dias_trabajados} días pagados
        {tot.dias_incapacidad ? ` · ${tot.dias_incapacidad} de incapacidad` : ""}{tot.dias_vacaciones ? ` · ${tot.dias_vacaciones} de vacaciones` : ""}
        {tot.dias_no_pagados ? ` · ${tot.dias_no_pagados} sin pago (permiso no remunerado o ausencia)` : ""}
        <div>{resumenHoras(tot.horas) || "Sin horas extra ni recargos."}</div>
        <div style={{ fontSize: 11.5, color: C.muted }}>Nocturno: 7:00 p. m. a 6:00 a. m. · Extra: lo que pase de {HORAS_ORDINARIAS_DIA} h en el turno · "F" = festivo.</div>
      </div>
      <label style={{ fontSize: 12, color: C.muted }}>Nota para Talento Humano (opcional)
        <input disabled={!puede} value={f.nota} onChange={(ev) => onNota(ev.target.value)}
          placeholder="Ej. incapacidad del 3 al 5, adjunta en físico" style={{ ...INP, marginTop: 3 }} />
      </label>
    </div>
  );
}
