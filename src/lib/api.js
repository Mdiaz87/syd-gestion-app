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
export async function loadUsuarios(){
  const { data, error } = await supabase.from('profiles').select('id,nombre,rol,activo,email,legacy_id,es_super_admin').order('nombre');
  if(error){ console.error('Error cargando usuarios:', error); return []; }
  return data || [];
}
export async function login(profile, pin){
  const key = profile.legacy_id || profile.id;
  const { data, error } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: passwordFor(key, pin),
  });
  if(error){ console.error('Error verificando código:', error); return null; }
  const { id, nombre, rol, activo, es_super_admin } = profile;
  return { id, nombre, rol, activo, esSuperAdmin: !!es_super_admin };
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
export async function editarUsuario(id, nombre, rol){
  const { error } = await supabase.from('profiles').update({ nombre, rol }).eq('id', id);
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

export async function crearCuentaCobro({project, proveedor, concepto, cantidad, unidad, valor, observaciones, linkSoporte, autor, autorId}){
  const row = {
    id: Date.now(),
    project, proveedor, concepto,
    cantidad: cantidad===""?null:+cantidad,
    unidad: unidad||null,
    valor: +valor||0,
    observaciones: observaciones||null,
    link_soporte: linkSoporte||null,
    estado: 'pendiente',
    autor, autor_id: autorId,
  };
  const { error } = await supabase.from('cuentas_cobro').insert(row);
  if(error){ console.error('Error creando cuenta de cobro:', error); return false; }
  return true;
}

export { subirSoporteCuentaCobro };

export async function actualizarEstadoCuentaCobro(id, estado, {condicion, motivoRechazo}, revisadoPor){
  const { error } = await supabase.from('cuentas_cobro').update({
    estado, condicion: condicion||null, motivo_rechazo: motivoRechazo||null,
    revisado_por: revisadoPor, revisado_at: new Date().toISOString(),
  }).eq('id', id);
  if(error){ console.error('Error actualizando cuenta de cobro:', error); return false; }
  return true;
}

export async function notificarPagoAprobado(cuenta){
  const { data } = await supabase.from('destinatarios').select('emails').eq('project','_contabilidad').single();
  const destinatarios = data?.emails || [];
  if(!destinatarios.length) return false;
  return await enviarNotificacionPago({
    project: cuenta.project, proveedor: cuenta.proveedor, concepto: cuenta.concepto,
    cantidad: cuenta.cantidad, unidad: cuenta.unidad, valor: cuenta.valor,
    estado: cuenta.estado, condicion: cuenta.condicion, linkSoporte: cuenta.link_soporte,
    destinatarios,
  });
}
