import { useEffect, useState } from "react";
import { C, INP } from "../lib/constants.js";
import { SydLogo } from "./ui.jsx";
import { loadMiCorreo, guardarContactoNotificacion } from "../lib/api.js";
import { apiMensajes } from "../lib/mensajes.js";

// Datos de contacto obligatorios (Miguel, 2026-11-18): si a la persona le falta
// el celular o un correo real, no puede usar la app hasta actualizarlos. El
// celular y el correo quedan en su ficha de Mensajes (avisos por WhatsApp y
// correo, en SYD Gestión) y el correo también en "Mi correo" de esta app.
export function ActualizarDatos({ usuario, datos, onListo, onSalir }) {
  const [f, setF] = useState({ email: datos?.email || "", telefono: datos?.telefono || "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!datos?.email) loadMiCorreo(usuario.id).then(c => { if (c) setF(x => ({ ...x, email: x.email || c })); }).catch(() => {});
  }, [usuario.id]);

  const tel = f.telefono.replace(/\D/g, "");
  const telOk = tel.length === 10 && tel.startsWith("3");
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim()) && !/^syd-user-/i.test(f.email.trim());

  async function guardar(e) {
    e.preventDefault();
    if (!telOk) { setError("Escribe tu celular con 10 dígitos, empezando por 3 (ej. 300 123 4567)."); return; }
    if (!emailOk) { setError("Escribe un correo válido (ej. nombre@gmail.com)."); return; }
    setGuardando(true); setError("");
    try {
      const email = f.email.trim().toLowerCase();
      await apiMensajes.guardarMisDatos({ telefono: tel, email });
      await guardarContactoNotificacion(usuario.id, email);
      onListo();
    } catch (err) { setError(err.message); setGuardando(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form onSubmit={guardar} style={{ background: C.bgCard, borderRadius: 16, boxShadow: "0 10px 40px #1b3a6b14", padding: "26px 24px", width: "100%", maxWidth: 420 }}>
        <div style={{ marginBottom: 14 }}><SydLogo size={30} /></div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>Actualiza tus datos</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.45 }}>
          Hola {usuario.nombre}. Antes de continuar necesitamos tu celular y tu correo: por ahí te llegan los avisos de la aplicación (mensajes sin leer, informes pendientes y otros).
        </div>
        <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 12 }}>Celular (WhatsApp)
          <input value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} placeholder="300 123 4567" inputMode="numeric" autoFocus
            style={{ ...INP, display: "block", marginTop: 4, borderColor: f.telefono && !telOk ? C.danger : C.border }} />
        </label>
        <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 14 }}>Correo electrónico
          <input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="nombre@gmail.com" type="email"
            style={{ ...INP, display: "block", marginTop: 4, borderColor: f.email && !emailOk ? C.danger : C.border }} />
        </label>
        {error && <div style={{ color: C.danger, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={guardando} style={{ flex: 1, background: C.blue, color: "#fff", border: "none", borderRadius: 12, padding: 11, cursor: "pointer", fontWeight: 600 }}>
            {guardando ? "Guardando..." : "Guardar y continuar"}
          </button>
          <button type="button" onClick={onSalir} style={{ background: "none", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 12, padding: "0 14px", cursor: "pointer" }}>Salir</button>
        </div>
      </form>
    </div>
  );
}
