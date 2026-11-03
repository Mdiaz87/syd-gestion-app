import { useState, useEffect, useMemo } from "react";
import { C, INP, BTN_SM, ACTIVIDADES_CATALOGO, UNIDADES, ETAPAS } from "../lib/constants.js";
import { loadPlanesSemanales, guardarPlanSemanal, loadObligacionesInformes } from "../lib/api.js";
import { Card, SectionTitle } from "./ui.jsx";
import { actividadesRecientes, cotejarPlan, revisarPlan, estadoEntrega, hoyColombia, lunesDeFecha, sumarDias, esFestivo } from "../../supabase/functions/_shared/plan-semanal.js";

// ── PLAN SEMANAL DE LOS INGENIEROS ────────────────────────────────────────────
// El ingeniero propone el lunes (martes si el lunes es festivo) lo que se hará
// en la semana. Una vez enviado queda fijo y se coteja con lo que los
// coordinadores registran a diario: qué se cumplió, qué no y por qué.

const ESTADOS = {
  cumplida: { label: "Cumplida", color: C.green },
  en_curso: { label: "En curso", color: C.blueMid },
  por_iniciar: { label: "Por iniciar", color: C.muted },
  en_riesgo: { label: "En riesgo", color: C.warn },
  parcial: { label: "Parcial", color: C.warn },
  incumplida: { label: "No se hizo", color: C.danger },
};
const ENTREGA = {
  enviado: { label: "Enviado", color: C.green },
  enviado_tarde: { label: "Enviado tarde", color: C.warn },
  pendiente: { label: "Pendiente", color: C.muted },
  vencido: { label: "Sin enviar (vencido)", color: C.danger },
  no_aplica: { label: "Antes del plan", color: C.muted },
};
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const corta = (s) => `${+s.slice(8, 10)} ${MESES_CORTOS[+s.slice(5, 7) - 1]}`;
const etiquetaSemana = (l) => `${corta(l)} – ${corta(sumarDias(l, 6))}`;
const Pill = ({ info }) => <span style={{ background: info.color + "18", color: info.color, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{info.label}</span>;
const nuevaFila = () => ({ id: crypto.randomUUID(), actividad: "", etapa: "General", meta: "", unidad: UNIDADES[0], equipo: "", observaciones: "", motivo: "" });
const OTRA = "__otra__";

function Editor({ plan, project, semana, usuario, sugerencias, onGuardado }) {
  const [filas, setFilas] = useState(plan?.actividades?.length ? plan.actividades : [nuevaFila()]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const set = (id, k, v) => setFilas(fs => fs.map(f => f.id === id ? { ...f, [k]: v } : f));

  const guardar = async (estado) => {
    setError("");
    const limpias = filas.filter(f => String(f.actividad).trim());
    if (estado === "enviado") {
      if (!limpias.length) { setError("⚠️ Agrega al menos una actividad."); return; }
      if (limpias.some(f => !(+f.meta > 0))) { setError("⚠️ Cada actividad necesita una meta (cantidad): sin ella no se puede medir si se cumplió."); return; }
    }
    setGuardando(true);
    const ok = await guardarPlanSemanal({
      project, semana, autor_id: usuario.id, autor: usuario.nombre, actividades: limpias, estado,
      enviado_at: estado === "enviado" ? new Date().toISOString() : null,
    });
    setGuardando(false);
    if (!ok) { setError("⚠️ No se pudo guardar. Intenta de nuevo."); return; }
    onGuardado(estado === "enviado" ? "✅ Plan enviado. Desde ahora se coteja con los registros de los coordinadores." : "📝 Borrador guardado.");
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <SectionTitle>Actividades planeadas — {project}</SectionTitle>
      <div style={{ color: C.muted, fontSize: 12, marginBottom: 12 }}>Usa el mismo nombre de actividad que usan los coordinadores: así el cotejo es automático. Al enviarlo, el plan queda fijo.</div>
      <datalist id="actividades-obra">{sugerencias.map(s => <option key={s} value={s} />)}</datalist>
      <div style={{ display: "grid", gap: 10 }}>
        {filas.map(f => {
          const delCatalogo = ACTIVIDADES_CATALOGO.includes(f.actividad);
          return (
            <div key={f.id} style={{ display: "grid", gridTemplateColumns: "minmax(170px,2fr) minmax(90px,1fr) 90px 90px minmax(110px,1fr) 34px", gap: 8, alignItems: "end", borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
              <div>
                <label style={{ color: C.muted, fontSize: 11 }}>Actividad</label>
                <select style={INP} value={delCatalogo ? f.actividad : (f.actividad || f.__otra ? OTRA : "")} onChange={e => e.target.value === OTRA ? setFilas(fs => fs.map(x => x.id === f.id ? { ...x, actividad: "", __otra: true } : x)) : setFilas(fs => fs.map(x => x.id === f.id ? { ...x, actividad: e.target.value, __otra: false } : x))}>
                  <option value="">Escoge…</option>
                  {ACTIVIDADES_CATALOGO.filter(a => a !== "Otro").map(a => <option key={a}>{a}</option>)}
                  <option value={OTRA}>Otra…</option>
                </select>
                {!delCatalogo && (f.__otra || f.actividad) && <input style={{ ...INP, marginTop: 4 }} list="actividades-obra" placeholder="Escribe o escoge la que usa el coordinador" value={f.actividad} onChange={e => set(f.id, "actividad", e.target.value)} />}
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 11 }}>Etapa</label>
                <select style={INP} value={f.etapa} onChange={e => set(f.id, "etapa", e.target.value)}>{ETAPAS.map(x => <option key={x}>{x}</option>)}</select>
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 11 }}>Meta</label>
                <input style={INP} type="number" min="0" value={f.meta} onChange={e => set(f.id, "meta", e.target.value)} />
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 11 }}>Unidad</label>
                <select style={INP} value={f.unidad} onChange={e => set(f.id, "unidad", e.target.value)}>{UNIDADES.filter(u => u !== "Otro").map(u => <option key={u}>{u}</option>)}</select>
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 11 }}>Equipo / observación</label>
                <input style={INP} value={f.observaciones} onChange={e => set(f.id, "observaciones", e.target.value)} />
              </div>
              <button title="Quitar" onClick={() => setFilas(fs => fs.filter(x => x.id !== f.id))} style={{ ...BTN_SM, color: C.danger, borderColor: C.border, padding: "6px 8px" }}>✕</button>
            </div>
          );
        })}
      </div>
      <button onClick={() => setFilas(fs => [...fs, nuevaFila()])} style={{ ...BTN_SM, marginTop: 10, color: C.blueMid, borderColor: C.blueMid }}>+ Agregar actividad</button>
      {error && <div style={{ color: C.danger, fontSize: 13, marginTop: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button onClick={() => guardar("borrador")} disabled={guardando} style={{ ...BTN_SM, flex: 1, padding: 11 }}>Guardar borrador</button>
        <button onClick={() => guardar("enviado")} disabled={guardando} style={{ background: guardando ? C.border : C.blue, color: "#fff", fontWeight: 700, border: "none", borderRadius: 12, padding: 11, flex: 2, cursor: guardando ? "default" : "pointer" }}>{guardando ? "Guardando..." : "Enviar plan"}</button>
      </div>
    </Card>
  );
}

function Cotejo({ plan, cotejo, puedeEscribir, onMotivo }) {
  return (
    <Card style={{ marginBottom: 16 }}>
      <SectionTitle>Planeado vs. registrado por el coordinador</SectionTitle>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: C.muted, fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: .4 }}>
              {["Actividad", "Meta", "Ejecutado", "Avance", "Estado", "Días con registro", "¿Por qué?"].map(h => <th key={h} style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}` }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {cotejo.filas.map(f => {
              const falla = f.estado === "incumplida" || f.estado === "parcial" || f.estado === "en_riesgo";
              return (
                <tr key={f.id} style={{ borderBottom: `1px solid ${C.border}`, verticalAlign: "top" }}>
                  <td style={{ padding: 8, fontWeight: 600, color: C.text }}>{f.actividad}{f.etapa && f.etapa !== "General" ? <span style={{ color: C.muted, fontWeight: 400 }}> · {f.etapa}</span> : null}</td>
                  <td style={{ padding: 8, whiteSpace: "nowrap" }}>{f.meta != null ? `${f.meta} ${f.unidad}` : "—"}</td>
                  <td style={{ padding: 8, whiteSpace: "nowrap" }}>{f.ejecutado != null ? `${Math.round(f.ejecutado * 10) / 10} ${f.unidad}` : f.otraUnidad ? "Otra unidad" : "—"}</td>
                  <td style={{ padding: 8 }}>{f.pct != null ? `${f.pct}%` : "—"}</td>
                  <td style={{ padding: 8 }}><Pill info={ESTADOS[f.estado]} /></td>
                  <td style={{ padding: 8 }}>{f.diasConRegistro}</td>
                  <td style={{ padding: 8, minWidth: 200 }}>
                    {falla || f.motivo ? (puedeEscribir
                      ? <input style={{ ...INP, fontSize: 12, padding: "5px 8px" }} placeholder="Explica el motivo" defaultValue={f.motivo || ""} onBlur={e => { if (e.target.value.trim() !== (f.motivo || "")) onMotivo(f.id, e.target.value.trim()); }} />
                      : <span style={{ color: f.motivo ? C.text : C.muted }}>{f.motivo || "Sin explicar"}</span>) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(cotejo.causas.length > 0 || Object.keys(cotejo.noPlaneadas).length > 0) && (
        <div style={{ background: C.bgCard2, borderRadius: 8, padding: 12, marginTop: 14, fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: C.blue, marginBottom: 6 }}>Lo que muestran los registros de la semana</div>
          {cotejo.causas.length > 0 && <div style={{ marginBottom: 6 }}>{cotejo.causas.join(" · ")}.</div>}
          {Object.keys(cotejo.noPlaneadas).length > 0 && <div style={{ marginBottom: 6 }}><b>Hecho sin estar en el plan:</b> {Object.keys(cotejo.noPlaneadas).join(", ")}.</div>}
          {cotejo.diasSinRegistro.length > 0 && <div style={{ marginBottom: 6 }}><b>Días sin registro:</b> {cotejo.diasSinRegistro.map(corta).join(", ")}.</div>}
          {cotejo.novedades.length > 0 && (
            <div><b>Novedades del coordinador:</b>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{cotejo.novedades.map((n, i) => <li key={i}>{corta(n.fecha)}: {n.texto}</li>)}</ul>
            </div>
          )}
        </div>
      )}
      {plan.autor && <div style={{ color: C.muted, fontSize: 12, marginTop: 10 }}>Plan de {plan.autor}{plan.enviado_at ? `, enviado el ${new Date(plan.enviado_at).toLocaleDateString("es-CO")}` : ""}.</div>}
    </Card>
  );
}

function Revision({ plan, revision, usuario, onVeredicto }) {
  const [comentario, setComentario] = useState(plan.revision?.comentario || "");
  const COLOR = { alta: C.danger, media: C.warn, info: C.muted };
  const esDirectivo = usuario.rol === "Directivo";
  return (
    <Card style={{ marginBottom: 16 }}>
      <SectionTitle>¿El plan es adecuado?</SectionTitle>
      <div style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>Revisión automática contra las últimas 8 semanas de la obra y lo que quedó pendiente de la semana pasada. Son señales para decidir; la decisión es de Gerencia.</div>
      {revision.avisos.length === 0
        ? <div style={{ color: C.green, fontSize: 13, fontWeight: 600 }}>✅ Sin observaciones.</div>
        : <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>{revision.avisos.map((a, i) => <li key={i} style={{ color: COLOR[a.nivel], marginBottom: 3 }}><span style={{ color: C.text }}>{a.texto}</span></li>)}</ul>}
      {plan.revision && (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          <b style={{ color: plan.revision.veredicto === "adecuado" ? C.green : C.warn }}>{plan.revision.veredicto === "adecuado" ? "✅ Adecuado" : "✏️ Hay que ajustar"}</b> — {plan.revision.por}{plan.revision.comentario ? `: ${plan.revision.comentario}` : ""}
        </div>
      )}
      {esDirectivo && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ ...INP, flex: "1 1 220px" }} placeholder="Comentario para el ingeniero (opcional)" value={comentario} onChange={e => setComentario(e.target.value)} />
          <button onClick={() => onVeredicto("adecuado", comentario)} style={{ ...BTN_SM, color: C.green, borderColor: C.green, fontWeight: 700 }}>✅ Adecuado</button>
          <button onClick={() => onVeredicto("ajustar", comentario)} style={{ ...BTN_SM, color: C.warn, borderColor: C.warn, fontWeight: 700 }}>✏️ Hay que ajustar</button>
        </div>
      )}
    </Card>
  );
}

export function PlanSemanal({ reports, usuario }) {
  const hoy = hoyColombia();
  const [semana, setSemana] = useState(lunesDeFecha(hoy));
  const [planes, setPlanes] = useState(null);
  const [obligaciones, setObligaciones] = useState([]);
  const [proyecto, setProyecto] = useState(null);
  const [reabierto, setReabierto] = useState(false);
  const [aviso, setAviso] = useState(null);

  const recargar = () => loadPlanesSemanales().then(setPlanes);
  useEffect(() => { recargar(); loadObligacionesInformes().then(setObligaciones); }, []);

  const proyectos = useMemo(() => {
    const conPlan = obligaciones.filter(o => o.plan_semanal).map(o => o.project);
    const limite = usuario.proyectosACargo?.length ? usuario.proyectosACargo : usuario.proyectoAsignado;
    return limite?.length ? conPlan.filter(p => limite.includes(p)) : conPlan;
  }, [obligaciones, usuario]);

  useEffect(() => { if (!proyecto && proyectos.length === 1) setProyecto(proyectos[0]); }, [proyectos, proyecto]);
  useEffect(() => { setReabierto(false); }, [proyecto, semana]);

  const buscar = (p, s) => (planes || []).find(x => x.project === p && String(x.semana).slice(0, 10) === s) || null;
  const mostrarAviso = (t) => { setAviso(t); setTimeout(() => setAviso(null), 6000); };

  if (!planes) return <div style={{ color: C.muted }}>Cargando...</div>;

  const plan = proyecto ? buscar(proyecto, semana) : null;
  const enviado = plan?.estado === "enviado";
  const puedeEscribir = usuario.rol === "Directivo" || usuario.rol === "Ingeniero";
  const cotejo = enviado ? cotejarPlan(plan, reports, hoy) : null;
  const revision = plan?.actividades?.length ? revisarPlan(plan, reports, buscar(proyecto, sumarDias(semana, -7)), hoy) : null;
  const esFutura = semana > lunesDeFecha(hoy);

  const guardarMotivo = async (id, motivo) => {
    const ok = await guardarPlanSemanal({ ...plan, actividades: plan.actividades.map(a => a.id === id ? { ...a, motivo } : a) });
    if (ok) recargar(); else mostrarAviso("⚠️ No se pudo guardar el motivo.");
  };
  const guardarVeredicto = async (veredicto, comentario) => {
    const ok = await guardarPlanSemanal({ ...plan, revision: { veredicto, comentario: comentario.trim(), por: usuario.nombre, fecha: new Date().toISOString() } });
    if (ok) { recargar(); mostrarAviso("✅ Revisión guardada."); } else mostrarAviso("⚠️ No se pudo guardar la revisión.");
  };
  const reabrir = async () => {
    const ok = await guardarPlanSemanal({ ...plan, estado: "borrador", enviado_at: null });
    if (ok) { recargar(); setReabierto(true); mostrarAviso("El plan quedó abierto para corregirlo; hay que volver a enviarlo."); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ color: C.blue, margin: 0, fontWeight: 800 }}>🗓️ Plan semanal</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setSemana(sumarDias(semana, -7))} style={BTN_SM}>←</button>
          <span style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>Semana {etiquetaSemana(semana)}</span>
          <button onClick={() => setSemana(sumarDias(semana, 7))} style={BTN_SM}>→</button>
        </div>
      </div>
      <div style={{ color: C.muted, fontSize: 12, marginBottom: 14 }}>
        Se entrega el lunes{esFestivo(semana) ? `; esta semana el lunes ${corta(semana)} es festivo, así que vence el martes ${corta(sumarDias(semana, 1))}` : " (el martes si el lunes es festivo)"}.
      </div>
      {aviso && <div style={{ background: C.bgCard2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 13 }}>{aviso}</div>}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: C.muted, fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: .4 }}>
                {["Proyecto", "Entrega", "Actividades", "Cumplidas", "En riesgo / no hechas", "Revisión"].map(h => <th key={h} style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}` }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {proyectos.map(p => {
                const pl = buscar(p, semana);
                const ent = estadoEntrega(pl, semana, hoy);
                const co = pl?.estado === "enviado" ? cotejarPlan(pl, reports, hoy) : null;
                return (
                  <tr key={p} onClick={() => setProyecto(p)} style={{ cursor: "pointer", borderBottom: `1px solid ${C.border}`, background: proyecto === p ? C.blue + "0c" : undefined }}>
                    <td style={{ padding: 8, fontWeight: 700, color: C.blue }}>{p}</td>
                    <td style={{ padding: 8 }}><Pill info={ENTREGA[ent.estado]} /></td>
                    <td style={{ padding: 8 }}>{pl?.actividades?.length || "—"}</td>
                    <td style={{ padding: 8 }}>{co ? `${co.cumplidas} de ${co.total}` : "—"}</td>
                    <td style={{ padding: 8, color: co && (co.incumplidas + co.enRiesgo + co.parciales) ? C.danger : C.muted, fontWeight: co && (co.incumplidas + co.enRiesgo + co.parciales) ? 700 : 400 }}>{co ? co.incumplidas + co.enRiesgo + co.parciales : "—"}</td>
                    <td style={{ padding: 8 }}>{pl?.revision ? (pl.revision.veredicto === "adecuado" ? "✅" : "✏️") : "—"}</td>
                  </tr>
                );
              })}
              {!proyectos.length && <tr><td colSpan={6} style={{ padding: 16, color: C.muted, textAlign: "center" }}>No tienes proyectos con plan semanal.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {proyecto && (
        <>
          {(!enviado || reabierto) && puedeEscribir && !(semana < lunesDeFecha(hoy) && !plan)
            ? <Editor key={`${proyecto}-${semana}-${plan?.updated_at || ""}`} plan={plan} project={proyecto} semana={semana} usuario={usuario} sugerencias={actividadesRecientes(reports, proyecto, hoy)} onGuardado={(t) => { recargar(); mostrarAviso(t); }} />
            : !plan && <Card style={{ marginBottom: 16 }}><div style={{ color: C.muted, fontSize: 13 }}>{proyecto}: no se envió plan esa semana.</div></Card>}
          {enviado && cotejo && !esFutura && <Cotejo plan={plan} cotejo={cotejo} puedeEscribir={puedeEscribir} onMotivo={guardarMotivo} />}
          {revision && <Revision key={plan.updated_at} plan={plan} revision={revision} usuario={usuario} onVeredicto={guardarVeredicto} />}
          {enviado && usuario.rol === "Directivo" && (
            <button onClick={reabrir} style={{ ...BTN_SM, color: C.muted }}>Reabrir plan para corregirlo</button>
          )}
        </>
      )}
    </div>
  );
}
