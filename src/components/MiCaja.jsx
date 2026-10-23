import { useEffect, useMemo, useRef, useState } from "react";
import { C, INP, BTN_SM } from "../lib/constants.js";
import { Card, SectionTitle, CurrencyInput } from "./ui.jsx";
import { cargarMiCaja, guardarGasto, enviarGasto, anularGasto, confirmarRecibido, subirSoporteGasto } from "../lib/cajas.js";

const pesos = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(+n || 0);
const fechaDia = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("es-CO") : "—");
// Fecha local (no UTC: en Colombia después de las 7 p.m. se correría un día).
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const ESTADO = {
  borrador: { label: "Borrador", color: C.muted },
  enviado: { label: "En revisión", color: C.warn },
  devuelto: { label: "Devuelto", color: C.danger },
  aprobado: { label: "Aprobado", color: C.green },
  rechazado: { label: "En aclaración", color: C.danger },
};
const TIPO_MOV = { apertura: "Apertura", reposicion: "Reposición", reintegro: "Reintegro", devolucion: "Devolución", ajuste: "Ajuste" };

const BTN_PRIMARIO = { background: C.blue, border: "none", color: "#fff", borderRadius: 12, padding: "12px 18px", cursor: "pointer", fontSize: 15, fontWeight: 600, width: "100%" };

function Estado({ estado }) {
  const e = ESTADO[estado] || { label: estado, color: C.muted };
  return <span style={{ background: e.color + "1c", color: e.color, borderRadius: 20, padding: "3px 10px", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>{e.label}</span>;
}

function Campo({ label, children }) {
  return (
    <label style={{ display: "block", minWidth: 0 }}>
      <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
      <div style={{ marginTop: 3 }}>{children}</div>
    </label>
  );
}

// Registrar o corregir un gasto. El id nace aquí y se conserva: si la red
// falla y se vuelve a tocar "Guardar" o "Enviar", el servidor reconoce el
// mismo gasto y no lo duplica.
function FormGasto({ caja, gasto, onListo, onCancelar }) {
  const idRef = useRef(gasto?.id || crypto.randomUUID());
  const [valor, setValor] = useState(gasto?.valor ?? "");
  const [fecha, setFecha] = useState(gasto?.fecha || hoy());
  const [proveedor, setProveedor] = useState(gasto?.proveedor || "");
  const [nit, setNit] = useState(gasto?.nit || "");
  const [factura, setFactura] = useState(gasto?.numero_factura || "");
  const [concepto, setConcepto] = useState(gasto?.concepto || "");
  const [categoriaId, setCategoriaId] = useState(gasto?.categoria_id || "");
  const [subcategoriaId, setSubcategoriaId] = useState(gasto?.subcategoria_id || "");
  const [soportes, setSoportes] = useState(gasto?.soportes || []);
  const [subiendo, setSubiendo] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");
  const camaraRef = useRef(null);
  const archivoRef = useRef(null);

  const subcategorias = useMemo(() => caja.categorias.find((c) => c.id === categoriaId)?.subcategorias || [], [caja, categoriaId]);

  const onArchivo = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setError("");
    setSubiendo(true);
    try {
      for (const f of files) {
        const s = await subirSoporteGasto(f, caja.proyecto);
        setSoportes((prev) => [...prev, s]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  const datos = () => ({
    id: idRef.current, caja_id: caja.id, medio: "caja", fecha, proveedor, nit, numero_factura: factura, concepto,
    valor: +valor || 0, categoria_id: categoriaId, subcategoria_id: subcategoriaId || null, soportes,
  });

  const validar = () => {
    if (!(+valor > 0)) return "Escribe el valor del gasto.";
    if (caja.limite_por_gasto && +valor > +caja.limite_por_gasto) return `El valor supera el límite por gasto de esta caja (${pesos(caja.limite_por_gasto)}).`;
    if (!proveedor.trim()) return "Escribe el proveedor.";
    if (!concepto.trim()) return "Escribe el concepto.";
    if (!categoriaId) return "Escoge la categoría.";
    return "";
  };

  const guardar = async (yEnviar) => {
    const msg = validar() || (yEnviar && soportes.length === 0 ? "Adjunta la foto de la factura o recibo antes de enviar." : "");
    if (msg) { setError(msg); return; }
    setError("");
    setTrabajando(true);
    try {
      await guardarGasto(datos());
      if (yEnviar) await enviarGasto(idRef.current);
      await onListo(yEnviar ? "Gasto enviado a Contabilidad." : "Borrador guardado. Ya descuenta del saldo.");
    } catch (err) {
      setError(err.message);
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionTitle>{gasto ? "Corregir gasto" : "Registrar gasto"}</SectionTitle>
      {gasto?.estado === "devuelto" && gasto.motivo_devolucion && (
        <div style={{ background: C.danger + "14", color: C.danger, borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 12 }}>
          <b>Contabilidad lo devolvió:</b> {gasto.motivo_devolucion}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Foto de la factura o recibo</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={{ ...BTN_SM, padding: "10px 14px", fontSize: 14 }} disabled={subiendo} onClick={() => camaraRef.current?.click()}>📷 Tomar foto</button>
          <button type="button" style={{ ...BTN_SM, padding: "10px 14px", fontSize: 14 }} disabled={subiendo} onClick={() => archivoRef.current?.click()}>📎 Adjuntar archivo</button>
          <input ref={camaraRef} type="file" accept="image/*" capture="environment" onChange={onArchivo} style={{ display: "none" }} />
          <input ref={archivoRef} type="file" accept="image/*,application/pdf" multiple onChange={onArchivo} style={{ display: "none" }} />
        </div>
        {subiendo && <div style={{ fontSize: 12, color: C.blueMid, marginTop: 6 }}>Subiendo soporte...</div>}
        {soportes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
            {soportes.map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                <a href={s.url} target="_blank" rel="noreferrer" style={{ color: C.blueMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>✅ {s.nombre}</a>
                <button type="button" style={{ ...BTN_SM, padding: "2px 8px" }} onClick={() => setSoportes(soportes.filter((_, j) => j !== i))}>Quitar</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <Campo label="Valor *"><CurrencyInput value={valor} onChange={setValor} style={{ ...INP, fontSize: 16, padding: "10px 12px" }} /></Campo>
        <Campo label="Fecha del gasto *"><input type="date" max={hoy()} value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ ...INP, fontSize: 16, padding: "10px 12px" }} /></Campo>
        <Campo label="Proveedor *"><input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Ej. Ferretería El Tornillo" style={{ ...INP, fontSize: 16, padding: "10px 12px" }} /></Campo>
        <Campo label="NIT o cédula"><input inputMode="numeric" value={nit} onChange={(e) => setNit(e.target.value)} style={{ ...INP, fontSize: 16, padding: "10px 12px" }} /></Campo>
        <Campo label="N.º de factura"><input value={factura} onChange={(e) => setFactura(e.target.value)} placeholder="Si tiene" style={{ ...INP, fontSize: 16, padding: "10px 12px" }} /></Campo>
        <Campo label="Concepto *"><input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Qué se compró y para qué" style={{ ...INP, fontSize: 16, padding: "10px 12px" }} /></Campo>
        <Campo label="Categoría *">
          <select value={categoriaId} onChange={(e) => { setCategoriaId(e.target.value); setSubcategoriaId(""); }} style={{ ...INP, fontSize: 16, padding: "10px 12px" }}>
            <option value="">Escoge...</option>
            {caja.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Campo>
        {subcategorias.length > 0 && (
          <Campo label="Subcategoría">
            <select value={subcategoriaId} onChange={(e) => setSubcategoriaId(e.target.value)} style={{ ...INP, fontSize: 16, padding: "10px 12px" }}>
              <option value="">Escoge...</option>
              {subcategorias.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </Campo>
        )}
      </div>

      {error && <div style={{ color: C.danger, fontSize: 13, marginTop: 12 }}>⚠️ {error}</div>}
      <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
        <button type="button" style={{ ...BTN_PRIMARIO, opacity: trabajando || subiendo ? 0.6 : 1 }} disabled={trabajando || subiendo} onClick={() => guardar(true)}>
          {trabajando ? "Guardando..." : gasto?.estado === "devuelto" ? "Corregir y reenviar" : "Enviar a revisión"}
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={{ ...BTN_SM, flex: 1, padding: "10px" }} disabled={trabajando || subiendo} onClick={() => guardar(false)}>Guardar borrador</button>
          <button type="button" style={{ ...BTN_SM, flex: 1, padding: "10px" }} disabled={trabajando} onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </Card>
  );
}

function FilaGasto({ g, onAbrir, onAnular }) {
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const editable = g.estado === "borrador" || g.estado === "devuelto";
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{g.concepto}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{fechaDia(g.fecha)} · {g.proveedor}{g.soportes.length === 0 ? " · sin soporte" : ""}</div>
          {g.estado === "devuelto" && g.motivo_devolucion && <div style={{ fontSize: 12, color: C.danger, marginTop: 2 }}>{g.motivo_devolucion}</div>}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{pesos(g.valor)}</div>
          <Estado estado={g.estado} />
        </div>
      </div>
      {editable && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button style={{ ...BTN_SM, color: C.blueMid, borderColor: C.blueMid }} onClick={() => onAbrir(g)}>{g.estado === "devuelto" ? "Corregir" : "Completar y enviar"}</button>
          {g.estado === "borrador" && <button style={BTN_SM} onClick={() => setAnulando(!anulando)}>{anulando ? "Cancelar" : "Anular"}</button>}
        </div>
      )}
      {anulando && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por qué se anula" style={{ ...INP, flex: 1 }} />
          <button style={{ ...BTN_SM, color: C.danger, borderColor: C.danger }} onClick={async () => {
            if (!motivo.trim()) { setError("Escribe el motivo."); return; }
            try { await onAnular(g, motivo); } catch (err) { setError(err.message); }
          }}>Anular</button>
        </div>
      )}
      {error && <div style={{ color: C.danger, fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// "Mi caja": saldo, gastos y desembolsos de la caja menor del ingeniero.
export function MiCaja() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cajaId, setCajaId] = useState(null);
  const [formGasto, setFormGasto] = useState(null); // null | "nuevo" | gasto
  const [aviso, setAviso] = useState("");
  const [confirmandoId, setConfirmandoId] = useState(null);

  const cargar = async () => {
    try {
      const d = await cargarMiCaja();
      setDatos(d);
      setError("");
      setCajaId((actual) => (d.cajas.some((c) => c.id === actual) ? actual : d.cajas[0]?.id || null));
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => { cargar(); }, []);

  if (error && !datos) return (
    <Card><div style={{ color: C.danger, fontSize: 14 }}>⚠️ {error}</div><button style={{ ...BTN_SM, marginTop: 10 }} onClick={cargar}>Reintentar</button></Card>
  );
  if (!datos) return <div style={{ color: C.muted, fontSize: 14 }}>Cargando tu caja...</div>;
  if (datos.cajas.length === 0) return (
    <Card><div style={{ color: C.muted, fontSize: 14 }}>No tienes una caja menor asignada. Pídele a Tesorería que la cree a tu nombre.</div></Card>
  );

  const caja = datos.cajas.find((c) => c.id === cajaId) || datos.cajas[0];
  const r = caja.resumen;
  const porConfirmar = caja.movimientos.filter((m) => m.estado === "enviado" && m.valor > 0);
  const devueltos = caja.gastos.filter((g) => g.estado === "devuelto");
  const borradores = caja.gastos.filter((g) => g.estado === "borrador");
  const resto = caja.gastos.filter((g) => g.estado !== "devuelto" && g.estado !== "borrador");
  const alertas = [
    r.saldo_bajo && "Saldo bajo: pide reposición pronto.",
    r.gastos_vencidos > 0 && `Tienes ${r.gastos_vencidos} gasto(s) sin enviar después de ${caja.dias_legalizar} días.`,
    r.gastos_sin_soporte > 0 && `${r.gastos_sin_soporte} gasto(s) sin foto de soporte.`,
  ].filter(Boolean);

  const listo = async (msg) => { setFormGasto(null); setAviso(msg); await cargar(); };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      {datos.cajas.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {datos.cajas.map((c) => (
            <button key={c.id} onClick={() => { setCajaId(c.id); setFormGasto(null); }}
              style={{ ...BTN_SM, background: c.id === caja.id ? C.blue : "none", color: c.id === caja.id ? "#fff" : C.muted }}>
              {c.proyecto}
            </button>
          ))}
        </div>
      )}

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: C.muted }}>{caja.nombre} · {caja.proyecto}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>Efectivo disponible</div>
        <div style={{ fontSize: 34, fontWeight: 700, color: r.saldo_bajo ? C.danger : C.blue, fontVariantNumeric: "tabular-nums", lineHeight: 1.15 }}>{pesos(r.saldo_operativo)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 14, fontSize: 13 }}>
          <div><div style={{ color: C.muted, fontSize: 11.5 }}>Por legalizar</div><b>{pesos(r.por_legalizar)}</b></div>
          <div><div style={{ color: C.muted, fontSize: 11.5 }}>En revisión</div><b>{pesos(r.en_revision)}</b></div>
          <div><div style={{ color: C.muted, fontSize: 11.5 }}>Aprobado, por reponer</div><b style={{ color: C.green }}>{pesos(r.aprobado_sin_reponer)}</b></div>
          <div><div style={{ color: C.muted, fontSize: 11.5 }}>Fondo de la caja</div><b>{pesos(r.fondo_autorizado)}</b></div>
        </div>
        {alertas.map((a) => <div key={a} style={{ color: C.danger, fontSize: 13, marginTop: 8 }}>⚠️ {a}</div>)}
      </Card>

      {porConfirmar.map((m) => (
        <Card key={m.id} borderColor={C.warn} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 14, color: C.text }}>
            Tesorería registró una {TIPO_MOV[m.tipo]?.toLowerCase() || "entrega"} de <b>{pesos(m.valor)}</b>{m.descripcion ? ` (${m.descripcion})` : ""}. ¿Ya la recibiste?
          </div>
          <button style={{ ...BTN_PRIMARIO, marginTop: 10, opacity: confirmandoId === m.id ? 0.6 : 1 }} disabled={confirmandoId === m.id}
            onClick={async () => {
              setConfirmandoId(m.id);
              try { await confirmarRecibido(m.id); setAviso("Recibido confirmado. Ya suma a tu saldo."); await cargar(); }
              catch (err) { setAviso(""); setError(err.message); }
              finally { setConfirmandoId(null); }
            }}>
            Sí, lo recibí
          </button>
        </Card>
      ))}

      {aviso && <div style={{ background: C.green + "18", color: C.green, borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 12 }}>✅ {aviso}</div>}
      {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}

      {formGasto ? (
        <FormGasto key={formGasto === "nuevo" ? "nuevo" : formGasto.id} caja={caja} gasto={formGasto === "nuevo" ? null : formGasto}
          onListo={listo} onCancelar={() => setFormGasto(null)} />
      ) : (
        caja.estado === "abierta" && <button style={{ ...BTN_PRIMARIO, marginBottom: 14 }} onClick={() => { setAviso(""); setFormGasto("nuevo"); }}>+ Registrar gasto</button>
      )}

      {devueltos.length > 0 && (
        <Card borderColor={C.danger} style={{ marginBottom: 14 }}>
          <SectionTitle color={C.danger}>Devueltos por Contabilidad</SectionTitle>
          {devueltos.map((g) => <FilaGasto key={g.id} g={g} onAbrir={setFormGasto} />)}
        </Card>
      )}
      {borradores.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <SectionTitle>Borradores sin enviar</SectionTitle>
          {borradores.map((g) => (
            <FilaGasto key={g.id} g={g} onAbrir={setFormGasto}
              onAnular={async (gasto, motivo) => { await anularGasto(gasto.id, motivo); setAviso("Borrador anulado."); await cargar(); }} />
          ))}
        </Card>
      )}
      <Card style={{ marginBottom: 14 }}>
        <SectionTitle>Gastos</SectionTitle>
        {resto.length === 0 ? <div style={{ color: C.muted, fontSize: 13 }}>Todavía no hay gastos enviados.</div>
          : resto.map((g) => <FilaGasto key={g.id} g={g} onAbrir={setFormGasto} />)}
      </Card>
      {caja.movimientos.length > 0 && (
        <Card>
          <SectionTitle>Entregas de dinero</SectionTitle>
          {caja.movimientos.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderTop: `1px solid ${C.border}`, padding: "8px 0", fontSize: 13 }}>
              <div>{TIPO_MOV[m.tipo] || m.tipo}{m.descripcion ? ` · ${m.descripcion}` : ""}<div style={{ fontSize: 11.5, color: C.muted }}>{m.estado === "recibido" ? `Recibido ${new Date(m.recibido_at).toLocaleDateString("es-CO")}` : "Sin confirmar"}</div></div>
              <b style={{ fontVariantNumeric: "tabular-nums" }}>{pesos(m.valor)}</b>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
