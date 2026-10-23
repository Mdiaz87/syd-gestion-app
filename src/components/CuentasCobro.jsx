import { useState, useMemo, useEffect } from "react";
import { C, INP, BTN_SM, PROJECTS, ACTIVIDADES_CATALOGO, UNIDADES, EMPRESAS, EMPRESAS_CENTROS_COSTO } from "../lib/constants.js";
import { fmt } from "../lib/helpers.js";
import { crearCuentaCobro, actualizarCuentaCobro, subirSoporteCuentaCobro, marcarPagoRealizado, legalizarPago, aprobarCuentaPorPagar, enviarFacturaLegalizacion, enviarRevisionContable, enviarAGerencia, loadProveedores, loadAlertasLegalizacion } from "../lib/api.js";
import { Card, SectionTitle, CurrencyInput } from "./ui.jsx";

const TAMANO_MAXIMO_SOPORTE = 15 * 1024 * 1024; // 15MB

const ESTADO_INFO = {
  pendiente_contable: { label: "Pendiente de revisión contable", color: C.warn },
  devuelto: { label: "Devuelto", color: C.danger },
  // Desde 2026-10-23 la aprobación final la dan Susana Sierra y Miguel Díaz en
  // SYD Gestión (ya no el Directivo aquí); esta app solo recibe la decisión.
  aprobado_contable: { label: "En aprobación de Gerencia", color: C.blueMid },
  aprobado_total: { label: "Aprobado", color: C.green },
  rechazado: { label: "Rechazado", color: C.muted },
};

const fileToBase64 = (file) => new Promise((res, rej) => {
  const reader = new FileReader();
  reader.onload = () => res(reader.result.split(",")[1]);
  reader.onerror = rej;
  reader.readAsDataURL(file);
});

const puedeEditar = (cuenta, usuario) =>
  (cuenta.estado === "pendiente_contable" || cuenta.estado === "devuelto") &&
  (usuario.rol === "Directivo" || cuenta.autor_id === usuario.id);

const puedeMarcarPago = (cuenta, usuario) =>
  cuenta.estado === "aprobado_total" &&
  (usuario.rol === "Directivo" || usuario.rol === "Ingeniero");

// Compatibilidad: cuentas viejas solo tienen link_soporte (string único).
const soportesDe = (cuenta) =>
  cuenta.soportes?.length ? cuenta.soportes : (cuenta.link_soporte ? [{ nombre: "Soporte", url: cuenta.link_soporte }] : []);

// Compatibilidad: cuentas legalizadas antes de permitir varios archivos solo
// tienen factura_legalizacion_url.
const facturasLegalizacionDe = (cuenta) =>
  cuenta.factura_legalizacion_urls?.length ? cuenta.factura_legalizacion_urls
    : (cuenta.factura_legalizacion_url ? [{ nombre: "Factura", url: cuenta.factura_legalizacion_url }] : []);

// Fecha del último "Marcado como pagado" en el historial (no hay columna aparte).
const fechaPagoDe = (cuenta) =>
  [...(cuenta.historial || [])].reverse().find(h => h.accion === "Marcado como pagado")?.fecha || null;

const fechaCorta = (iso) => iso ? new Date(iso).toLocaleDateString("es-CO") : "—";
// fecha_limite es tipo date ("2026-10-20"): sin hora, new Date() la toma en UTC
// y en Colombia se mostraría un día antes.
const fechaDia = (d) => d ? new Date(`${d}T00:00:00`).toLocaleDateString("es-CO") : "—";

// Legalizaciones pendientes del usuario según los avisos de Recaudo y Cartera
// (tabla legalizaciones_alertas_externas, una fila por cuenta y evento).
// "bloqueada" pesa más que "por_vencer"; deja de contar en cuanto la cuenta
// tiene factura de legalización (esa misma subida avisa a la otra app).
const legalizacionesPendientesDe = (alertas, cuentas, usuario) => {
  const porCuenta = new Map();
  for (const a of alertas) {
    const ref = String(a.referencia_externa ?? "");
    if (!ref) continue;
    const previa = porCuenta.get(ref);
    if (!previa || (a.evento === "bloqueada" && previa.evento !== "bloqueada")) porCuenta.set(ref, a);
  }
  const res = [];
  for (const c of cuentas) {
    const a = porCuenta.get(String(c.id));
    if (!a || c.autor_id !== usuario.id || c.factura_legalizacion_url) continue;
    res.push({ cuenta: c, evento: a.evento, fechaLimite: a.fecha_limite });
  }
  return res;
};

// ── FORMULARIO DE REGISTRO / EDICIÓN ───────────────────────────────────────────
// Empresa -> Centro de Costo -> Categoría -> Subcategoría (todos en cascada;
// categoría/subcategoría quedan vacías si el centro de costo no tiene definidas).
const centrosDe = (empresa) => Object.keys(EMPRESAS_CENTROS_COSTO[empresa] || {});
const categoriasDe = (empresa, cc) => Object.keys((EMPRESAS_CENTROS_COSTO[empresa] || {})[cc] || {});
const subcategoriasDe = (empresa, cc, cat) => ((EMPRESAS_CENTROS_COSTO[empresa] || {})[cc] || {})[cat] || [];

function CuentaForm({ usuario, editando, onGuardada, onCancelarEdicion, bloqueadas = [] }) {
  const bloqueado = !editando && bloqueadas.length > 0;
  const proyectosDisponibles = usuario.proyectoAsignado || PROJECTS;
  const [project, setProject] = useState(editando?.project || usuario.proyectoAsignado?.[0] || PROJECTS[0]);
  const empresaInicial = editando?.empresa || EMPRESAS[0];
  const centroCostoInicial = editando?.centro_costo || centrosDe(empresaInicial)[0];
  const categoriaInicial = editando?.categoria || categoriasDe(empresaInicial, centroCostoInicial)[0] || "";
  const subcategoriaInicial = editando?.subcategoria || subcategoriasDe(empresaInicial, centroCostoInicial, categoriaInicial)[0] || "";
  const [empresa, setEmpresa] = useState(empresaInicial);
  const [centroCosto, setCentroCosto] = useState(centroCostoInicial);
  const [categoria, setCategoria] = useState(categoriaInicial);
  const [subcategoria, setSubcategoria] = useState(subcategoriaInicial);
  const [proveedor, setProveedor] = useState(editando?.proveedor || "");
  const [proveedores, setProveedores] = useState([]);
  useEffect(() => { loadProveedores().then(setProveedores); }, []);
  const conceptoInicial = editando && !ACTIVIDADES_CATALOGO.includes(editando.concepto) ? "Otro" : (editando?.concepto || ACTIVIDADES_CATALOGO[0]);
  const [concepto, setConcepto] = useState(conceptoInicial);
  const [conceptoOtro, setConceptoOtro] = useState(conceptoInicial === "Otro" ? editando.concepto : "");
  const [cantidad, setCantidad] = useState(editando?.cantidad ?? "");
  const unidadInicial = editando?.unidad && !UNIDADES.includes(editando.unidad) ? "Otro" : (editando?.unidad || UNIDADES[0]);
  const [unidad, setUnidad] = useState(unidadInicial);
  const [unidadOtro, setUnidadOtro] = useState(unidadInicial === "Otro" ? editando.unidad : "");
  const [valor, setValor] = useState(editando?.valor ?? "");
  const [observaciones, setObservaciones] = useState(editando?.observaciones || "");
  const [soportesExistentes, setSoportesExistentes] = useState(soportesDe(editando || {}));
  const [archivosNuevos, setArchivosNuevos] = useState([]);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const onFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setError("");
    const validos = [];
    for (const f of files) {
      if (f.size > TAMANO_MAXIMO_SOPORTE) {
        setError(`⚠️ "${f.name}" pesa más de 15MB. Comprime el archivo antes de subirlo.`);
        continue;
      }
      validos.push(f);
    }
    setArchivosNuevos(prev => [...prev, ...validos]);
    e.target.value = "";
  };
  const quitarArchivoNuevo = (i) => setArchivosNuevos(prev => prev.filter((_, idx) => idx !== i));
  const quitarSoporteExistente = (i) => setSoportesExistentes(prev => prev.filter((_, idx) => idx !== i));

  const onChangeEmpresa = (e) => {
    const nuevaEmpresa = e.target.value;
    const nuevoCentro = centrosDe(nuevaEmpresa)[0];
    const nuevaCategoria = categoriasDe(nuevaEmpresa, nuevoCentro)[0] || "";
    setEmpresa(nuevaEmpresa);
    setCentroCosto(nuevoCentro);
    setCategoria(nuevaCategoria);
    setSubcategoria(subcategoriasDe(nuevaEmpresa, nuevoCentro, nuevaCategoria)[0] || "");
  };

  const onChangeCentroCosto = (e) => {
    const nuevoCentro = e.target.value;
    const nuevaCategoria = categoriasDe(empresa, nuevoCentro)[0] || "";
    setCentroCosto(nuevoCentro);
    setCategoria(nuevaCategoria);
    setSubcategoria(subcategoriasDe(empresa, nuevoCentro, nuevaCategoria)[0] || "");
  };

  const onChangeCategoria = (e) => {
    const nuevaCategoria = e.target.value;
    setCategoria(nuevaCategoria);
    setSubcategoria(subcategoriasDe(empresa, centroCosto, nuevaCategoria)[0] || "");
  };

  const reset = () => {
    const nuevoCentro = centrosDe(EMPRESAS[0])[0];
    const nuevaCategoria = categoriasDe(EMPRESAS[0], nuevoCentro)[0] || "";
    setEmpresa(EMPRESAS[0]); setCentroCosto(nuevoCentro);
    setCategoria(nuevaCategoria); setSubcategoria(subcategoriasDe(EMPRESAS[0], nuevoCentro, nuevaCategoria)[0] || "");
    setProveedor(""); setConcepto(ACTIVIDADES_CATALOGO[0]); setConceptoOtro("");
    setCantidad(""); setUnidad(UNIDADES[0]); setUnidadOtro("");
    setValor(""); setObservaciones(""); setArchivosNuevos([]); setSoportesExistentes([]);
  };

  const submit = async () => {
    setError("");
    if (bloqueado) { setError("⚠️ Tienes legalizaciones vencidas. Sube la factura de legalización pendiente antes de radicar una nueva cuenta de cobro."); return; }
    const conceptoFinal = concepto === "Otro" ? conceptoOtro.trim() : concepto;
    const unidadFinal = unidad === "Otro" ? unidadOtro.trim() : unidad;
    if (!empresa) { setError("⚠️ Elige la empresa que va a realizar el pago."); return; }
    if (!centroCosto) { setError("⚠️ Elige el centro de costo."); return; }
    if (!proveedor.trim()) { setError("⚠️ Escribe el proveedor/contratista."); return; }
    if (!conceptoFinal) { setError("⚠️ Escribe el concepto/actividad."); return; }
    if (!valor || +valor <= 0) { setError("⚠️ Ingresa un valor a pagar mayor a cero."); return; }

    setEnviando(true);
    const nuevosSubidos = [];
    for (const f of archivosNuevos) {
      const base64 = await fileToBase64(f);
      const url = await subirSoporteCuentaCobro({ project, fileName: f.name, base64 });
      if (!url) {
        setError(`⚠️ No se pudo subir "${f.name}" a Drive. Intenta de nuevo.`);
        setEnviando(false);
        return;
      }
      nuevosSubidos.push({ nombre: f.name, url });
    }
    const soportes = [...soportesExistentes, ...nuevosSubidos];

    let ok, cuentaId;
    if (editando) {
      ok = await actualizarCuentaCobro(editando.id, {
        project, empresa, centroCosto, categoria, subcategoria, proveedor: proveedor.trim(), concepto: conceptoFinal,
        cantidad, unidad: unidadFinal, valor, observaciones: observaciones.trim(), soportes,
      }, usuario.nombre, editando.estado === "devuelto");
      cuentaId = editando.id;
    } else {
      cuentaId = await crearCuentaCobro({
        project, empresa, centroCosto, categoria, subcategoria, proveedor: proveedor.trim(), concepto: conceptoFinal,
        cantidad, unidad: unidadFinal, valor, observaciones: observaciones.trim(),
        soportes, autor: usuario.nombre, autorId: usuario.id,
      });
      ok = !!cuentaId;
    }
    setEnviando(false);
    if (!ok) { setError("⚠️ No se pudo guardar la cuenta de cobro. Intenta de nuevo."); return; }
    // La cuenta queda "pendiente_contable" en cualquiera de los dos casos
    // (nueva, o editada/reenviada) — se avisa a la app de contabilidad sin
    // bloquear la interfaz; si falla, queda marcada para reintentar.
    enviarRevisionContable(cuentaId);
    if (editando) {
      onGuardada();
    } else {
      reset();
      setEnviado(true);
      setTimeout(() => setEnviado(false), 4000);
      onGuardada();
    }
  };

  return (
    <Card style={{ marginBottom: 20, border: editando ? `1px solid ${C.blueMid}` : undefined }}>
      <SectionTitle>{editando ? "Editar Cuenta de Cobro" : "Nueva Cuenta de Cobro"}</SectionTitle>
      {bloqueado && (
        <div style={{ background: C.danger + "12", border: `1px solid ${C.danger}`, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 }}>
          🔒 No puedes radicar nuevas cuentas de cobro mientras tengas legalizaciones vencidas. Sube la factura de legalización (botón 📄 Factura en la tabla) de:
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {bloqueadas.map(({ cuenta, fechaLimite }) => (
              <li key={cuenta.id}><b>{cuenta.project}</b> — {cuenta.proveedor} ({fmt(cuenta.valor)}){fechaLimite ? `, venció el ${fechaDia(fechaLimite)}` : ""}</li>
            ))}
          </ul>
        </div>
      )}
      {editando?.estado === "devuelto" && (
        <div style={{ background: C.danger + "12", border: `1px solid ${C.danger}`, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 }}>
          🔄 Esta cuenta fue devuelta{editando.condicion ? <>: <b>{editando.condicion}</b></> : "."} Corrige lo necesario y guarda para reenviarla.
        </div>
      )}
      {/* Con legalizaciones vencidas el formulario entero queda inactivo, no solo el botón. */}
      <fieldset disabled={bloqueado} style={{ border: "none", margin: 0, padding: 0, minWidth: 0, opacity: bloqueado ? 0.5 : 1 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ color: C.muted, fontSize: 12 }}>Proyecto</label>
          <select style={INP} value={project} onChange={e => setProject(e.target.value)}>
            {proyectosDisponibles.map(p => <option key={p}>{p}</option>)}
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
          <label style={{ color: C.muted, fontSize: 12 }}>Empresa que realiza el pago</label>
          <select style={INP} value={empresa} onChange={onChangeEmpresa}>
            {EMPRESAS.map(e => <option key={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label style={{ color: C.muted, fontSize: 12 }}>Centro de costo</label>
          <select style={INP} value={centroCosto} onChange={onChangeCentroCosto}>
            {centrosDe(empresa).map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      {categoriasDe(empresa, centroCosto).length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ color: C.muted, fontSize: 12 }}>Categoría</label>
            <select style={INP} value={categoria} onChange={onChangeCategoria}>
              {categoriasDe(empresa, centroCosto).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          {subcategoriasDe(empresa, centroCosto, categoria).length > 0 && (
            <div>
              <label style={{ color: C.muted, fontSize: 12 }}>Subcategoría</label>
              <select style={INP} value={subcategoria} onChange={e => setSubcategoria(e.target.value)}>
                {subcategoriasDe(empresa, centroCosto, categoria).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
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
          <label style={{ color: C.muted, fontSize: 12 }}>📎 Soporte / factura (PDF o imagen, puedes subir varios)</label>
          <input type="file" accept="application/pdf,image/*" multiple style={{ ...INP, padding: 6 }} onChange={onFileChange} />
          {(soportesExistentes.length > 0 || archivosNuevos.length > 0) && (
            <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
              {soportesExistentes.map((s, i) => (
                <div key={`ex-${i}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, background: C.bgCard2, borderRadius: 6, padding: "4px 8px" }}>
                  <a href={s.url} target="_blank" rel="noreferrer" style={{ color: C.blue, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📎 {s.nombre || "Soporte"}</a>
                  <button type="button" onClick={() => quitarSoporteExistente(i)} style={{ border: "none", background: "none", color: C.danger, cursor: "pointer", fontSize: 12, flexShrink: 0 }}>Quitar</button>
                </div>
              ))}
              {archivosNuevos.map((f, i) => (
                <div key={`new-${i}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, background: C.bgCard2, borderRadius: 6, padding: "4px 8px" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {f.name} <i style={{ color: C.muted }}>(nuevo)</i></span>
                  <button type="button" onClick={() => quitarArchivoNuevo(i)} style={{ border: "none", background: "none", color: C.danger, cursor: "pointer", fontSize: 12, flexShrink: 0 }}>Quitar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ color: C.muted, fontSize: 12 }}>Observaciones (opcional)</label>
        <textarea style={{ ...INP, minHeight: 60 }} value={observaciones} onChange={e => setObservaciones(e.target.value)} />
      </div>
      </fieldset>
      {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {enviado && <div style={{ background: C.green + "18", border: `1px solid ${C.green}`, borderRadius: 8, padding: 10, marginBottom: 12, color: C.green, fontWeight: 600, textAlign: "center" }}>✅ Cuenta de cobro registrada — queda pendiente de aprobación</div>}
      <div style={{ display: "flex", gap: 10 }}>
        {editando && <button onClick={onCancelarEdicion} style={{ ...BTN_SM, flex: 1, padding: 13 }}>Cancelar</button>}
        <button onClick={submit} disabled={enviando || bloqueado} style={{ flex: editando ? 2 : 1, background: (enviando || bloqueado) ? C.border : C.blue, color: "#fff", fontWeight: 700, border: "none", borderRadius: 12, padding: 13, fontSize: 15, cursor: enviando ? "default" : "pointer", boxShadow: enviando ? "none" : "0 1px 2px rgba(0,0,0,0.18)" }}>
          {enviando ? "Guardando..." : editando ? (editando.estado === "devuelto" ? "Guardar y reenviar" : "Guardar cambios") : "Registrar cuenta de cobro"}
        </button>
      </div>
    </Card>
  );
}

// ── MODAL DE FACTURA DE LEGALIZACIÓN (posterior al pago) ──────────────────────
function FacturaLegalizacionModal({ cuenta, onClose, onEnviada }) {
  const [existentes, setExistentes] = useState(facturasLegalizacionDe(cuenta));
  const [archivosNuevos, setArchivosNuevos] = useState([]);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const onFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setError("");
    const validos = [];
    for (const f of files) {
      if (f.size > TAMANO_MAXIMO_SOPORTE) { setError(`⚠️ "${f.name}" pesa más de 15MB. Comprímelo antes de subirlo.`); continue; }
      validos.push(f);
    }
    setArchivosNuevos(prev => [...prev, ...validos]);
    e.target.value = "";
  };

  const submit = async () => {
    setError("");
    if (!existentes.length && !archivosNuevos.length) { setError("⚠️ Selecciona al menos un archivo de la factura."); return; }
    setEnviando(true);
    const subidos = [];
    for (const f of archivosNuevos) {
      const base64 = await fileToBase64(f);
      const url = await subirSoporteCuentaCobro({ project: cuenta.project, fileName: f.name, base64 });
      if (!url) { setError(`⚠️ No se pudo subir "${f.name}" a Drive. Intenta de nuevo.`); setEnviando(false); return; }
      subidos.push({ nombre: f.name, url });
    }
    const ok = await enviarFacturaLegalizacion(cuenta.id, [...existentes, ...subidos]);
    setEnviando(false);
    if (!ok) { setError("⚠️ Se subió a Drive, pero no se pudo enviar a la app de legalización. Puedes reintentar desde la tabla."); return; }
    onEnviada();
    onClose();
  };

  const fila = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 0" };
  const quitar = { background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 14 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0008", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 20 }}>
      <div style={{ background: C.bgCard, borderRadius: 16, padding: 24, maxWidth: 460, width: "100%", boxShadow: "0 10px 40px #0003" }}>
        <h3 style={{ color: C.blue, margin: "0 0 4px", fontWeight: 600, letterSpacing: "-0.1px" }}>Factura de legalización</h3>
        <div style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>{cuenta.project} · {cuenta.proveedor}</div>
        {existentes.length > 0 && (
          <div style={{ background: C.bgCard2, borderRadius: 8, padding: "6px 10px", marginBottom: 12 }}>
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 2 }}>Ya cargados</div>
            {existentes.map((f, i) => (
              <div key={f.url} style={fila}>
                <a href={f.url} target="_blank" rel="noreferrer" style={{ color: C.blue, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {f.nombre}</a>
                <button onClick={() => setExistentes(prev => prev.filter((_, j) => j !== i))} title="Quitar" style={quitar}>✕</button>
              </div>
            ))}
          </div>
        )}
        <label style={{ color: C.muted, fontSize: 12 }}>Agregar archivos (PDF o imagen, puedes subir varios)</label>
        <input type="file" multiple accept="application/pdf,image/*" style={{ ...INP, padding: 6, marginTop: 6, marginBottom: 8 }} onChange={onFileChange} />
        {archivosNuevos.map((f, i) => (
          <div key={i} style={fila}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🆕 {f.name}</span>
            <button onClick={() => setArchivosNuevos(prev => prev.filter((_, j) => j !== i))} title="Quitar" style={quitar}>✕</button>
          </div>
        ))}
        {error && <div style={{ color: C.danger, fontSize: 13, margin: "8px 0 12px" }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={onClose} style={{ ...BTN_SM, flex: 1, padding: 11 }}>Cancelar</button>
          <button onClick={submit} disabled={enviando} style={{ background: enviando ? C.border : C.blue, color: "#fff", fontWeight: 700, border: "none", borderRadius: 12, padding: 11, flex: 2, cursor: enviando ? "default" : "pointer", boxShadow: enviando ? "none" : "0 1px 2px rgba(0,0,0,0.18)" }}>
            {enviando ? "Enviando..." : "Enviar factura"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MÓDULO PRINCIPAL ───────────────────────────────────────────────────────────
export function CuentasCobro({ cuentas, usuario, onRefresh }) {
  const [search, setSearch] = useState("");
  const [fProyecto, setFProyecto] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [visibleCount, setVisibleCount] = useState(25);
  const [editando, setEditando] = useState(null);
  const [facturando, setFacturando] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [alertasLegalizacion, setAlertasLegalizacion] = useState([]);
  useEffect(() => { loadAlertasLegalizacion().then(setAlertasLegalizacion); }, [cuentas]);
  const legalizacionesPendientes = useMemo(() => legalizacionesPendientesDe(alertasLegalizacion, cuentas, usuario), [alertasLegalizacion, cuentas, usuario]);
  const legalizacionesBloqueadas = legalizacionesPendientes.filter(p => p.evento === "bloqueada");
  const legalizacionesPorVencer = legalizacionesPendientes.filter(p => p.evento === "por_vencer");

  const proyectos = useMemo(() => [...new Set(cuentas.map(c => c.project))].sort(), [cuentas]);

  // Aprobadas por Contabilidad que no llegaron a SYD Gestión (falló el envío,
  // o estaban esperando al Directivo cuando se quitó ese paso).
  const sinEnviarAGerencia = useMemo(() =>
    usuario.rol === "Directivo" ? cuentas.filter(c => c.estado === "aprobado_contable" && c.aprobacion_cxp_estado !== "enviado") : [],
    [cuentas, usuario]);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...cuentas].filter(c => {
      if (q && !((c.project || "").toLowerCase().includes(q) || (c.proveedor || "").toLowerCase().includes(q))) return false;
      if (fProyecto && c.project !== fProyecto) return false;
      if (quickFilter === "pendientes_mias" && c.estado !== "aprobado_contable") return false;
      if (quickFilter === "revision_contable" && c.estado !== "pendiente_contable") return false;
      if (quickFilter === "aprobadas" && c.estado !== "aprobado_total") return false;
      if (quickFilter === "devueltas_rechazadas" && !(c.estado === "devuelto" || c.estado === "rechazado")) return false;
      if (quickFilter === "por_pagar" && !(c.estado === "aprobado_total" && !c.pago_realizado)) return false;
      if (quickFilter === "pagadas" && !(c.estado === "aprobado_total" && c.pago_realizado)) return false;
      return true;
    });
  }, [cuentas, search, fProyecto, quickFilter]);

  useEffect(() => { setVisibleCount(25); }, [search, fProyecto, quickFilter]);

  const reenviarAGerencia = async (id) => {
    setAviso("Enviando a aprobación de Gerencia...");
    const ok = await enviarAGerencia(id);
    onRefresh();
    setAviso(ok ? "✅ Enviada a SYD Gestión para la aprobación de Susana Sierra y Miguel Díaz." : "⚠️ No se pudo enviar. Intenta de nuevo en unos minutos.");
    setTimeout(() => setAviso(null), 5000);
  };

  const reintentarLegalizacion = async (id) => {
    setAviso("Reintentando...");
    const ok = await legalizarPago(id);
    onRefresh();
    setAviso(ok ? "✅ Enviado a legalización correctamente." : "⚠️ Sigue fallando el envío a legalización.");
    setTimeout(() => setAviso(null), 5000);
  };

  const reintentarAprobacionCxp = async (id) => {
    setAviso("Reintentando...");
    const ok = await aprobarCuentaPorPagar(id);
    onRefresh();
    setAviso(ok ? "✅ Obligación creada en Cuentas por Pagar correctamente." : "⚠️ Sigue fallando la creación en Cuentas por Pagar.");
    setTimeout(() => setAviso(null), 5000);
  };

  const togglePago = async (c) => {
    const ok = await marcarPagoRealizado(c.id, !c.pago_realizado, usuario.nombre);
    onRefresh();
    setAviso(ok ? (c.pago_realizado ? "✅ Marcada como pendiente de pago." : "✅ Marcada como pagada.") : "⚠️ No se pudo actualizar el estado de pago.");
    setTimeout(() => setAviso(null), 5000);
  };

  const reintentarRevisionContable = async (id) => {
    setAviso("Reintentando...");
    const ok = await enviarRevisionContable(id);
    onRefresh();
    setAviso(ok ? "✅ Enviado a revisión contable correctamente." : "⚠️ Sigue fallando el envío a revisión contable.");
    setTimeout(() => setAviso(null), 5000);
  };

  const onGuardadaEdicion = () => {
    setEditando(null);
    onRefresh();
    setAviso("✅ Cambios guardados correctamente.");
    setTimeout(() => setAviso(null), 5000);
  };

  const onFacturaEnviada = () => {
    setFacturando(null);
    onRefresh();
    setAviso("✅ Factura de legalización enviada correctamente.");
    setTimeout(() => setAviso(null), 5000);
  };

  const reintentarFacturaLegalizacion = async (c) => {
    setAviso("Reintentando...");
    const ok = await enviarFacturaLegalizacion(c.id, facturasLegalizacionDe(c));
    onRefresh();
    setAviso(ok ? "✅ Factura enviada a legalización correctamente." : "⚠️ Sigue fallando el envío de la factura.");
    setTimeout(() => setAviso(null), 5000);
  };

  return (
    <div>
      <h2 style={{ color: C.blue, marginBottom: 20, fontWeight: 800 }}>💳 Cuentas de Cobro</h2>

      {!editando && legalizacionesPorVencer.length > 0 && (
        <div style={{ background: C.warn + "18", border: `1px solid ${C.warn}`, borderRadius: 8, padding: 10, marginBottom: 20, fontSize: 13 }}>
          ⏳ Tienes legalizaciones por vencer. Sube la factura antes de la fecha límite o se bloqueará la radicación de nuevas cuentas:
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {legalizacionesPorVencer.map(({ cuenta, fechaLimite }) => (
              <li key={cuenta.id}><b>{cuenta.project}</b> — {cuenta.proveedor} ({fmt(cuenta.valor)}){fechaLimite ? `, vence el ${fechaDia(fechaLimite)}` : ""}</li>
            ))}
          </ul>
        </div>
      )}
      {editando ? (
        <CuentaForm key={editando.id} usuario={usuario} editando={editando} onGuardada={onGuardadaEdicion} onCancelarEdicion={() => setEditando(null)} />
      ) : (usuario.rol === "Ingeniero" || usuario.rol === "Directivo") && (
        <CuentaForm key="nueva" usuario={usuario} onGuardada={onRefresh} bloqueadas={legalizacionesBloqueadas} />
      )}

      {aviso && <div style={{ background: C.bgCard2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 16, color: C.text, fontSize: 13 }}>{aviso}</div>}

      {sinEnviarAGerencia.length > 0 && (
        <div style={{ background: C.warn + "10", border: `1px solid ${C.warn}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ color: C.warn, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>📤 Aprobadas por Contabilidad, sin enviar a Gerencia ({sinEnviarAGerencia.length})</div>
          <div style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>La aprobación final ahora la dan Susana Sierra y Miguel Díaz en SYD Gestión. Envíalas para que les lleguen.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sinEnviarAGerencia.map(c => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", flexWrap: "wrap" }}>
                <div style={{ fontSize: 13 }}>
                  <b style={{ color: C.blue }}>{c.project}</b> · {c.proveedor} · <span style={{ color: C.muted }}>{c.concepto}</span> · <span style={{ fontWeight: 700 }}>{fmt(c.valor_final_pagar ?? c.valor)}</span>
                </div>
                <button onClick={() => reenviarAGerencia(c.id)} title={c.aprobacion_cxp_error || ""} style={{ ...BTN_SM, color: C.blueMid, borderColor: C.blueMid }}>📤 Enviar a Gerencia</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
        <input style={INP} placeholder="Buscar por proyecto, proveedor..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={INP} value={fProyecto} onChange={e => setFProyecto(e.target.value)}>
          <option value="">Proyecto: todos</option>
          {proyectos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {[
          { key: "", label: "Todas" },
          { key: "pendientes_mias", label: "En aprobación de Gerencia" },
          { key: "revision_contable", label: "En revisión contable" },
          { key: "aprobadas", label: "Aprobadas" },
          { key: "por_pagar", label: "⏳ Por pagar" },
          { key: "pagadas", label: "✅ Pagadas" },
          { key: "devueltas_rechazadas", label: "Devueltas / Rechazadas" },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setQuickFilter(f.key)}
            style={{
              border: `1px solid ${quickFilter === f.key ? C.blue : C.border}`,
              background: quickFilter === f.key ? C.blue : C.bgCard,
              color: quickFilter === f.key ? "#fff" : C.text,
              borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >{f.label}</button>
        ))}
      </div>

      {!cuentas.length && <Card><div style={{ color: C.muted, textAlign: "center", padding: 16 }}>No hay cuentas de cobro registradas aún.</div></Card>}

      {cuentas.length > 0 && (
        <>
          <div style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>{filtradas.length} de {cuentas.length} cuenta{cuentas.length === 1 ? "" : "s"} de cobro</div>
          <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 12, background: C.bgCard }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, minWidth: 720 }}>
              <thead>
                <tr style={{ background: C.bgCard2, borderBottom: `2px solid ${C.border}` }}>
                  {["Fecha", "Proyecto", "Proveedor", "Concepto", "Valor", "Estado", "Pago", "Acciones"].map(h =>
                    <th key={h} style={{ textAlign: "left", color: C.muted, fontWeight: 700, fontSize: 11, letterSpacing: .3, textTransform: "uppercase", padding: "10px 12px", whiteSpace: "nowrap" }}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {!filtradas.length && (
                  <tr><td colSpan={8} style={{ textAlign: "center", color: C.muted, padding: 26 }}>Ninguna cuenta coincide con los filtros.</td></tr>
                )}
                {filtradas.slice(0, visibleCount).map(c => {
                  const info = ESTADO_INFO[c.estado] || ESTADO_INFO.pendiente_contable;
                  return (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "9px 12px", color: C.muted, whiteSpace: "nowrap" }}>{fechaCorta(c.created_at)}</td>
                      <td style={{ padding: "9px 12px", fontWeight: 700, color: C.blue }}>{c.project}</td>
                      <td style={{ padding: "9px 12px", color: C.muted }}>{c.proveedor}</td>
                      <td style={{ padding: "9px 12px", color: C.text }}>{c.concepto}{c.cantidad ? ` · ${c.cantidad} ${c.unidad || ""}` : ""}</td>
                      <td style={{ padding: "9px 12px", color: C.text, fontWeight: 600, whiteSpace: "nowrap" }} title={c.valor_final_pagar != null ? `Valor registrado: ${fmt(c.valor)}${c.retencion ? ` · Retención: ${fmt(c.retencion)}` : ""}` : undefined}>
                        {c.valor_final_pagar != null ? fmt(c.valor_final_pagar) : fmt(c.valor)}
                        {c.valor_final_pagar != null && <span style={{ color: C.warn, fontSize: 10, marginLeft: 4 }} title="Valor corregido por Contabilidad">✏️</span>}
                      </td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{ background: info.color + "18", color: info.color, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, letterSpacing: "0.1px", whiteSpace: "nowrap" }}>{info.label}</span>
                      </td>
                      <td style={{ padding: "9px 12px" }}>
                        {c.estado === "aprobado_total" ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
                            {puedeMarcarPago(c, usuario) ? (
                              <button onClick={() => togglePago(c)} style={{ background: c.pago_realizado ? C.green + "18" : C.warn + "18", color: c.pago_realizado ? C.green : C.warn, border: "none", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, letterSpacing: "0.1px", whiteSpace: "nowrap", cursor: "pointer" }}>
                                {c.pago_realizado ? "✅ Pagado" : "⏳ Pendiente"}
                              </button>
                            ) : (
                              <span style={{ background: c.pago_realizado ? C.green + "18" : C.warn + "18", color: c.pago_realizado ? C.green : C.warn, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, letterSpacing: "0.1px", whiteSpace: "nowrap" }}>
                                {c.pago_realizado ? "✅ Pagado" : "⏳ Pendiente"}
                              </span>
                            )}
                            {c.pago_realizado && (
                              <span style={{ color: C.muted, fontSize: 10, whiteSpace: "nowrap" }}>{fechaCorta(fechaPagoDe(c))}</span>
                            )}
                          </div>
                        ) : <span style={{ color: C.muted, fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: "9px 12px" }}>
                        <div style={{ display: "flex", gap: 6, whiteSpace: "nowrap", alignItems: "center" }}>
                          {soportesDe(c).map((s, i) => (
                            <a key={i} href={s.url} target="_blank" rel="noreferrer" title={s.nombre} style={{ ...BTN_SM, color: C.blue, borderColor: C.blue, textDecoration: "none" }}>📎{soportesDe(c).length > 1 ? i + 1 : ""}</a>
                          ))}
                          {puedeEditar(c, usuario) && (
                            <button onClick={() => setEditando(c)} style={{ ...BTN_SM, color: C.blueMid, borderColor: C.blueMid }}>✏️ Editar</button>
                          )}
                          {usuario.rol === "Directivo" && c.estado === "aprobado_contable" && c.aprobacion_cxp_estado !== "enviado" && (
                            <button onClick={() => reenviarAGerencia(c.id)} title={c.aprobacion_cxp_error || "Enviar a aprobación de Susana Sierra y Miguel Díaz"} style={{ ...BTN_SM, color: c.aprobacion_cxp_estado === "error" ? C.danger : C.blueMid, borderColor: c.aprobacion_cxp_estado === "error" ? C.danger : C.blueMid }}>📤 Enviar a Gerencia</button>
                          )}
                          {usuario.rol === "Directivo" && c.estado === "pendiente_contable" && c.revision_contable_estado === "error" && (
                            <button onClick={() => reintentarRevisionContable(c.id)} title={c.revision_contable_error || "Falló el envío a revisión contable"} style={{ ...BTN_SM, color: C.danger, borderColor: C.danger }}>🔁 Rev. contable</button>
                          )}
                          {usuario.rol === "Directivo" && c.estado === "aprobado_total" && c.legalizacion_estado === "error" && (
                            <button onClick={() => reintentarLegalizacion(c.id)} title={c.legalizacion_error || "Falló el envío a legalización"} style={{ ...BTN_SM, color: C.danger, borderColor: C.danger }}>🔁 Legalización</button>
                          )}
                          {usuario.rol === "Directivo" && c.estado === "aprobado_total" && c.aprobacion_cxp_estado === "error" && (
                            <button onClick={() => reintentarAprobacionCxp(c.id)} title={c.aprobacion_cxp_error || "Falló la creación en Cuentas por Pagar"} style={{ ...BTN_SM, color: C.danger, borderColor: C.danger }}>🔁 Cuentas x Pagar</button>
                          )}
                          {c.estado === "aprobado_total" && (usuario.rol === "Directivo" || c.autor_id === usuario.id) && (
                            <button onClick={() => setFacturando(c)} title={c.factura_legalizacion_url ? "Ya tiene factura — click para ver, agregar o quitar archivos" : "Adjuntar factura de legalización"} style={{ ...BTN_SM, color: c.factura_legalizacion_url ? C.green : C.blueMid, borderColor: c.factura_legalizacion_url ? C.green : C.blueMid }}>
                              {c.factura_legalizacion_url ? "📄✅" : "📄 Factura"}
                            </button>
                          )}
                          {usuario.rol === "Directivo" && c.factura_legalizacion_estado === "error" && (
                            <button onClick={() => reintentarFacturaLegalizacion(c)} title={c.factura_legalizacion_error || "Falló el envío de la factura"} style={{ ...BTN_SM, color: C.danger, borderColor: C.danger }}>🔁 Factura</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtradas.length > visibleCount && (
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button onClick={() => setVisibleCount(v => v + 25)} style={{ ...BTN_SM, padding: "8px 20px" }}>
                Cargar más ({filtradas.length - visibleCount} restantes)
              </button>
            </div>
          )}
        </>
      )}

      {facturando && (
        <FacturaLegalizacionModal
          cuenta={facturando}
          onClose={() => setFacturando(null)}
          onEnviada={onFacturaEnviada}
        />
      )}
    </div>
  );
}
