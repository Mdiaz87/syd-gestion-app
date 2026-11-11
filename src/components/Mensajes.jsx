import { useEffect, useMemo, useRef, useState } from 'react';
import { C, INP, BTN_SM } from "../lib/constants.js";
import { Card } from "./ui.jsx";

// Mensajes internos (Miguel, 2026-11-10). Copia del mismo archivo de SYD
// Gestión (src/modules/mensajes/Mensajes.jsx); solo cambian los imports de arriba: cada app le pasa su
// `api` (en Gestión llama la base directo; en Técnica, el puente).
// Reglas (en la base): los Directivos ven todo; lo de un área solo lo ven sus
// miembros; los vendedores solo ven las conversaciones en las que participan.

const BTN = { background: C.blue, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const ESTADO_PAGO = {
  PENDIENTE_DE_REVISION: 'esperando aprobación', APROBADO: 'aprobado, esperando lote', INCLUIDO_EN_LOTE: 'en un lote',
  PAGADO: 'pagado', RECHAZADO: 'rechazado', DEVUELTO_PARA_CORRECCION: 'devuelto para corregir'
};
const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0);
function cuando(iso) {
  if (!iso) return '';
  const d = new Date(iso), hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  return mismoDia ? d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

// Formulario para escribir un mensaje nuevo (también lo usa "Escribir sobre esto").
export function NuevoMensaje({ api, referencia, onEnviado, onCancelar }) {
  const [dir, setDir] = useState(null);
  const [para, setPara] = useState('');
  const [buscar, setBuscar] = useState('');
  const [asunto, setAsunto] = useState(referencia?.texto || '');
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { api.directorio().then(setDir).catch(e => setError(e.message)); }, []);

  const q = buscar.trim().toLowerCase();
  const personas = (dir?.personas || []).filter(p => !q || p.nombre.toLowerCase().includes(q) || (p.cargo || '').toLowerCase().includes(q));
  const areas = (dir?.areas || []).filter(a => !q || a.nombre.toLowerCase().includes(q));
  const areaElegida = para.startsWith('a:') ? dir?.areas.find(a => a.id === para.slice(2)) : null;

  async function enviar() {
    if (!para) { setError('Escoge a quién va el mensaje.'); return; }
    if (!texto.trim()) { setError('Escribe el mensaje.'); return; }
    setEnviando(true); setError('');
    try {
      const id = await api.enviar({
        [para.startsWith('a:') ? 'area_id' : 'persona_id']: para.slice(2), asunto, texto,
        ref_tipo: referencia?.tipo, ref_id: referencia?.id, ref_texto: referencia?.texto
      });
      onEnviado?.(id);
    } catch (e) { setError(e.message); }
    finally { setEnviando(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {referencia && <div style={{ fontSize: 12.5, color: C.muted, background: C.bgCard2, borderRadius: 8, padding: '8px 10px' }}>Sobre: <b style={{ color: C.text }}>{referencia.texto}</b></div>}
      <div>
        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 4 }}>Para</div>
        <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar persona o área" style={{ ...INP, marginBottom: 6 }} />
        <select value={para} onChange={e => setPara(e.target.value)} size={6} style={{ ...INP, height: 'auto' }}>
          {!dir && <option disabled>Cargando...</option>}
          {areas.length > 0 && (
            <optgroup label="Áreas (lo ven todos sus miembros)">
              {areas.map(a => <option key={a.id} value={'a:' + a.id}>{a.nombre}{a.miembros.length ? ` — ${a.miembros.join(', ')}` : ' — sin miembros'}</option>)}
            </optgroup>
          )}
          {personas.length > 0 && (
            <optgroup label="Personas">
              {personas.map(p => <option key={p.id} value={'p:' + p.id}>{p.nombre}{p.cargo ? ` · ${p.cargo}` : ''} ({p.app})</option>)}
            </optgroup>
          )}
        </select>
        {areaElegida && areaElegida.miembros.length === 0 && <div style={{ fontSize: 12, color: C.warn, marginTop: 4 }}>Esta área todavía no tiene miembros: nadie recibiría el mensaje.</div>}
      </div>
      <label style={{ fontSize: 11.5, color: C.muted }}>Asunto
        <input value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Ej. Aprobar pago de Develop" style={{ ...INP, marginTop: 4 }} />
      </label>
      <label style={{ fontSize: 11.5, color: C.muted }}>Mensaje
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={4} placeholder="Escribe aquí..." style={{ ...INP, marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }} />
      </label>
      {error && <div style={{ color: C.danger, fontSize: 12.5 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ ...BTN, opacity: enviando ? 0.6 : 1 }} disabled={enviando} onClick={enviar}>{enviando ? 'Enviando...' : 'Enviar'}</button>
        {onCancelar && <button style={BTN_SM} onClick={onCancelar}>Cancelar</button>}
      </div>
    </div>
  );
}

export function Mensajes({ api, onIrARegistro, alCambiarNoLeidos }) {
  const [filtro, setFiltro] = useState('mias');
  const [lista, setLista] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [vista, setVista] = useState('conversacion'); // conversacion | nuevo | avisos | admin
  const [yo, setYo] = useState(null);
  const [error, setError] = useState('');
  const angosto = useAngosto();

  const cargarLista = () => api.bandeja(filtro === 'todas' ? 'todas' : 'mias').then(l => { setLista(l); setError(''); }).catch(e => setError(e.message));
  useEffect(() => { cargarLista(); const t = setInterval(cargarLista, 30000); return () => clearInterval(t); }, [filtro]);
  useEffect(() => { api.directorio().then(d => setYo(d.yo)).catch(() => {}); }, []);

  const visibles = (lista || []).filter(c => filtro !== 'sin_leer' || c.no_leidos > 0);
  const totalNoLeidos = (lista || []).reduce((s, c) => s + Number(c.no_leidos || 0), 0);
  useEffect(() => { if (lista && filtro !== 'todas') alCambiarNoLeidos?.(totalNoLeidos); }, [totalNoLeidos]);

  const mostrarLista = !angosto || (!abierta && vista === 'conversacion');
  const mostrarDerecha = !angosto || abierta || vista !== 'conversacion';

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {[['mias', 'Mis conversaciones'], ['sin_leer', 'Sin leer'], ...(yo?.ve_todo ? [['todas', 'Todas (Directivo)']] : [])].map(([id, label]) => (
          <button key={id} onClick={() => { setFiltro(id); setAbierta(null); setVista('conversacion'); }}
            style={{ ...BTN_SM, background: filtro === id ? C.blue : 'none', color: filtro === id ? '#fff' : C.muted, borderColor: filtro === id ? C.blue : C.border }}>
            {label}{id === 'sin_leer' && totalNoLeidos ? ` (${totalNoLeidos})` : ''}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button style={BTN_SM} onClick={() => { setVista('avisos'); setAbierta(null); }}>Mis avisos</button>
        {yo?.ve_todo && <button style={BTN_SM} onClick={() => { setVista('admin'); setAbierta(null); }}>Administrar</button>}
        <button style={BTN} onClick={() => { setVista('nuevo'); setAbierta(null); }}>+ Nuevo mensaje</button>
      </div>
      {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: angosto ? '1fr' : 'minmax(260px, 340px) 1fr', gap: 12, alignItems: 'start' }}>
        {mostrarLista && (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {!lista && <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Cargando...</div>}
            {lista && visibles.length === 0 && <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>{filtro === 'sin_leer' ? 'No tienes mensajes sin leer.' : 'Todavía no hay conversaciones. Pulsa "+ Nuevo mensaje".'}</div>}
            {visibles.map(c => (
              <button key={c.id} onClick={() => { setAbierta(c.id); setVista('conversacion'); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderBottom: `1px solid ${C.border}`, padding: '11px 14px', cursor: 'pointer',
                  background: abierta === c.id ? C.bgCard2 : 'transparent', fontFamily: 'inherit' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: c.no_leidos > 0 ? 700 : 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.asunto}</span>
                  <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{cuando(c.ultimo_at)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: C.blueMid, marginTop: 1 }}>
                  {c.area ? `Área ${c.area}` : (c.participantes || []).join(', ') || c.creada_por}
                  {!c.soy_destinatario && <span style={{ color: C.muted }}> · solo consulta</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                  <span style={{ flex: 1, fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.ultimo ? `${c.ultimo.mio ? 'Tú' : c.ultimo.autor.split(' ')[0]}: ${c.ultimo.texto}` : ''}
                  </span>
                  {c.no_leidos > 0 && <span style={{ background: C.danger, color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>{c.no_leidos}</span>}
                </div>
              </button>
            ))}
          </Card>
        )}
        {mostrarDerecha && (
          <div>
            {angosto && (abierta || vista !== 'conversacion') && (
              <button style={{ ...BTN_SM, marginBottom: 8 }} onClick={() => { setAbierta(null); setVista('conversacion'); }}>← Conversaciones</button>
            )}
            {vista === 'nuevo' && (
              <Card><div style={{ fontWeight: 700, color: C.text, marginBottom: 10 }}>Nuevo mensaje</div>
                <NuevoMensaje api={api} onCancelar={() => setVista('conversacion')}
                  onEnviado={id => { setVista('conversacion'); setFiltro('mias'); setAbierta(id); cargarLista(); }} />
              </Card>
            )}
            {vista === 'avisos' && <MisAvisos api={api} yo={yo} onGuardado={d => setYo(d)} />}
            {vista === 'admin' && <Administrar api={api} />}
            {vista === 'conversacion' && abierta && <Conversacion key={abierta} api={api} id={abierta} onIrARegistro={onIrARegistro} onCambio={cargarLista} />}
            {vista === 'conversacion' && !abierta && !angosto && (
              <Card><div style={{ color: C.muted, fontSize: 13 }}>Escoge una conversación de la lista, o escribe un mensaje nuevo a una persona o a un área (Contabilidad, Tesorería...).</div></Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function useAngosto() {
  const [angosto, setAngosto] = useState(typeof window !== 'undefined' && window.innerWidth < 760);
  useEffect(() => {
    const f = () => setAngosto(window.innerWidth < 760);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return angosto;
}

function Conversacion({ api, id, onIrARegistro, onCambio }) {
  const [c, setC] = useState(null);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef(null);
  const ultimoId = useRef(null);

  const cargar = () => api.abrir(id).then(d => { setC(d); onCambio?.(); }).catch(e => setError(e.message));
  useEffect(() => { cargar(); const t = setInterval(cargar, 15000); return () => clearInterval(t); }, [id]);
  useEffect(() => {
    const ult = c?.mensajes?.[c.mensajes.length - 1]?.id;
    if (ult && ult !== ultimoId.current) { ultimoId.current = ult; finRef.current?.scrollIntoView({ block: 'nearest' }); }
  }, [c]);

  const vistoPor = useMemo(() => {
    if (!c) return [];
    const misMensajes = c.mensajes.filter(m => m.mio);
    const ultimoMio = misMensajes[misMensajes.length - 1];
    if (!ultimoMio || c.mensajes[c.mensajes.length - 1].id !== ultimoMio.id) return [];
    return c.participantes.filter(p => !p.yo && p.leido_hasta && new Date(p.leido_hasta) >= new Date(ultimoMio.created_at)).map(p => p.nombre.split(' ')[0]);
  }, [c]);

  async function responder() {
    if (!texto.trim()) return;
    setEnviando(true); setError('');
    try { await api.enviar({ conversacion_id: id, texto }); setTexto(''); await cargar(); }
    catch (e) { setError(e.message); }
    finally { setEnviando(false); }
  }

  if (!c) return <Card><div style={{ color: error ? C.danger : C.muted, fontSize: 13 }}>{error || 'Cargando...'}</div></Card>;
  const quienes = c.area
    ? `Área ${c.area}: ${c.miembros_area.join(', ') || 'sin miembros'}`
    : c.participantes.map(p => (p.yo ? 'Tú' : p.nombre)).join(', ');

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{c.asunto}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{quienes}</div>
        {c.ref && (
          <div style={{ marginTop: 10, background: C.bgCard2, borderRadius: 10, padding: '9px 12px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{c.ref.tipo} · {ESTADO_PAGO[c.ref.estado] || String(c.ref.estado || '').toLowerCase().replace(/_/g, ' ')}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{c.ref.titulo}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{c.ref.detalle}{c.ref.valor != null ? ` · ${fmt(c.ref.valor)}` : ''}</div>
            </div>
            {onIrARegistro && <button style={BTN_SM} onClick={() => onIrARegistro(c.ref_tipo, c.ref_id, c.ref)}>Ir al {c.ref.tipo.toLowerCase()}</button>}
          </div>
        )}
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 460, overflowY: 'auto', background: '#fafbfd' }}>
        {c.mensajes.map(m => (
          <div key={m.id} style={{ alignSelf: m.mio ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
            {!m.mio && <div style={{ fontSize: 11, color: C.blueMid, fontWeight: 600, marginBottom: 2 }}>{m.autor}</div>}
            <div style={{ background: m.mio ? C.blue : C.bgCard, color: m.mio ? '#fff' : C.text, border: m.mio ? 'none' : `1px solid ${C.border}`,
              borderRadius: 14, padding: '8px 12px', fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.texto}</div>
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2, textAlign: m.mio ? 'right' : 'left' }}>{cuando(m.created_at)}</div>
          </div>
        ))}
        {vistoPor.length > 0 && <div style={{ alignSelf: 'flex-end', fontSize: 11, color: C.green }}>✓ Visto por {vistoPor.join(', ')}</div>}
        <div ref={finRef} />
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${C.border}` }}>
        {!c.soy_destinatario && <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 6 }}>Estás consultando esta conversación como Directivo. Si respondes, pasas a participar en ella.</div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2} placeholder="Escribe una respuesta..."
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) responder(); }}
            style={{ ...INP, flex: 1, resize: 'vertical', fontFamily: 'inherit' }} />
          <button style={{ ...BTN, opacity: enviando || !texto.trim() ? 0.6 : 1 }} disabled={enviando || !texto.trim()} onClick={responder}>{enviando ? '...' : 'Enviar'}</button>
        </div>
        {error && <div style={{ color: C.danger, fontSize: 12, marginTop: 6 }}>{error}</div>}
      </div>
    </Card>
  );
}

function MisAvisos({ api, yo, onGuardado }) {
  const [f, setF] = useState({ telefono: yo?.telefono || '', avisos_correo: yo?.avisos_correo !== false, avisos_whatsapp: yo?.avisos_whatsapp !== false });
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  async function guardar() {
    setError(''); setAviso('');
    try { await api.guardarMisDatos(f); setAviso('Guardado.'); const d = await api.directorio(); onGuardado(d.yo); }
    catch (e) { setError(e.message); }
  }
  return (
    <Card>
      <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>Mis avisos</div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12 }}>
        Si un mensaje lleva un rato sin leerse, te avisamos por correo{yo?.email ? ` (${yo.email})` : ''} y por WhatsApp. Solo de lunes a sábado, de 7 a. m. a 7 p. m.
      </div>
      <label style={{ fontSize: 11.5, color: C.muted, display: 'block', maxWidth: 260 }}>Celular con WhatsApp
        <input value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} placeholder="3001234567" inputMode="numeric" style={{ ...INP, marginTop: 4 }} />
      </label>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={f.avisos_correo} onChange={e => setF({ ...f, avisos_correo: e.target.checked })} /> Avisarme por correo</label>
        <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={f.avisos_whatsapp} onChange={e => setF({ ...f, avisos_whatsapp: e.target.checked })} /> Avisarme por WhatsApp</label>
      </div>
      {!yo?.email && <div style={{ fontSize: 12, color: C.warn, marginTop: 8 }}>No tienes correo registrado en la app: el aviso por correo no te llegará.</div>}
      <button style={{ ...BTN, marginTop: 12 }} onClick={guardar}>Guardar</button>
      {aviso && <span style={{ color: C.green, fontSize: 12.5, marginLeft: 10 }}>{aviso}</span>}
      {error && <div style={{ color: C.danger, fontSize: 12.5, marginTop: 6 }}>{error}</div>}
    </Card>
  );
}

function Administrar({ api }) {
  const [d, setD] = useState(null);
  const [areaSel, setAreaSel] = useState(null);
  const [miembros, setMiembros] = useState([]);
  const [nombreArea, setNombreArea] = useState('');
  const [telefonos, setTelefonos] = useState({});
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const cargar = () => api.admin().then(x => { setD(x); setTelefonos(Object.fromEntries(x.personas.map(p => [p.id, p.telefono || '']))); }).catch(e => setError(e.message));
  useEffect(() => { cargar(); }, []);
  async function guardar(p, msg) {
    setError(''); setAviso('');
    try { await api.adminGuardar(p); setAviso(msg); await cargar(); } catch (e) { setError(e.message); }
  }
  if (!d) return <Card><div style={{ color: error ? C.danger : C.muted, fontSize: 13 }}>{error || 'Cargando...'}</div></Card>;
  const area = d.areas.find(a => a.id === areaSel);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {aviso && <div style={{ color: C.green, fontSize: 13 }}>{aviso}</div>}
      {error && <div style={{ color: C.danger, fontSize: 13 }}>{error}</div>}
      <Card>
        <div style={{ fontWeight: 700, color: C.text, marginBottom: 8 }}>Áreas y sus miembros</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {d.areas.map(a => (
            <button key={a.id} onClick={() => { setAreaSel(a.id); setMiembros(a.miembros); setNombreArea(a.nombre); }}
              style={{ ...BTN_SM, background: areaSel === a.id ? C.blue : 'none', color: areaSel === a.id ? '#fff' : C.muted }}>{a.nombre} ({a.miembros.length})</button>
          ))}
          <button style={BTN_SM} onClick={() => { setAreaSel('nueva'); setMiembros([]); setNombreArea(''); }}>+ Área nueva</button>
        </div>
        {(area || areaSel === 'nueva') && (
          <div>
            <input value={nombreArea} onChange={e => setNombreArea(e.target.value)} placeholder="Nombre del área" style={{ ...INP, maxWidth: 280, marginBottom: 8 }} />
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Marca quiénes reciben y ven lo que se le escribe a esta área. Los vendedores no pueden ser miembros.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
              {d.personas.filter(p => !p.vendedor).map(p => (
                <label key={p.id} style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={miembros.includes(p.id)} onChange={e => setMiembros(e.target.checked ? [...miembros, p.id] : miembros.filter(x => x !== p.id))} />
                  {p.nombre} <span style={{ color: C.muted }}>· {p.cargo}</span>
                </label>
              ))}
            </div>
            <button style={{ ...BTN, marginTop: 10 }} onClick={() => guardar({ que: 'area', area_id: areaSel === 'nueva' ? '' : areaSel, nombre: nombreArea, miembros }, 'Área guardada.')}>Guardar área</button>
          </div>
        )}
      </Card>
      <Card>
        <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>Avisos</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={d.config.correo_activo} onChange={e => guardar({ que: 'config', correo_activo: e.target.checked }, 'Guardado.')} /> Correo encendido</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={d.config.whatsapp_activo} onChange={e => guardar({ que: 'config', whatsapp_activo: e.target.checked }, 'Guardado.')} /> WhatsApp encendido</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>Avisar después de
            <select value={d.config.minutos_espera} onChange={e => guardar({ que: 'config', minutos_espera: Number(e.target.value) }, 'Guardado.')} style={{ ...INP, width: 110, padding: '5px 8px' }}>
              {[15, 30, 60, 120, 240].map(m => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}
            </select> sin leer
          </label>
        </div>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>El WhatsApp necesita la plantilla aprobada por Meta; enciéndelo cuando esté aprobada.</div>
      </Card>
      <Card>
        <div style={{ fontWeight: 700, color: C.text, marginBottom: 8 }}>Personas</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr style={{ color: C.muted, textAlign: 'left' }}><th style={{ padding: 6 }}>Persona</th><th style={{ padding: 6 }}>App</th><th style={{ padding: 6 }}>Correo</th><th style={{ padding: 6 }}>Celular WhatsApp</th><th style={{ padding: 6 }}>En el directorio</th></tr></thead>
            <tbody>
              {d.personas.map(p => (
                <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: 6 }}><b>{p.nombre}</b><div style={{ color: C.muted, fontSize: 11.5 }}>{p.cargo}{p.vendedor ? ' · vendedor' : ''}</div></td>
                  <td style={{ padding: 6, whiteSpace: 'nowrap' }}>{p.app}</td>
                  <td style={{ padding: 6 }}>{p.email || <span style={{ color: C.warn }}>sin correo</span>}</td>
                  <td style={{ padding: 6, whiteSpace: 'nowrap' }}>
                    <input value={telefonos[p.id] ?? ''} onChange={e => setTelefonos({ ...telefonos, [p.id]: e.target.value })} placeholder="3001234567" style={{ ...INP, width: 130, padding: '5px 8px', display: 'inline-block' }} />
                    {(telefonos[p.id] || '') !== (p.telefono || '') && <button style={{ ...BTN_SM, marginLeft: 6 }} onClick={() => guardar({ que: 'persona', persona_id: p.id, telefono: telefonos[p.id] }, 'Celular guardado.')}>Guardar</button>}
                  </td>
                  <td style={{ padding: 6 }}><input type="checkbox" checked={!p.oculto} onChange={e => guardar({ que: 'persona', persona_id: p.id, telefono: p.telefono || '', oculto: !e.target.checked }, 'Guardado.')} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
