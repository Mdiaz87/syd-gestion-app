import { supabase, createScratchClient } from "../supabase.js";

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
  const { data, error } = await supabase.from('profiles').select('id,nombre,rol,activo,email,legacy_id').order('nombre');
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
  const { id, nombre, rol, activo } = profile;
  return { id, nombre, rol, activo };
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
