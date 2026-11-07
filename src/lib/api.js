import { supabase, createScratchClient } from "../supabase.js";
import { enviarAlertaPresupuesto, enviarNotificacionPago, subirSoporteCuentaCobro } from "./pdf.js";

// Dominio real de la empresa: Supabase Auth exige un dominio con DNS válido,
// no acepta dominios inventados. Las direcciones son sintéticas (no reciben
// correo real), solo sirven como usuario para el login.
const EMAIL_DOMAIN = "sydinversiones.com";
const emailFor = (key) => `syd-user-${key}@${EMAIL_DOMAIN}`;
const passwordFor = (key, pin) => `syd-${key}-${pin}`;
const genPin = () => String(Math.floor(1000 + Math.random() * 9000));

// ── INFORMES ──────────────────────────────────────────────────────────────────
export async function loadReports(){
  const { data, error } = await supabase
    .from('reports')
    .select('data')
    .order('id', { ascending: true });
  if(error){ console.error('Error cargando informes:', error); return null; }
  return (data || []).map(row => row.data);
}
export async function saveReport(report, isEdit = false){
  const sinFotos = JSON.parse(JSON.stringify(report));
  if(sinFotos.days)    sinFotos.days    = sinFotos.days.map(d=>({...d,photos:[]}));
  if(sinFotos.frentes) sinFotos.frentes = sinFotos.frentes.map(f=>({...f,photos:[]}));
  const { error } = isEdit
    ? await supabase.from('reports').update({ data: sinFotos }).eq('id', report.id)
    : await supabase.from('reports').insert({ id: report.id, data: sinFotos });
  if(error){ console.error('Error guardando informe:', error); return false; }
  return true;
}
export async function deleteReport(id){
  const { error } = await supabase.from('reports').delete().eq('id', id);
  if(error){ console.error('Error eliminando informe:', error); return false; }
  return true;
}

// ── DESTINATARIOS ─────────────────────────────────────────────────────────────
export async function loadDestinatarios(){
  const { data, error } = await supabase.from('destinatarios').select('project, emails');
  if(error){ console.error('Error cargando destinatarios:', error); return {}; }
  return Object.fromEntries((data || []).map(row => [row.project, row.emails]));
}
export async function saveDestinatarios(project, emails){
  const { error } = await supabase
    .from('destinatarios')
    .upsert({ project, emails }, { onConflict: 'project' });
  if(error){ console.error('Error guardando destinatarios:', error); return false; }
  return true;
}

// ── USUARIOS (Supabase Auth real — el PIN nunca se guarda en una tabla) ──────
// null = falló la conexión (distinto de "no hay usuarios"), para que la
// pantalla de login no diga "no hay usuarios configurados" ante un simple
// corte de red.
export async function loadUsuarios(){
  const { data, error } = await supabase.from('profiles').select('id,nombre,rol,activo,email,legacy_id,es_super_admin,proyecto_asignado,ingeniero_coordinador,proyectos_a_cargo').order('nombre');
  if(error){ console.error('Error cargando usuarios:', error); return null; }
  return data || [];
}
// Arma el objeto de sesión (camelCase) a partir de una fila cruda de
// `profiles` (snake_case) — usado tanto en login directo como al restaurar
// sesión, para que ambos caminos queden siempre consistentes.
export function shapeUsuario(profile){
  const { id, nombre, rol, activo, es_super_admin, proyecto_asignado, ingeniero_coordinador, proyectos_a_cargo } = profile;
  return { id, nombre, rol, activo, esSuperAdmin: !!es_super_admin, proyectoAsignado: proyecto_asignado || null,
    ingenieroCoordinador: !!ingeniero_coordinador, proyectosACargo: proyectos_a_cargo || null };
}
// Antes de intentar el login se consulta el bloqueo por fuerza bruta
// (RPC server-side, no depende de nada guardado en el navegador — ver
// [[project_syd]] para el diseño). Si está bloqueado, ni siquiera se
// intenta la contraseña, así nunca se revela si el PIN es correcto.
// Login por servidor (Edge Function iniciar-sesion): bloqueo real de
// intentos y contraseña no derivable desde el navegador. En prueba: solo con
// ?login=v2 en la URL; el resto sigue con el login de siempre.
const LOGIN_V2 = typeof window!=="undefined" && new URLSearchParams(window.location.search).get('login')==='v2';
async function loginServidor(profile, pin){
  const { data, error } = await supabase.functions.invoke('iniciar-sesion', { body: { profileId: profile.id, pin } });
  if(error || !data){ console.error('Error en iniciar-sesion:', error); return null; }
  if(data.bloqueado) return { bloqueado: true, segundosRestantes: data.segundosRestantes };
  if(!data.ok || !data.tokenHash) return null;
  let r = await supabase.auth.verifyOtp({ token_hash: data.tokenHash, type: 'magiclink' });
  if(r.error) r = await supabase.auth.verifyOtp({ token_hash: data.tokenHash, type: 'email' });
  if(r.error){ console.error('Error canjeando la sesión:', r.error); return null; }
  return shapeUsuario(profile);
}

export async function login(profile, pin){
  if(LOGIN_V2) return loginServidor(profile, pin);
  const { data: chk } = await supabase.rpc('intentos_restantes', { p_profile_id: profile.id });
  if(chk?.bloqueado){
    return { bloqueado: true, segundosRestantes: chk.segundos_restantes };
  }
  const key = profile.legacy_id || profile.id;
  const { data, error } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: passwordFor(key, pin),
  });
  if(error){
    console.error('Error verificando código:', error);
    await supabase.rpc('registrar_intento_fallido', { p_profile_id: profile.id });
    return null;
  }
  return shapeUsuario(profile);
}
// Solo puede usarla la cuenta marcada como es_super_admin en profiles —
// corre en una Edge Function con la clave de servicio, nunca en el cliente.
export async function resetearPinDeOtro(targetId){
  const { data, error } = await supabase.functions.invoke('smooth-api', { body: { targetId } });
  if(error){ console.error('Error reseteando código:', error); return null; }
  return data?.pin || null;
}
export async function cambiarMiPin(nuevoPin){
  const { data: { user } } = await supabase.auth.getUser();
  if(!user) return false;
  const { data: profile, error: profileError } = await supabase.from('profiles').select('id,legacy_id').eq('id', user.id).single();
  if(profileError || !profile) { console.error('Error leyendo perfil propio:', profileError); return false; }
  const key = profile.legacy_id || profile.id;
  const { error } = await supabase.auth.updateUser({ password: passwordFor(key, nuevoPin) });
  if(error){ console.error('Error cambiando código:', error); return false; }
  return true;
}
export async function crearUsuario(nombre, rol){
  const scratch = createScratchClient();
  const pin = genPin();
  const key = crypto.randomUUID();
  const email = emailFor(key);
  const { data: signUpData, error: signUpError } = await scratch.auth.signUp({
    email, password: passwordFor(key, pin),
  });
  if(signUpError || !signUpData.user){ console.error('Error creando usuario:', signUpError); return null; }
  const id = signUpData.user.id;
  const { error: profileError } = await scratch.from('profiles').insert({ id, nombre, rol, activo:true, email, legacy_id:key });
  if(profileError){ console.error('Error creando perfil:', profileError); return null; }
  return { id, nombre, rol, pin };
}
export async function editarUsuario(id, nombre, rol, extra={}){
  const { error } = await supabase.from('profiles').update({ nombre, rol, ...extra }).eq('id', id);
  if(error){ console.error('Error editando usuario:', error); return false; }
  return true;
}
export async function setUsuarioActivo(id, activo){
  const { error } = await supabase.from('profiles').update({ activo }).eq('id', id);
  if(error){ console.error('Error activando/desactivando usuario:', error); return false; }
  return true;
}

// ── PRESUPUESTO POR PROYECTO ──────────────────────────────────────────────────
export async function loadPresupuestoProyecto(project){
  const { data, error } = await supabase.from('presupuesto_proyecto').select('*').eq('project', project).order('id', {ascending:true});
  if(error){ console.error('Error cargando presupuesto:', error); return null; }
  return data || [];
}
export async function savePresupuestoProyecto(project, items){
  const rows = items.filter(it=>it.item&&it.item.trim()).map(it=>({
    project,
    categoria: it.item,
    presupuesto: +it.presupuesto || 0,
    is_custom: !!it.isCustom,
    fase: it.fase||"operativa"
  }));
  if(!rows.length) return true;
  const { error } = await supabase.from('presupuesto_proyecto').upsert(rows, {onConflict:'project,categoria'});
  if(error){ console.error('Error guardando presupuesto:', error); return false; }
  return true;
}
export async function loadAllPresupuestoProyecto(){
  const { data, error } = await supabase.from('presupuesto_proyecto').select('*').order('project').order('id', {ascending:true});
  if(error){ console.error('Error cargando presupuestos:', error); return []; }
  return data || [];
}

// Revisa cada categoría del proyecto contra su presupuesto y dispara una
// alerta por correo a los Directivos la primera vez que cruza 90% o 100%
// (nunca se repite: queda marcada en alertado_90/alertado_100).
export async function verificarAlertasPresupuesto(project, financiero, cumAnterior){
  const { data: cats, error } = await supabase.from('presupuesto_proyecto').select('*').eq('project', project);
  if(error || !cats) return;

  const { data: directivos } = await supabase.from('profiles').select('email_notificaciones').eq('rol','Directivo').eq('activo',true);
  const destinatarios = (directivos||[]).map(d=>d.email_notificaciones).filter(Boolean);
  if(!destinatarios.length) return;

  for(const cat of cats){
    if(!cat.presupuesto || cat.presupuesto<=0) continue;
    const item = financiero.find(f=>f.item===cat.categoria);
    const ejecItem = item ? (+item.ejecutado||0) : 0;
    const acumuladoAnterior = (cumAnterior && cumAnterior[cat.categoria]) || 0;
    const ejecutado = acumuladoAnterior + ejecItem;
    const pct = ejecutado/cat.presupuesto*100;

    if(pct>=100 && !cat.alertado_100){
      await enviarAlertaPresupuesto({project, categoria:cat.categoria, presupuesto:cat.presupuesto, ejecutado, pct, umbral:100, destinatarios});
      await supabase.from('presupuesto_proyecto').update({alertado_100:true, alertado_90:true}).eq('id', cat.id);
    } else if(pct>=90 && !cat.alertado_90){
      await enviarAlertaPresupuesto({project, categoria:cat.categoria, presupuesto:cat.presupuesto, ejecutado, pct, umbral:90, destinatarios});
      await supabase.from('presupuesto_proyecto').update({alertado_90:true}).eq('id', cat.id);
    }
  }
}

// ── CUENTAS DE COBRO (Aprobación de Pagos) ────────────────────────────────────
export async function loadCuentasCobro(){
  const { data, error } = await supabase.from('cuentas_cobro').select('*').order('created_at', {ascending:false});
  if(error){ console.error('Error cargando cuentas de cobro:', error); return []; }
  return data || [];
}

export async function crearCuentaCobro({project, empresa, centroCosto, categoria, subcategoria, proveedor, concepto, cantidad, unidad, valor, observaciones, soportes, autor, autorId, partidaLinaje}){
  const row = {
    id: Date.now(),
    project, empresa: empresa||null, centro_costo: centroCosto||null, categoria: categoria||null, subcategoria: subcategoria||null, proveedor, concepto,
    cantidad: cantidad===""?null:+cantidad,
    unidad: unidad||null,
    valor: +valor||0,
    observaciones: observaciones||null,
    soportes: soportes||[],
    partida_linaje: partidaLinaje||null,
    estado: 'pendiente_contable',
    autor, autor_id: autorId,
    historial: [{accion:'Creado', por:autor, fecha:new Date().toISOString()}],
  };
  const { error } = await supabase.from('cuentas_cobro').insert(row);
  if(error){ console.error('Error creando cuenta de cobro:', error); return false; }
  return row.id;
}

export { subirSoporteCuentaCobro };

// Usada por el Directivo para aprobar/devolver/rechazar.
export async function actualizarEstadoCuentaCobro(id, estado, {condicion, motivoRechazo}, revisadoPor){
  const { data: actual } = await supabase.from('cuentas_cobro').select('historial').eq('id', id).single();
  const accionLabel = estado==='aprobado_total' ? 'Aprobado' : estado==='devuelto' ? 'Devuelto' : 'Rechazado';
  const detalle = estado==='devuelto' ? condicion : estado==='rechazado' ? motivoRechazo : null;
  const historial = [...(actual?.historial||[]), {accion:accionLabel, detalle, por:revisadoPor, fecha:new Date().toISOString()}];
  const { error } = await supabase.from('cuentas_cobro').update({
    estado, condicion: condicion||null, motivo_rechazo: motivoRechazo||null,
    revisado_por: revisadoPor, revisado_at: new Date().toISOString(), historial,
  }).eq('id', id);
  if(error){ console.error('Error actualizando cuenta de cobro:', error); return false; }
  return true;
}

// Marca/desmarca si el pago ya se realizó (uso interno de SYD, no se manda
// a ninguna app externa). Solo tiene sentido en cuentas ya aprobadas.
export async function marcarPagoRealizado(id, pagado, por){
  const { data: actual } = await supabase.from('cuentas_cobro').select('historial').eq('id', id).single();
  const historial = [...(actual?.historial||[]), {accion: pagado ? 'Marcado como pagado' : 'Marcado como pendiente de pago', por, fecha:new Date().toISOString()}];
  // .select() al final es necesario: si RLS bloquea la fila, Supabase no lanza
  // error, simplemente actualiza 0 filas — sin esto no hay forma de notarlo.
  const { data, error } = await supabase.from('cuentas_cobro').update({ pago_realizado: pagado, historial }).eq('id', id).select('id');
  if(error){ console.error('Error marcando pago realizado:', error); return false; }
  if(!data?.length){ console.error('Actualización de pago bloqueada por permisos (0 filas afectadas) para cuenta', id); return false; }
  return true;
}

// Usada por el Ingeniero (autor) para corregir su propia cuenta antes de que
// se apruebe. Si estaba "devuelto", la reenvía (vuelve a "pendiente_contable"
// para que pase de nuevo por la revisión de contabilidad).
export async function actualizarCuentaCobro(id, {project, empresa, centroCosto, categoria, subcategoria, proveedor, concepto, cantidad, unidad, valor, observaciones, soportes, partidaLinaje}, editor, estabaDevuelto){
  const { data: actual } = await supabase.from('cuentas_cobro').select('historial').eq('id', id).single();
  const accion = estabaDevuelto ? 'Corregido y reenviado' : 'Editado';
  const historial = [...(actual?.historial||[]), {accion, por:editor, fecha:new Date().toISOString()}];
  const { error } = await supabase.from('cuentas_cobro').update({
    project, empresa: empresa||null, centro_costo: centroCosto||null, categoria: categoria||null, subcategoria: subcategoria||null, proveedor, concepto,
    cantidad: cantidad===""?null:+cantidad,
    unidad: unidad||null,
    valor: +valor||0,
    observaciones: observaciones||null,
    soportes: soportes||[],
    partida_linaje: partidaLinaje||null,
    estado: estabaDevuelto ? 'pendiente_contable' : undefined,
    historial,
  }).eq('id', id);
  if(error){ console.error('Error editando cuenta de cobro:', error); return false; }
  return true;
}

export async function notificarPagoAprobado(cuenta){
  const { data } = await supabase.from('destinatarios').select('emails').eq('project','_contabilidad').single();
  const destinatarios = data?.emails || [];
  if(!destinatarios.length) return false;
  const soportes = cuenta.soportes?.length ? cuenta.soportes : (cuenta.link_soporte ? [{nombre:'Soporte', url:cuenta.link_soporte}] : []);
  const linkSoporte = soportes.map((s,i)=> soportes.length>1 ? `${i+1}. ${s.nombre}: ${s.url}` : s.url).join('\n');
  return await enviarNotificacionPago({
    project: cuenta.project, proveedor: cuenta.proveedor, concepto: cuenta.concepto,
    cantidad: cuenta.cantidad, unidad: cuenta.unidad, valor: cuenta.valor,
    estado: cuenta.estado, condicion: cuenta.condicion, linkSoporte,
    destinatarios,
  });
}

// Al aprobar totalmente una cuenta de cobro, empuja el registro a la app
// administrativa de contabilidad (Edge Function `legalizar-pago`, que a su
// vez llama al webhook de esa app — la llave nunca sale del servidor). Si
// falla, la aprobación en SYD ya quedó guardada de todos modos; solo marca
// legalizacion_estado='error' para poder reintentar con este mismo llamado.
export async function legalizarPago(cuentaId){
  const { data, error } = await supabase.functions.invoke('legalizar-pago', { body: { cuentaId } });
  if(error){ console.error('Error invocando legalizar-pago:', error); return false; }
  return !!data?.ok;
}

// Al aprobar totalmente una cuenta de cobro, además de legalizar-pago, crea
// la obligación correspondiente en Cuentas por Pagar de la otra app
// (Edge Function `aprobacion-cuenta-cobro`). Si falla, no bloquea nada —
// solo marca aprobacion_cxp_estado='error' para poder reintentar.
export async function aprobarCuentaPorPagar(cuentaId){
  const { data, error } = await supabase.functions.invoke('aprobacion-cuenta-cobro', { body: { cuentaId } });
  if(error){ console.error('Error invocando aprobacion-cuenta-cobro:', error); return false; }
  return !!data?.ok;
}

// Sube la factura definitiva de legalización (llega DESPUÉS del pago, la
// entrega el proveedor — distinta del soporte inicial) y la asocia al
// registro correcto en la app de contabilidad vía referenciaExterna.
// facturas: [{nombre, url}] — puede ser la factura más sus anexos.
export async function enviarFacturaLegalizacion(cuentaId, facturas){
  const { data, error } = await supabase.functions.invoke('enviar-factura-legalizacion', { body: { cuentaId, facturas } });
  if(error){ console.error('Error invocando enviar-factura-legalizacion:', error); return false; }
  return !!data?.ok;
}

// Reenvía a SYD Gestión una cuenta ya aprobada por Contabilidad, para la
// aprobación de Susana Sierra -> Miguel Díaz (solo Directivo; normalmente el
// envío es automático al aprobar Contabilidad).
// Cadena de firmas de Gerencia en SYD Técnica por proyecto ('*' = por defecto).
export async function loadAprobadoresGerencia(){
  const { data, error } = await supabase.from('aprobadores_gerencia').select('project, orden, profile_id, profiles(nombre)');
  if(error){ console.error('Error cargando aprobadores:', error); return []; }
  return (data||[]).map(a=>({ project:a.project, orden:a.orden, profile_id:a.profile_id, nombre:a.profiles?.nombre||'' }));
}
// decision: 'aprobar' | 'devolver' | 'rechazar' (estos dos con motivo).
export async function firmarGerencia(cuentaId, decision, motivo){
  const { data, error } = await supabase.functions.invoke('aprobar-gerencia-tecnica', { body: { cuentaId, decision, motivo } });
  if(error){
    let msg = null;
    try{ msg = (await error.context?.json())?.error; }catch(e){}
    console.error('Error invocando aprobar-gerencia-tecnica:', error);
    return { ok:false, error: msg };
  }
  return data || { ok:false };
}

export async function enviarAGerencia(cuentaId){
  const { data, error } = await supabase.functions.invoke('enviar-a-gerencia', { body: { cuentaId } });
  if(error){ console.error('Error invocando enviar-a-gerencia:', error); return false; }
  return !!data?.ok;
}

// Empuja la cuenta de cobro a la app administrativa para que Contabilidad
// la revise ANTES de la aprobación final del Directivo. Se llama al
// registrar una cuenta nueva o al reenviarla tras un "devuelto".
export async function enviarRevisionContable(cuentaId){
  const { data, error } = await supabase.functions.invoke('revision-cuenta-cobro', { body: { cuentaId } });
  if(error){ console.error('Error invocando revision-cuenta-cobro:', error); return false; }
  return !!data?.ok;
}

// Avisos que manda la app de Recaudo y Cartera (cron-legalizaciones) cuando
// una cuenta ya pagada está por vencer o venció sin factura de legalización.
// referencia_externa = cuentas_cobro.id (tal cual se mandó en legalizar-pago).
export async function loadAlertasLegalizacion(){
  const { data, error } = await supabase.from('legalizaciones_alertas_externas').select('referencia_externa,evento,fecha_limite,dias_restantes').not('referencia_externa','is',null);
  if(error){ console.error('Error cargando alertas de legalización:', error); return []; }
  return data || [];
}

// Qué informes debe entregar cada proyecto (recordatorios).
export async function loadObligacionesInformes(){
  const { data, error } = await supabase.from('obligaciones_informes').select('*').order('project');
  if(error){ console.error('Error cargando obligaciones de informes:', error); return []; }
  return data || [];
}
export async function guardarObligacionInforme(project, cambios){
  const { error } = await supabase.from('obligaciones_informes').upsert({ project, ...cambios, updated_at: new Date().toISOString() });
  if(error){ console.error('Error guardando obligación de informe:', error); return false; }
  return true;
}

// Correos reales para recordatorios (tabla aparte de profiles, solo Directivos).
export async function loadContactosNotificacion(){
  const { data, error } = await supabase.from('contactos_notificacion').select('profile_id,email');
  if(error){ console.error('Error cargando correos:', error); return {}; }
  return Object.fromEntries((data||[]).map(c=>[c.profile_id, c.email]));
}
export async function loadMiCorreo(profileId){
  const { data } = await supabase.from('contactos_notificacion').select('email').eq('profile_id', profileId).maybeSingle();
  return data?.email || "";
}
export async function guardarContactoNotificacion(profileId, email){
  const limpio = (email||'').trim();
  const { error } = limpio
    ? await supabase.from('contactos_notificacion').upsert({ profile_id: profileId, email: limpio, updated_at: new Date().toISOString() })
    : await supabase.from('contactos_notificacion').delete().eq('profile_id', profileId);
  if(error){ console.error('Error guardando correo:', error); return false; }
  return true;
}

// Plan semanal de los ingenieros (se coteja con los registros de coordinadores).
export async function loadPlanesSemanales(){
  const desde = new Date(Date.now()-120*86400000).toISOString().slice(0,10);
  const { data, error } = await supabase.from('planes_semanales').select('*').gte('semana', desde).order('semana', {ascending:false});
  if(error){ console.error('Error cargando planes semanales:', error); return []; }
  return data || [];
}
export async function guardarPlanSemanal(plan){
  const { id, created_at, ...resto } = plan;
  const { error } = await supabase.from('planes_semanales').upsert({ ...resto, updated_at: new Date().toISOString() }, { onConflict: 'project,semana' });
  if(error){ console.error('Error guardando plan semanal:', error); return false; }
  return true;
}

// ── PRESUPUESTOS DE OBRA ──────────────────────────────────────────────────────
export async function loadPresupuestos(){
  const { data, error } = await supabase.from('presupuestos').select('*').order('project').order('nombre').order('version', {ascending:false});
  if(error){ console.error('Error cargando presupuestos:', error); return []; }
  return data || [];
}
export async function loadPartidas(presupuestoId){
  const { data, error } = await supabase.from('partidas').select('*').eq('presupuesto_id', presupuestoId).order('orden');
  if(error){ console.error('Error cargando partidas:', error); return []; }
  // Actividades primero, cada una seguida de sus subactividades, en su orden.
  const acts = (data||[]).filter(p=>!p.padre_id);
  return acts.flatMap(a=>[a, ...(data||[]).filter(p=>p.padre_id===a.id)]);
}
// Crea (sin id) o actualiza un presupuesto. Devuelve la fila guardada o null.
export async function guardarPresupuesto(campos){
  const q = campos.id
    ? supabase.from('presupuestos').update(campos).eq('id', campos.id)
    : supabase.from('presupuestos').insert(campos);
  const { data, error } = await q.select().single();
  if(error){ console.error('Error guardando presupuesto:', error); alert(`⚠️ ${error.message}`); return null; }
  return data;
}
// Guarda todas las partidas: borra las que se quitaron y guarda el resto con su orden.
export async function guardarPartidas(presupuestoId, partidas, anteriores){
  const vigentes = new Set(partidas.map(p=>p.id));
  const quitadas = anteriores.filter(p=>!vigentes.has(p.id)).map(p=>p.id);
  if(quitadas.length){
    const { error } = await supabase.from('partidas').delete().in('id', quitadas);
    if(error){ console.error('Error quitando partidas:', error); return false; }
  }
  if(!partidas.length) return true;
  const num = v => v===''||v==null ? null : +v;
  const filas = partidas.map((p,i)=>({ id:p.id, presupuesto_id:presupuestoId, padre_id:p.padre_id||null, fase:p.fase, orden:i,
    ...(p.linaje ? { linaje:p.linaje } : {}),
    nombre:p.nombre.trim(), unidad:p.unidad||null, cantidad:num(p.cantidad), precio_unitario:num(p.precio_unitario),
    fecha_inicio:p.fecha_inicio||null, fecha_fin:p.fecha_fin||null, notas:p.notas||null }));
  // Primero actividades y después subactividades, por la referencia al padre.
  const { error } = await supabase.from('partidas').upsert([...filas.filter(f=>!f.padre_id), ...filas.filter(f=>f.padre_id)]);
  if(error){ console.error('Error guardando partidas:', error); return false; }
  return true;
}
export async function borrarPresupuesto(id){
  const { error } = await supabase.from('presupuestos').delete().eq('id', id);
  if(error){ console.error('Error borrando presupuesto:', error); alert(`⚠️ ${error.message}`); return false; }
  return true;
}
// Copia un presupuesto vigente como borrador de la versión siguiente.
export async function crearVersionPresupuesto(pres, partidas, usuario){
  const nuevo = await guardarPresupuesto({ project:pres.project, nombre:pres.nombre, version:pres.version+1, base_id:pres.id,
    fecha_inicio:pres.fecha_inicio, fecha_fin:pres.fecha_fin, creado_por:usuario.id, creado_nombre:usuario.nombre });
  if(!nuevo) return null;
  const ids = {}; partidas.forEach(p=>{ ids[p.id]=crypto.randomUUID(); });
  // Mismo linaje: lo ejecutado (cuentas de cobro, ejecución manual) sigue a la actividad en la versión nueva.
  const copia = partidas.map(p=>({ ...p, id:ids[p.id], padre_id:p.padre_id?ids[p.padre_id]:null, linaje:p.linaje }));
  if(!(await guardarPartidas(nuevo.id, copia, []))) return null;
  return nuevo;
}

// Actividades de los presupuestos vigentes del proyecto a las que se puede
// cargar una cuenta de cobro (subactividades y actividades sin subactividades).
export async function loadPartidasVigentes(project){
  const { data: pres, error } = await supabase.from('presupuestos').select('id,nombre').eq('project', project).eq('estado','vigente');
  if(error || !pres?.length) return [];
  const { data: parts } = await supabase.from('partidas').select('*').in('presupuesto_id', pres.map(p=>p.id)).order('orden');
  const { hojas, codigos } = await import('./controlPresupuesto.js');
  return pres.flatMap(pr=>{
    const ps = (parts||[]).filter(p=>p.presupuesto_id===pr.id);
    const cod = codigos(ps), padre = Object.fromEntries(ps.map(p=>[p.id,p]));
    return hojas(ps).map(p=>({ linaje:p.linaje, presupuesto:pr.nombre,
      label:`${cod[p.id]} ${p.padre_id ? `${padre[p.padre_id]?.nombre} › ` : ''}${p.nombre}` }));
  });
}
export async function loadEjecucionManual(project){
  const { data, error } = await supabase.from('ejecucion_manual').select('*').eq('project', project).order('mes');
  if(error){ console.error('Error cargando ejecución manual:', error); return []; }
  return data || [];
}
export async function guardarEjecucionManual(fila){
  const { error } = await supabase.from('ejecucion_manual').insert(fila);
  if(error){ console.error('Error guardando ejecución manual:', error); alert(`⚠️ ${error.message}`); return false; }
  return true;
}
export async function borrarEjecucionManual(id){
  const { error } = await supabase.from('ejecucion_manual').delete().eq('id', id);
  if(error){ console.error('Error borrando ejecución manual:', error); return false; }
  return true;
}
// Carga una cuenta de cobro ya aprobada a una actividad del presupuesto.
export async function asignarPartidaCuenta(cuentaId, linaje, por){
  const { data: actual } = await supabase.from('cuentas_cobro').select('historial').eq('id', cuentaId).single();
  const historial = [...(actual?.historial||[]), {accion:'Cargada a actividad del presupuesto', por, fecha:new Date().toISOString()}];
  const { data, error } = await supabase.from('cuentas_cobro').update({ partida_linaje: linaje, historial }).eq('id', cuentaId).select('id');
  if(error || !data?.length){ console.error('Error asignando partida:', error); return false; }
  return true;
}

export async function loadProveedores(){
  const { data, error } = await supabase.from('proveedores').select('nombre,nit').eq('estado','activo').order('nombre');
  if(error){ console.error('Error cargando proveedores:', error); return []; }
  return data || [];
}
