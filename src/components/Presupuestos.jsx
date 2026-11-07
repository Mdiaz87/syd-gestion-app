import { useState, useEffect, useMemo, Fragment } from "react";
import { C, INP, BTN_SM, PROJECTS, PROYECTOS_SIN_OBRA, UNIDADES } from "../lib/constants.js";
import { fmt } from "../lib/helpers.js";
import { loadPresupuestos, loadPartidas, guardarPresupuesto, guardarPartidas, borrarPresupuesto, crearVersionPresupuesto, loadEjecucionManual, guardarEjecucionManual, borrarEjecucionManual, asignarPartidaCuenta } from "../lib/api.js";
import { controlPresupuesto, codigos, hojas, valorCuenta } from "../lib/controlPresupuesto.js";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, SectionTitle } from "./ui.jsx";

// ── PRESUPUESTOS DE OBRA (etapa 1) ────────────────────────────────────────────
// Cada ingeniero arma el presupuesto de sus proyectos: fase preoperativa y
// operativa, actividades con subactividades, cantidad x precio unitario y
// fechas. Lo envía a aprobación; solo Miguel (super admin) lo aprueba. Un
// presupuesto vigente no se edita: se crea una versión nueva a partir de él.

const FASES = [
  { key: "pre_operativa", label: "Fase preoperativa", prefijo: "PO" },
  { key: "operativa", label: "Fase operativa", prefijo: "" },
];
const ESTADOS = {
  borrador: { label: "Borrador", color: C.muted },
  en_revision: { label: "En aprobación", color: C.warn },
  vigente: { label: "Vigente", color: C.green },
  reemplazado: { label: "Reemplazado", color: C.muted },
};
const Pill = ({ e }) => { const i = ESTADOS[e] || ESTADOS.borrador; return <span style={{ background: i.color + "18", color: i.color, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{i.label}</span>; };
const num = (v) => (v === "" || v == null ? 0 : +v || 0);
const fechaCorta = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("es-CO") : "—");
const meses = (a, b) => {
  if (!a || !b || b < a) return null;
  const [ya, ma] = a.split("-").map(Number), [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma) + 1;
};
const nuevaPartida = (fase, padre_id = null) => ({ id: crypto.randomUUID(), fase, padre_id, nombre: "", unidad: UNIDADES[0], cantidad: "", precio_unitario: "", fecha_inicio: "", fecha_fin: "", notas: "", _nueva: true });

// Total de una partida: si tiene subactividades, la suma de ellas; si no, cantidad x precio unitario.
const totalesPorPartida = (partidas) => {
  const hijos = {};
  partidas.forEach(p => { if (p.padre_id) (hijos[p.padre_id] = hijos[p.padre_id] || []).push(p); });
  const t = {};
  partidas.filter(p => p.padre_id).forEach(p => { t[p.id] = num(p.cantidad) * num(p.precio_unitario); });
  partidas.filter(p => !p.padre_id).forEach(p => {
    t[p.id] = hijos[p.id]?.length ? hijos[p.id].reduce((s, h) => s + t[h.id], 0) : num(p.cantidad) * num(p.precio_unitario);
  });
  return { t, hijos };
};

function Resumen({ pres, partidas }) {
  const { t } = totalesPorPartida(partidas);
  const porFase = FASES.map(f => ({ ...f, total: partidas.filter(p => !p.padre_id && p.fase === f.key).reduce((s, p) => s + t[p.id], 0) }));
  const total = porFase.reduce((s, f) => s + f.total, 0);
  const m = meses(pres.fecha_inicio, pres.fecha_fin);
  const caja = (label, valor, sub) => (
    <div style={{ background: C.bgCard2, borderRadius: 10, padding: "10px 14px", minWidth: 150, flex: "1 1 150px" }}>
      <div style={{ color: C.muted, fontSize: 11.5 }}>{label}</div>
      <div style={{ color: C.blue, fontWeight: 800, fontSize: 18 }}>{valor}</div>
      {sub && <div style={{ color: C.muted, fontSize: 11 }}>{sub}</div>}
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
      {caja("Presupuesto total", fmt(total) === "-" ? "$ 0" : fmt(total))}
      {porFase.map(f => caja(f.label, fmt(f.total) === "-" ? "$ 0" : fmt(f.total), total ? `${Math.round(f.total / total * 1000) / 10}% del total` : null))}
      {caja("Plazo", m ? `${m} mes${m === 1 ? "" : "es"}` : "—", pres.fecha_inicio ? `${fechaCorta(pres.fecha_inicio)} – ${fechaCorta(pres.fecha_fin)}` : "Sin fechas")}
    </div>
  );
}

function TablaPartidas({ partidas, setPartidas, editable }) {
  const { t, hijos } = totalesPorPartida(partidas);
  const set = (id, k, v) => setPartidas(ps => ps.map(p => p.id === id ? { ...p, [k]: v } : p));
  const quitar = (id) => setPartidas(ps => ps.filter(p => p.id !== id && p.padre_id !== id));
  const mover = (id, dir) => setPartidas(ps => {
    const p = ps.find(x => x.id === id);
    const hermanos = ps.filter(x => x.fase === p.fase && x.padre_id === p.padre_id);
    const i = hermanos.indexOf(p), j = i + dir;
    if (j < 0 || j >= hermanos.length) return ps;
    const a = ps.indexOf(hermanos[i]), b = ps.indexOf(hermanos[j]);
    const copia = [...ps]; [copia[a], copia[b]] = [copia[b], copia[a]]; return copia;
  });
  const celda = { padding: "5px 6px", borderBottom: `1px solid ${C.border}`, verticalAlign: "middle" };
  const inp = { ...INP, padding: "5px 7px", fontSize: 12.5 };

  const fila = (p, codigo, esSub) => {
    const tieneHijos = !esSub && hijos[p.id]?.length;
    const tot = t[p.id];
    return (
      <tr key={p.id} style={{ background: esSub ? undefined : C.bgCard2 }}>
        <td style={{ ...celda, color: C.muted, fontWeight: esSub ? 400 : 700, whiteSpace: "nowrap", fontSize: 12 }}>{codigo}</td>
        <td style={{ ...celda, paddingLeft: esSub ? 22 : 6, minWidth: 220 }}>
          {editable ? <input style={{ ...inp, fontWeight: esSub ? 400 : 700 }} placeholder={esSub ? "Subactividad" : "Actividad"} value={p.nombre} onChange={e => set(p.id, "nombre", e.target.value)} />
            : <span style={{ fontWeight: esSub ? 400 : 700, fontSize: 13 }}>{p.nombre}</span>}
        </td>
        {tieneHijos ? <td colSpan={3} style={{ ...celda, color: C.muted, fontSize: 11.5 }}>Suma de sus subactividades</td> : <>
          <td style={{ ...celda, width: 90 }}>{editable ? <select style={inp} value={p.unidad || ""} onChange={e => set(p.id, "unidad", e.target.value)}>{[...UNIDADES.filter(u => u !== "Otro"), "GLB", "kg", "m"].map(u => <option key={u}>{u}</option>)}</select> : <span style={{ fontSize: 12.5 }}>{p.unidad}</span>}</td>
          <td style={{ ...celda, width: 100 }}>{editable ? <input style={inp} type="number" min="0" value={p.cantidad ?? ""} onChange={e => set(p.id, "cantidad", e.target.value)} /> : <span style={{ fontSize: 12.5 }}>{p.cantidad}</span>}</td>
          <td style={{ ...celda, width: 130 }}>{editable ? <input style={inp} type="number" min="0" value={p.precio_unitario ?? ""} onChange={e => set(p.id, "precio_unitario", e.target.value)} /> : <span style={{ fontSize: 12.5 }}>{fmt(p.precio_unitario)}</span>}</td>
        </>}
        <td style={{ ...celda, textAlign: "right", fontWeight: esSub ? 500 : 700, whiteSpace: "nowrap", fontSize: 13 }}>{tot ? fmt(tot) : "—"}</td>
        <td style={{ ...celda, width: 140 }}>{editable ? <input style={inp} type="date" value={p.fecha_inicio || ""} onChange={e => set(p.id, "fecha_inicio", e.target.value)} /> : <span style={{ fontSize: 12 }}>{fechaCorta(p.fecha_inicio)}</span>}</td>
        <td style={{ ...celda, width: 140 }}>{editable ? <input style={inp} type="date" value={p.fecha_fin || ""} onChange={e => set(p.id, "fecha_fin", e.target.value)} /> : <span style={{ fontSize: 12 }}>{fechaCorta(p.fecha_fin)}</span>}</td>
        {editable && (
          <td style={{ ...celda, whiteSpace: "nowrap" }}>
            {!esSub && <button title="Agregar subactividad" onClick={() => setPartidas(ps => { const ultimo = [...ps].reverse().find(x => x.id === p.id || x.padre_id === p.id); const i = ps.indexOf(ultimo); return [...ps.slice(0, i + 1), nuevaPartida(p.fase, p.id), ...ps.slice(i + 1)]; })} style={{ ...BTN_SM, padding: "3px 7px", color: C.blueMid, borderColor: C.blueMid }}>+ Sub</button>}
            <button title="Subir" onClick={() => mover(p.id, -1)} style={{ ...BTN_SM, padding: "3px 6px", marginLeft: 4 }}>↑</button>
            <button title="Bajar" onClick={() => mover(p.id, 1)} style={{ ...BTN_SM, padding: "3px 6px", marginLeft: 2 }}>↓</button>
            <button title={esSub ? "Quitar subactividad" : "Quitar actividad y sus subactividades"} onClick={() => quitar(p.id)} style={{ ...BTN_SM, padding: "3px 7px", marginLeft: 2, color: C.danger }}>✕</button>
          </td>
        )}
      </tr>
    );
  };

  return (
    <>
      {FASES.map(f => {
        const acts = partidas.filter(p => p.fase === f.key && !p.padre_id);
        const subtotal = acts.reduce((s, p) => s + t[p.id], 0);
        return (
          <Card key={f.key} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <SectionTitle>{f.label}</SectionTitle>
              <span style={{ fontWeight: 800, color: C.blue }}>{subtotal ? fmt(subtotal) : "$ 0"}</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: C.muted, fontSize: 10.5, textAlign: "left", textTransform: "uppercase", letterSpacing: .4 }}>
                    {["Ítem", "Actividad / subactividad", "Unidad", "Cantidad", "Precio unitario", "Total", "Inicio", "Fin", ...(editable ? [""] : [])].map((h, i) => <th key={i} style={{ padding: "6px", borderBottom: `1px solid ${C.border}`, textAlign: h === "Total" ? "right" : "left" }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {acts.map((a, i) => {
                    const cod = `${f.prefijo}${i + 1}`;
                    return [fila(a, cod, false), ...(hijos[a.id] || []).map((s, j) => fila(s, `${cod}.${j + 1}`, true))];
                  })}
                  {!acts.length && <tr><td colSpan={9} style={{ padding: 14, color: C.muted, textAlign: "center" }}>Sin actividades en esta fase.</td></tr>}
                </tbody>
              </table>
            </div>
            {editable && <button onClick={() => setPartidas(ps => [...ps, nuevaPartida(f.key)])} style={{ ...BTN_SM, marginTop: 10, color: C.blueMid, borderColor: C.blueMid }}>+ Agregar actividad</button>}
          </Card>
        );
      })}
    </>
  );
}


// ── CONTROL: proyectado vs. ejecutado (presupuesto vigente) ───────────────────
const MESES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const etiquetaMes = (m) => `${MESES_C[+m.slice(5, 7) - 1]} ${m.slice(2, 4)}`;
const millones = (v) => `$${Math.round(v / 1e6).toLocaleString("es-CO")}M`;
const hoyCol = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);

function Control({ pres, partidas, cuentas, usuario, puedeEditarProyecto, onRefreshCuentas }) {
  const [manuales, setManuales] = useState([]);
  const [form, setForm] = useState({ linaje: "", mes: hoyCol().slice(0, 7), valor: "", nota: "" });
  const [abierta, setAbierta] = useState(null);
  const recargar = () => loadEjecucionManual(pres.project).then(setManuales);
  useEffect(() => { recargar(); }, [pres.project]);

  const hoy = hoyCol();
  const delProyecto = cuentas.filter(c => c.project === pres.project);
  const c = controlPresupuesto(pres, partidas, delProyecto, manuales, hoy);
  const cod = codigos(partidas);
  const padre = Object.fromEntries(partidas.map(p => [p.id, p]));
  const nombre = (p) => `${cod[p.id]} ${p.padre_id ? `${padre[p.padre_id]?.nombre} › ` : ""}${p.nombre}`;
  const opciones = hojas(partidas);
  const linajes = new Set(opciones.map(p => p.linaje));
  const sinPartida = delProyecto.filter(x => x.estado === "aprobado_total" && !linajes.has(x.partida_linaje));
  const brecha = c.pctFinanciero - c.pctProgramado;
  const kpi = (label, valor, sub, color) => (
    <div style={{ background: C.bgCard2, borderRadius: 10, padding: "10px 14px", flex: "1 1 160px" }}>
      <div style={{ color: C.muted, fontSize: 11.5 }}>{label}</div>
      <div style={{ color: color || C.blue, fontWeight: 800, fontSize: 18 }}>{valor}</div>
      {sub && <div style={{ color: C.muted, fontSize: 11 }}>{sub}</div>}
    </div>
  );
  const agregarManual = async () => {
    if (!form.linaje || !(+form.valor > 0) || !form.mes) { alert("Escoge la actividad, el mes y un valor mayor a cero."); return; }
    if (await guardarEjecucionManual({ project: pres.project, linaje: form.linaje, mes: `${form.mes}-01`, valor: +form.valor, nota: form.nota.trim() || null, creado_por: usuario.id, creado_nombre: usuario.nombre })) {
      setForm(f => ({ ...f, valor: "", nota: "" })); recargar();
    }
  };

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle>Control: proyectado vs. ejecutado</SectionTitle>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          {kpi("Ejecutado (pagado + manual)", fmt(c.ejecutado) === "-" ? "$ 0" : fmt(c.ejecutado), `${c.pctFinanciero.toFixed(1)}% del presupuesto`)}
          {kpi("Programado a hoy", `${c.pctProgramado.toFixed(1)}%`, fmt(c.proyectadoHoy) === "-" ? "$ 0" : fmt(c.proyectadoHoy))}
          {kpi("Diferencia", `${brecha >= 0 ? "+" : ""}${brecha.toFixed(1)} pts`, brecha > 5 ? "Se ha ejecutado más de lo programado" : brecha < -5 ? "Va por debajo de lo programado" : "En línea con lo programado", brecha > 5 ? C.danger : brecha < -5 ? C.warn : C.green)}
          {kpi("Aprobado sin pagar", fmt(c.comprometido) === "-" ? "$ 0" : fmt(c.comprometido), c.tramite ? `${fmt(c.tramite)} más en trámite` : "Nada en trámite")}
        </div>
        {c.mensual.length > 0 && (
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <ComposedChart data={c.mensual.map(m => ({ ...m, mes: etiquetaMes(m.mes) }))} margin={{ left: 10, right: 10, top: 5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="v" tickFormatter={millones} tick={{ fontSize: 11 }} width={64} />
                <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} width={40} />
                <Tooltip formatter={(v, n) => n.includes("acumulado") ? `${v}%` : fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar isAnimationActive={false} yAxisId="v" dataKey="proyectado" name="Proyectado del mes" fill={C.border} />
                <Bar isAnimationActive={false} yAxisId="v" dataKey="real" name="Ejecutado del mes" fill={C.blueMid} />
                <Line isAnimationActive={false} yAxisId="p" type="monotone" dataKey="proyectadoAcum" name="Programado acumulado" stroke={C.muted} strokeDasharray="5 4" dot={false} />
                <Line isAnimationActive={false} yAxisId="p" type="monotone" dataKey="realAcum" name="Ejecutado acumulado" stroke={C.green} strokeWidth={2} dot={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <div style={{ color: C.muted, fontSize: 11.5, marginTop: 6 }}>Lo proyectado reparte el total de cada actividad entre sus fechas de inicio y fin. Lo ejecutado son las cuentas de cobro pagadas, en el mes del pago, más la ejecución manual.</div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <SectionTitle>Por actividad</SectionTitle>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr style={{ color: C.muted, fontSize: 10.5, textAlign: "left", textTransform: "uppercase", letterSpacing: .4 }}>
              {["Actividad", "Presupuesto", "Programado a hoy", "Ejecutado", "Aprobado sin pagar", "En trámite", "% ejecutado", "Saldo", ""].map((h, i) => <th key={i} style={{ padding: 6, borderBottom: `1px solid ${C.border}`, textAlign: i && i < 8 ? "right" : "left" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {c.filas.map(f => (
                <Fragment key={f.partida.linaje}>
                  <tr onClick={() => setAbierta(abierta === f.partida.linaje ? null : f.partida.linaje)} style={{ cursor: "pointer", borderBottom: `1px solid ${C.border}`, background: f.alerta === "sobrecosto" ? C.danger + "0c" : f.alerta === "cerca" ? C.warn + "0c" : undefined }}>
                    <td style={{ padding: 6, fontWeight: 600 }}>{nombre(f.partida)}</td>
                    <td style={{ padding: 6, textAlign: "right" }}>{fmt(f.total)}</td>
                    <td style={{ padding: 6, textAlign: "right", color: C.muted }}>{fmt(f.proyectadoHoy)}</td>
                    <td style={{ padding: 6, textAlign: "right", fontWeight: 700 }}>{fmt(f.ejecutado)}</td>
                    <td style={{ padding: 6, textAlign: "right" }}>{fmt(f.comprometido)}</td>
                    <td style={{ padding: 6, textAlign: "right", color: C.muted }}>{fmt(f.tramite)}</td>
                    <td style={{ padding: 6, textAlign: "right" }}>{f.pct == null ? "—" : `${f.pct.toFixed(1)}%`}</td>
                    <td style={{ padding: 6, textAlign: "right", color: f.saldo < 0 ? C.danger : C.text, fontWeight: f.saldo < 0 ? 700 : 400 }}>{fmt(f.saldo) === "-" ? "$ 0" : fmt(f.saldo)}</td>
                    <td style={{ padding: 6, whiteSpace: "nowrap", color: f.alerta === "sobrecosto" ? C.danger : C.warn, fontWeight: 700, fontSize: 11 }}>{f.alerta === "sobrecosto" ? "🔴 Sobrecosto" : f.alerta === "cerca" ? "⚠️ +90%" : ""}</td>
                  </tr>
                  {abierta === f.partida.linaje && (
                    <tr key={f.partida.linaje + "-d"}><td colSpan={9} style={{ padding: "6px 10px 12px", background: C.bgCard2, fontSize: 12 }}>
                      {f.cuentas.length ? f.cuentas.map(x => <div key={x.id}>{x._tipo === "pagado" ? "✅" : x._tipo === "comprometido" ? "⏳" : "📝"} {x.proveedor} · {x.concepto} · <b>{fmt(valorCuenta(x))}</b> · {x.autor}</div>) : <div style={{ color: C.muted }}>Sin cuentas de cobro cargadas.</div>}
                      {manuales.filter(m => m.linaje === f.partida.linaje).map(m => <div key={m.id}>✍️ Manual {etiquetaMes(String(m.mes).slice(0, 7))} · <b>{fmt(m.valor)}</b>{m.nota ? ` · ${m.nota}` : ""} · {m.creado_nombre} {puedeEditarProyecto && <button onClick={async (e) => { e.stopPropagation(); if (window.confirm("¿Quitar este registro manual?") && await borrarEjecucionManual(m.id)) recargar(); }} style={{ ...BTN_SM, padding: "0 6px", color: C.danger }}>✕</button>}</div>)}
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {puedeEditarProyecto && (
        <Card style={{ marginBottom: 16 }}>
          <SectionTitle>Ejecución manual</SectionTitle>
          <div style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>Para lo que no pasa por cuentas de cobro: pagos directos, costos compartidos o lo ejecutado antes de usar la app.</div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(200px,2fr) 140px 150px minmax(160px,2fr) auto", gap: 8, alignItems: "end" }}>
            <select style={INP} value={form.linaje} onChange={e => setForm(f => ({ ...f, linaje: e.target.value }))}><option value="">Actividad…</option>{opciones.map(p => <option key={p.linaje} value={p.linaje}>{nombre(p)}</option>)}</select>
            <input style={INP} type="month" value={form.mes} onChange={e => setForm(f => ({ ...f, mes: e.target.value }))} />
            <input style={INP} type="number" min="0" placeholder="Valor" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
            <input style={INP} placeholder="Nota (de dónde sale)" value={form.nota} onChange={e => setForm(f => ({ ...f, nota: e.target.value }))} />
            <button onClick={agregarManual} style={{ ...BTN_SM, padding: "9px 14px", color: C.blueMid, borderColor: C.blueMid, fontWeight: 700 }}>Agregar</button>
          </div>
        </Card>
      )}

      {sinPartida.length > 0 && (
        <Card style={{ marginBottom: 16, border: `1px solid ${C.warn}` }}>
          <SectionTitle color={C.warn}>Cuentas aprobadas de {pres.project} sin actividad ({sinPartida.length})</SectionTitle>
          <div style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>No suman al ejecutado hasta que se carguen a una actividad. Pueden ser de otro presupuesto del mismo proyecto.</div>
          {sinPartida.slice(0, 50).map(x => (
            <div key={x.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12.5, flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 280px" }}>{new Date(x.created_at).toLocaleDateString("es-CO")} · {x.proveedor} · {x.concepto} · <b>{fmt(valorCuenta(x))}</b> · {x.autor}</span>
              {puedeEditarProyecto && <select style={{ ...INP, width: 280, padding: "4px 8px" }} defaultValue="" onChange={async e => { if (e.target.value && await asignarPartidaCuenta(x.id, e.target.value, usuario.nombre)) onRefreshCuentas(); }}>
                <option value="">Cargar a…</option>{opciones.map(p => <option key={p.linaje} value={p.linaje}>{nombre(p)}</option>)}
              </select>}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

function Editor({ pres, usuario, puedeEditarProyecto, cuentas, onRefreshCuentas, onVolver, onCambio }) {
  const [partidas, setPartidas] = useState(null);
  const [cab, setCab] = useState({ nombre: pres.nombre, fecha_inicio: pres.fecha_inicio || "", fecha_fin: pres.fecha_fin || "" });
  const [guardado, setGuardado] = useState(null);
  const [nota, setNota] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState(null);

  useEffect(() => { loadPartidas(pres.id).then(ps => { setPartidas(ps); setGuardado(JSON.stringify(ps)); }); }, [pres.id]);

  const editable = pres.estado === "borrador" && puedeEditarProyecto;
  const cambios = partidas && (JSON.stringify(partidas) !== guardado || cab.nombre !== pres.nombre || (cab.fecha_inicio || null) !== (pres.fecha_inicio || null) || (cab.fecha_fin || null) !== (pres.fecha_fin || null));
  const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(null), 6000); };

  const guardar = async () => {
    const vacias = partidas.filter(p => !p.nombre.trim());
    if (vacias.length) { avisar("⚠️ Hay actividades sin nombre. Escríbelo o quítalas."); return false; }
    setTrabajando(true);
    const ok1 = await guardarPresupuesto({ id: pres.id, nombre: cab.nombre.trim() || pres.nombre, fecha_inicio: cab.fecha_inicio || null, fecha_fin: cab.fecha_fin || null });
    const ok2 = ok1 && await guardarPartidas(pres.id, partidas, JSON.parse(guardado || "[]"));
    setTrabajando(false);
    if (!ok2) { avisar("⚠️ No se pudo guardar. Intenta de nuevo."); return false; }
    const ps = await loadPartidas(pres.id); setPartidas(ps); setGuardado(JSON.stringify(ps));
    onCambio(); avisar("✅ Guardado."); return true;
  };
  const cambiarEstado = async (estado, extra = {}) => {
    if (cambios && editable && !(await guardar())) return;
    setTrabajando(true);
    const ok = await guardarPresupuesto({ id: pres.id, estado, ...extra });
    setTrabajando(false);
    if (!ok) { avisar("⚠️ No se pudo cambiar el estado."); return; }
    onCambio(); onVolver();
  };

  if (!partidas) return <div style={{ color: C.muted }}>Cargando...</div>;
  const esAprobador = usuario.esSuperAdmin;

  return (
    <div>
      <button onClick={onVolver} style={{ ...BTN_SM, marginBottom: 12 }}>← Volver a la lista</button>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 320px" }}>
            {editable ? <input style={{ ...INP, fontSize: 17, fontWeight: 800, color: C.blue }} value={cab.nombre} onChange={e => setCab(c => ({ ...c, nombre: e.target.value }))} />
              : <div style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>{pres.nombre}</div>}
            <div style={{ color: C.muted, fontSize: 12.5, marginTop: 4 }}>{pres.project} · Versión {pres.version} · <Pill e={pres.estado} />{pres.creado_nombre ? ` · Creado por ${pres.creado_nombre}` : ""}{pres.aprobado_nombre ? ` · Aprobado por ${pres.aprobado_nombre} el ${new Date(pres.aprobado_at).toLocaleDateString("es-CO")}` : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <label style={{ fontSize: 11.5, color: C.muted }}>Inicio{editable ? <input style={{ ...INP, padding: "5px 8px" }} type="date" value={cab.fecha_inicio} onChange={e => setCab(c => ({ ...c, fecha_inicio: e.target.value }))} /> : <div style={{ color: C.text, fontSize: 13 }}>{fechaCorta(pres.fecha_inicio)}</div>}</label>
            <label style={{ fontSize: 11.5, color: C.muted }}>Fin{editable ? <input style={{ ...INP, padding: "5px 8px" }} type="date" value={cab.fecha_fin} onChange={e => setCab(c => ({ ...c, fecha_fin: e.target.value }))} /> : <div style={{ color: C.text, fontSize: 13 }}>{fechaCorta(pres.fecha_fin)}</div>}</label>
          </div>
        </div>
        {pres.notas && <div style={{ background: C.warn + "14", border: `1px solid ${C.warn}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, marginTop: 10 }}>📝 {pres.notas}</div>}
      </Card>

      <Resumen pres={{ ...pres, ...cab }} partidas={partidas} />
      {aviso && <div style={{ background: C.bgCard2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 13 }}>{aviso}</div>}
      {(pres.estado === "vigente" || pres.estado === "reemplazado") && <Control pres={pres} partidas={partidas} cuentas={cuentas} usuario={usuario} puedeEditarProyecto={puedeEditarProyecto && pres.estado === "vigente"} onRefreshCuentas={onRefreshCuentas} />}
      <TablaPartidas partidas={partidas} setPartidas={setPartidas} editable={editable} />

      <Card>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {editable && <button onClick={guardar} disabled={trabajando || !cambios} style={{ background: cambios ? C.blue : C.border, color: "#fff", border: "none", borderRadius: 12, padding: "10px 18px", fontWeight: 700, cursor: cambios ? "pointer" : "default" }}>{trabajando ? "Guardando..." : cambios ? "Guardar cambios" : "Sin cambios por guardar"}</button>}
          {editable && <button onClick={() => cambiarEstado("en_revision", { notas: null })} disabled={trabajando || !partidas.length} style={{ ...BTN_SM, padding: "10px 16px", color: C.green, borderColor: C.green, fontWeight: 700 }}>Enviar a aprobación de Miguel</button>}
          {editable && pres.version === 1 && <button onClick={async () => { if (window.confirm("¿Borrar este presupuesto en borrador?")) { if (await borrarPresupuesto(pres.id)) { onCambio(); onVolver(); } } }} style={{ ...BTN_SM, padding: "10px 14px", color: C.danger }}>Borrar borrador</button>}
          {pres.estado === "en_revision" && puedeEditarProyecto && !esAprobador && <span style={{ color: C.muted, fontSize: 13 }}>Esperando la aprobación de Miguel. <button onClick={() => cambiarEstado("borrador")} style={{ ...BTN_SM, marginLeft: 6 }}>Retirar para corregir</button></span>}
          {pres.estado === "en_revision" && esAprobador && (
            <>
              <button onClick={() => cambiarEstado("vigente", { aprobado_por: usuario.id, aprobado_nombre: usuario.nombre, aprobado_at: new Date().toISOString(), notas: null })} disabled={trabajando} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 12, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>✅ Aprobar</button>
              <input style={{ ...INP, flex: "1 1 220px" }} placeholder="Qué debe corregir (para devolverlo)" value={nota} onChange={e => setNota(e.target.value)} />
              <button onClick={() => { if (!nota.trim()) { avisar("⚠️ Escribe qué debe corregir."); return; } cambiarEstado("borrador", { notas: `Devuelto por ${usuario.nombre}: ${nota.trim()}` }); }} disabled={trabajando} style={{ ...BTN_SM, padding: "10px 14px", color: C.warn, borderColor: C.warn, fontWeight: 700 }}>Devolver</button>
            </>
          )}
          {pres.estado === "vigente" && puedeEditarProyecto && (
            <button onClick={async () => { setTrabajando(true); const nuevo = await crearVersionPresupuesto(pres, partidas, usuario); setTrabajando(false); if (nuevo) { onCambio(nuevo); } else avisar("⚠️ No se pudo crear la versión nueva."); }} disabled={trabajando} style={{ ...BTN_SM, padding: "10px 16px", color: C.blueMid, borderColor: C.blueMid, fontWeight: 700 }}>Crear versión {pres.version + 1} para modificarlo</button>
          )}
        </div>
        {pres.estado === "vigente" && <div style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>Un presupuesto aprobado no se edita: la versión nueva arranca como copia, se corrige y se envía a aprobación. Al aprobarla, esta queda como "Reemplazado".</div>}
      </Card>
    </div>
  );
}

export function Presupuestos({ usuario, cuentas = [], onRefreshCuentas }) {
  const [lista, setLista] = useState(null);
  const [proyecto, setProyecto] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [verReemplazados, setVerReemplazados] = useState(false);

  const proyectos = useMemo(() => {
    const base = usuario.proyectoAsignado || PROJECTS;
    return base.filter(p => !PROYECTOS_SIN_OBRA.includes(p) && !["Itai Equipos", "Grupo Itai", "SYD Inversiones"].includes(p));
  }, [usuario]);
  const aCargo = usuario.rol === "Directivo" ? proyectos : (usuario.proyectosACargo?.length ? usuario.proyectosACargo : proyectos);
  const recargar = async (abrir) => { const l = await loadPresupuestos(); setLista(l); if (abrir) setAbierto(abrir.id); };
  useEffect(() => { recargar(); }, []);
  useEffect(() => { if (!proyecto) setProyecto(aCargo[0] || proyectos[0]); }, [proyectos]);

  if (!lista) return <div style={{ color: C.muted }}>Cargando...</div>;
  const pres = abierto && lista.find(p => p.id === abierto);
  if (pres) return <Editor key={pres.id + pres.estado} pres={pres} usuario={usuario} puedeEditarProyecto={aCargo.includes(pres.project)} cuentas={cuentas} onRefreshCuentas={onRefreshCuentas} onVolver={() => setAbierto(null)} onCambio={(nuevo) => recargar(nuevo)} />;

  const delProyecto = lista.filter(p => p.project === proyecto && (verReemplazados || p.estado !== "reemplazado"));
  const puedeCrear = aCargo.includes(proyecto);
  const crear = async () => {
    const nombre = window.prompt(`Nombre del presupuesto (ej. "${proyecto} – Etapa 3")`, proyecto);
    if (!nombre?.trim()) return;
    const nuevo = await guardarPresupuesto({ project: proyecto, nombre: nombre.trim(), creado_por: usuario.id, creado_nombre: usuario.nombre });
    if (nuevo?.id) recargar(nuevo);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ color: C.blue, margin: 0, fontWeight: 800 }}>📐 Presupuestos de obra</h2>
        <select style={{ ...INP, width: 260 }} value={proyecto || ""} onChange={e => setProyecto(e.target.value)}>
          {proyectos.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div style={{ color: C.muted, fontSize: 12.5, marginBottom: 16 }}>
        Cada ingeniero arma el de sus proyectos: fase preoperativa y operativa, actividades y subactividades, cantidad, precio unitario y fechas. Miguel lo aprueba.
      </div>

      {usuario.esSuperAdmin && lista.some(p => p.estado === "en_revision") && (
        <Card style={{ marginBottom: 16, border: `1px solid ${C.warn}` }}>
          <SectionTitle color={C.warn}>Esperando tu aprobación</SectionTitle>
          {lista.filter(p => p.estado === "en_revision").map(p => (
            <div key={p.id} onClick={() => setAbierto(p.id)} style={{ cursor: "pointer", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
              <b style={{ color: C.blue }}>{p.project}</b> · {p.nombre} · versión {p.version} · {p.creado_nombre} <span style={{ float: "right", color: C.blueMid }}>Revisar →</span>
            </div>
          ))}
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <SectionTitle>{proyecto}</SectionTitle>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{ fontSize: 12, color: C.muted, display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={verReemplazados} onChange={e => setVerReemplazados(e.target.checked)} /> Ver versiones anteriores</label>
            {puedeCrear && <button onClick={crear} style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 12, padding: "8px 16px", fontWeight: 600, cursor: "pointer" }}>+ Nuevo presupuesto</button>}
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ color: C.muted, fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: .4 }}>{["Presupuesto", "Versión", "Estado", "Fechas", "Creado por"].map(h => <th key={h} style={{ padding: 6, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}</tr></thead>
          <tbody>
            {delProyecto.map(p => (
              <tr key={p.id} onClick={() => setAbierto(p.id)} style={{ cursor: "pointer", borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: 8, fontWeight: 700, color: C.blue }}>{p.nombre}</td>
                <td style={{ padding: 8 }}>{p.version}</td>
                <td style={{ padding: 8 }}><Pill e={p.estado} /></td>
                <td style={{ padding: 8, color: C.muted }}>{p.fecha_inicio ? `${fechaCorta(p.fecha_inicio)} – ${fechaCorta(p.fecha_fin)}` : "—"}</td>
                <td style={{ padding: 8, color: C.muted }}>{p.creado_nombre || "—"}</td>
              </tr>
            ))}
            {!delProyecto.length && <tr><td colSpan={5} style={{ padding: 16, color: C.muted, textAlign: "center" }}>Este proyecto aún no tiene presupuestos.{puedeCrear ? " Crea el primero con “+ Nuevo presupuesto”." : ""}</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
