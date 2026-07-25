import { useState, useMemo, useEffect } from "react";
import { C, INP, BTN_SM, PROJECTS, ACTIVIDADES_CATALOGO, UNIDADES } from "../lib/constants.js";
import { fmt } from "../lib/helpers.js";
import { crearCuentaCobro, subirSoporteCuentaCobro, actualizarEstadoCuentaCobro, notificarPagoAprobado, loadProveedores } from "../lib/api.js";
import { Card, SectionTitle, CurrencyInput } from "./ui.jsx";

const TAMANO_MAXIMO_SOPORTE = 15 * 1024 * 1024; // 15MB

const ESTADO_INFO = {
  pendiente: { label: "Pendiente", color: C.warn },
  aprobado_total: { label: "Aprobado total", color: C.green },
  aprobado_condicional: { label: "Aprobado condicional", color: C.blueMid },
  rechazado: { label: "Rechazado", color: C.danger },
};

const fileToBase64 = (file) => new Promise((res, rej) => {
  const reader = new FileReader();
  reader.onload = () => res(reader.result.split(",")[1]);
  reader.onerror = rej;
  reader.readAsDataURL(file);
});

// ── FORMULARIO DE REGISTRO ────────────────────────────────────────────────────
function NuevaCuentaForm({ usuario, onCreada }) {
  const [project, setProject] = useState(PROJECTS[0]);
  const [proveedor, setProveedor] = useState("");
  const [proveedores, setProveedores] = useState([]);
  useEffect(() => { loadProveedores().then(setProveedores); }, []);
  const [concepto, setConcepto] = useState(ACTIVIDADES_CATALOGO[0]);
  const [conceptoOtro, setConceptoOtro] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState(UNIDADES[0]);
  const [unidadOtro, setUnidadOtro] = useState("");
  const [valor, setValor] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const onFileChange = (e) => {
    const f = e.target.files[0];
    setError("");
    if (!f) { setArchivo(null); return; }
    if (f.size > TAMANO_MAXIMO_SOPORTE) {
      setError("⚠️ El archivo pesa más de 15MB. Comprime el PDF o la imagen antes de subirla.");
      e.target.value = "";
      setArchivo(null);
      return;
    }
    setArchivo(f);
  };

  const reset = () => {
    setProveedor(""); setConcepto(ACTIVIDADES_CATALOGO[0]); setConceptoOtro("");
    setCantidad(""); setUnidad(UNIDADES[0]); setUnidadOtro("");
    setValor(""); setObservaciones(""); setArchivo(null);
  };

  const submit = async () => {
    setError("");
    const conceptoFinal = concepto === "Otro" ? conceptoOtro.trim() : concepto;
    const unidadFinal = unidad === "Otro" ? unidadOtro.trim() : unidad;
    if (!proveedor.trim()) { setError("⚠️ Escribe el proveedor/contratista."); return; }
    if (!conceptoFinal) { setError("⚠️ Escribe el concepto/actividad."); return; }
    if (!valor || +valor <= 0) { setError("⚠️ Ingresa un valor a pagar mayor a cero."); return; }

    setEnviando(true);
    let linkSoporte = null;
    if (archivo) {
      const base64 = await fileToBase64(archivo);
      linkSoporte = await subirSoporteCuentaCobro({ project, fileName: archivo.name, base64 });
      if (!linkSoporte) {
        setError("⚠️ No se pudo subir el soporte a Drive. Intenta de nuevo.");
        setEnviando(false);
        return;
      }
    }
    const ok = await crearCuentaCobro({
      project, proveedor: proveedor.trim(), concepto: conceptoFinal,
      cantidad, unidad: unidadFinal, valor, observaciones: observaciones.trim(),
      linkSoporte, autor: usuario.nombre, autorId: usuario.id,
    });
    setEnviando(false);
    if (!ok) { setError("⚠️ No se pudo registrar la cuenta de cobro. Intenta de nuevo."); return; }
    reset();
    setEnviado(true);
    setTimeout(() => setEnviado(false), 4000);
    onCreada();
  };

  return (
    <Card style={{ marginBottom: 20 }}>
      <SectionTitle>Nueva Cuenta de Cobro</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ color: C.muted, fontSize: 12 }}>Proyecto</label>
          <select style={INP} value={project} onChange={e => setProject(e.target.value)}>
            {PROJECTS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={{ color: C.muted, fontSize: 12 }}>Proveedor / Contratista</label>
          <input style={INP} list="proveedores-list" value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Busca o escribe uno nuevo" />
          <datalist id="proveedores-list">
            {proveedores.map(p => <option key={p.nombre} value={p.nombre} />)}
          </datalist>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ color: C.muted, fontSize: 12 }}>Concepto / Actividad</label>
          <select style={INP} value={concepto} onChange={e => setConcepto(e.target.value)}>
            {ACTIVIDADES_CATALOGO.map(a => <option key={a}>{a}</option>)}
          </select>
          {concepto === "Otro" && <input style={{ ...INP, marginTop: 6 }} value={conceptoOtro} onChange={e => setConceptoOtro(e.target.value)} placeholder="Especifica el concepto" />}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <label style={{ color: C.muted, fontSize: 12 }}>Cantidad</label>
            <input type="number" style={INP} value={cantidad} onChange={e => setCantidad(e.target.value)} />
          </div>
          <div>
            <label style={{ color: C.muted, fontSize: 12 }}>Unidad</label>
            <select style={INP} value={unidad} onChange={e => setUnidad(e.target.value)}>
              {UNIDADES.map(u => <option key={u}>{u}</option>)}
            </select>
            {unidad === "Otro" && <input style={{ ...INP, marginTop: 6 }} value={unidadOtro} onChange={e => setUnidadOtro(e.target.value)} placeholder="Especifica" />}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ color: C.muted, fontSize: 12 }}>Valor total a pagar</label>
          <CurrencyInput style={INP} value={valor} onChange={setValor} />
        </div>
        <div>
          <label style={{ color: C.muted, fontSize: 12 }}>📎 Soporte / factura (PDF o imagen, opcional)</label>
          <input type="file" accept="application/pdf,image/*" style={{ ...INP, padding: 6 }} onChange={onFileChange} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ color: C.muted, fontSize: 12 }}>Observaciones (opcional)</label>
        <textarea style={{ ...INP, minHeight: 60 }} value={observaciones} onChange={e => setObservaciones(e.target.value)} />
      </div>
      {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {enviado && <div style={{ background: C.green + "18", border: `1px solid ${C.green}`, borderRadius: 8, padding: 10, marginBottom: 12, color: C.green, fontWeight: 600, textAlign: "center" }}>✅ Cuenta de cobro registrada — queda pendiente de aprobación</div>}
      <button onClick={submit} disabled={enviando} style={{ width: "100%", background: enviando ? C.border : C.blue, color: "#fff", fontWeight: 700, border: "none", borderRadius: 10, padding: 13, fontSize: 15, cursor: enviando ? "default" : "pointer" }}>
        {enviando ? "Registrando..." : "Registrar cuenta de cobro"}
      </button>
    </Card>
  );
}

// ── MODAL DE REVISIÓN (Directivo) ─────────────────────────────────────────────
function RevisarPagoModal({ cuenta, onClose, onResuelto }) {
  const [modo, setModo] = useState(null); // 'aprobado_total' | 'aprobado_condicional' | 'rechazado'
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const confirmar = async (estado) => {
    if ((estado === "aprobado_condicional" || estado === "rechazado") && !texto.trim()) {
      setError(estado === "rechazado" ? "⚠️ Escribe el motivo del rechazo." : "⚠️ Escribe la condición pendiente.");
      return;
    }
    setEnviando(true);
    const revisadoPor = cuenta.__usuario.nombre;
    const ok = await actualizarEstadoCuentaCobro(cuenta.id, estado,
      { condicion: estado === "aprobado_condicional" ? texto.trim() : null, motivoRechazo: estado === "rechazado" ? texto.trim() : null },
      revisadoPor);
    let notifOk = true;
    if (ok && (estado === "aprobado_total" || estado === "aprobado_condicional")) {
      notifOk = await notificarPagoAprobado({ ...cuenta, estado, condicion: estado === "aprobado_condicional" ? texto.trim() : null });
    }
    setEnviando(false);
    if (!ok) { setError("⚠️ No se pudo guardar la decisión. Intenta de nuevo."); return; }
    onResuelto(estado, notifOk);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0008", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 20 }}>
      <div style={{ background: C.bgCard, borderRadius: 16, padding: 24, maxWidth: 460, width: "100%", boxShadow: "0 10px 40px #0003" }}>
        <h3 style={{ color: C.blue, margin: "0 0 4px" }}>Revisar cuenta de cobro</h3>
        <div style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>{cuenta.project} · {cuenta.proveedor}</div>

        <div style={{ background: C.bgCard2, borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 16, border: `1px solid ${C.border}` }}>
          <div><b>Concepto:</b> {cuenta.concepto}</div>
          {cuenta.cantidad && <div><b>Cantidad:</b> {cuenta.cantidad} {cuenta.unidad}</div>}
          <div><b>Valor:</b> {fmt(cuenta.valor)}</div>
          {cuenta.observaciones && <div><b>Observaciones:</b> {cuenta.observaciones}</div>}
          <div><b>Registrado por:</b> {cuenta.autor}</div>
          {cuenta.link_soporte && <div style={{ marginTop: 6 }}><a href={cuenta.link_soporte} target="_blank" rel="noreferrer" style={{ color: C.blue, fontWeight: 600 }}>📎 Ver soporte/factura →</a></div>}
        </div>

        {!modo && (
          <div style={{ display: "grid", gap: 8 }}>
            <button onClick={() => confirmar("aprobado_total")} disabled={enviando} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 8, padding: 11, fontWeight: 700, cursor: "pointer" }}>✅ Aprobar total</button>
            <button onClick={() => setModo("aprobado_condicional")} style={{ background: C.blueMid, color: "#fff", border: "none", borderRadius: 8, padding: 11, fontWeight: 700, cursor: "pointer" }}>⚠️ Aprobar condicional</button>
            <button onClick={() => setModo("rechazado")} style={{ background: C.danger, color: "#fff", border: "none", borderRadius: 8, padding: 11, fontWeight: 700, cursor: "pointer" }}>❌ Rechazar</button>
            <button onClick={onClose} style={{ ...BTN_SM, padding: 10 }}>Cancelar</button>
          </div>
        )}

        {modo && (
          <div>
            <label style={{ color: C.muted, fontSize: 12 }}>{modo === "rechazado" ? "Motivo del rechazo" : "Condición pendiente"}</label>
            <textarea style={{ ...INP, minHeight: 70, marginBottom: 12 }} value={texto} onChange={e => setTexto(e.target.value)} placeholder={modo === "rechazado" ? "Ej: falta soporte de campo" : "Ej: falta remisión firmada"} autoFocus />
            {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setModo(null); setError(""); }} style={{ ...BTN_SM, flex: 1, padding: 10 }}>Volver</button>
              <button onClick={() => confirmar(modo)} disabled={enviando} style={{ background: modo === "rechazado" ? C.danger : C.blueMid, color: "#fff", border: "none", borderRadius: 8, padding: 10, flex: 1, fontWeight: 700, cursor: "pointer" }}>
                {enviando ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        )}
        {!modo && error && <div style={{ color: C.danger, fontSize: 13, marginTop: 12 }}>{error}</div>}
      </div>
    </div>
  );
}

// ── MÓDULO PRINCIPAL ───────────────────────────────────────────────────────────
export function CuentasCobro({ cuentas, usuario, onRefresh }) {
  const [search, setSearch] = useState("");
  const [fProyecto, setFProyecto] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [revisando, setRevisando] = useState(null);
  const [aviso, setAviso] = useState(null);

  const proyectos = useMemo(() => [...new Set(cuentas.map(c => c.project))].sort(), [cuentas]);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...cuentas].filter(c => {
      if (q && !((c.project || "").toLowerCase().includes(q) || (c.proveedor || "").toLowerCase().includes(q))) return false;
      if (fProyecto && c.project !== fProyecto) return false;
      if (fEstado && c.estado !== fEstado) return false;
      return true;
    });
  }, [cuentas, search, fProyecto, fEstado]);

  const onResuelto = (estado, notifOk) => {
    onRefresh();
    if ((estado === "aprobado_total" || estado === "aprobado_condicional") && !notifOk) {
      setAviso("⚠️ Se guardó la decisión, pero no se pudo notificar a contabilidad por correo. Avísales manualmente.");
    } else {
      setAviso("✅ Decisión guardada correctamente.");
    }
    setTimeout(() => setAviso(null), 5000);
  };

  return (
    <div>
      <h2 style={{ color: C.blue, marginBottom: 20, fontWeight: 800 }}>💳 Cuentas de Cobro</h2>

      {(usuario.rol === "Ingeniero" || usuario.rol === "Directivo") && (
        <NuevaCuentaForm usuario={usuario} onCreada={onRefresh} />
      )}

      {aviso && <div style={{ background: C.bgCard2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 16, color: C.text, fontSize: 13 }}>{aviso}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <input style={INP} placeholder="Buscar por proyecto, proveedor..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={INP} value={fProyecto} onChange={e => setFProyecto(e.target.value)}>
          <option value="">Proyecto: todos</option>
          {proyectos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select style={INP} value={fEstado} onChange={e => setFEstado(e.target.value)}>
          <option value="">Estado: todos</option>
          {Object.entries(ESTADO_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {!cuentas.length && <Card><div style={{ color: C.muted, textAlign: "center", padding: 16 }}>No hay cuentas de cobro registradas aún.</div></Card>}

      {cuentas.length > 0 && (
        <>
          <div style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>{filtradas.length} de {cuentas.length} cuenta{cuentas.length === 1 ? "" : "s"} de cobro</div>
          <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 12, background: C.bgCard }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, minWidth: 720 }}>
              <thead>
                <tr style={{ background: C.bgCard2, borderBottom: `2px solid ${C.border}` }}>
                  {["Proyecto", "Proveedor", "Concepto", "Valor", "Estado", "Acciones"].map(h =>
                    <th key={h} style={{ textAlign: "left", color: C.muted, fontWeight: 700, fontSize: 11, letterSpacing: .3, textTransform: "uppercase", padding: "10px 12px", whiteSpace: "nowrap" }}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {!filtradas.length && (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: C.muted, padding: 26 }}>Ninguna cuenta coincide con los filtros.</td></tr>
                )}
                {filtradas.map(c => {
                  const info = ESTADO_INFO[c.estado] || ESTADO_INFO.pendiente;
                  return (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "9px 12px", fontWeight: 700, color: C.blue }}>{c.project}</td>
                      <td style={{ padding: "9px 12px", color: C.muted }}>{c.proveedor}</td>
                      <td style={{ padding: "9px 12px", color: C.text }}>{c.concepto}{c.cantidad ? ` · ${c.cantidad} ${c.unidad || ""}` : ""}</td>
                      <td style={{ padding: "9px 12px", color: C.text, fontWeight: 600, whiteSpace: "nowrap" }}>{fmt(c.valor)}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{ background: info.color + "18", color: info.color, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700, border: `1px solid ${info.color}44`, whiteSpace: "nowrap" }}>{info.label}</span>
                      </td>
                      <td style={{ padding: "9px 12px" }}>
                        <div style={{ display: "flex", gap: 6, whiteSpace: "nowrap", alignItems: "center" }}>
                          {c.link_soporte && <a href={c.link_soporte} target="_blank" rel="noreferrer" style={{ ...BTN_SM, color: C.blue, borderColor: C.blue, textDecoration: "none" }}>📎</a>}
                          {usuario.rol === "Directivo" && c.estado === "pendiente" && (
                            <button onClick={() => setRevisando(c)} style={{ ...BTN_SM, color: C.blueMid, borderColor: C.blueMid }}>Revisar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {revisando && (
        <RevisarPagoModal
          cuenta={{ ...revisando, __usuario: usuario }}
          onClose={() => setRevisando(null)}
          onResuelto={onResuelto}
        />
      )}
    </div>
  );
}
