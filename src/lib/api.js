import { supabase } from "../supabase.js";

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

// ── USUARIOS (vía RPC — nunca exponen el pin salvo al crear/regenerar) ────────
export async function loadUsuarios(){
  const { data, error } = await supabase.rpc('listar_usuarios');
  if(error){ console.error('Error cargando usuarios:', error); return []; }
  return data || [];
}
export async function verificarPin(id, pin){
  const { data, error } = await supabase.rpc('verificar_pin', { p_id:id, p_pin:pin });
  if(error){ console.error('Error verificando código:', error); return null; }
  return data?.[0] || null;
}
export async function crearUsuario(nombre, rol){
  const { data, error } = await supabase.rpc('crear_usuario', { p_nombre:nombre, p_rol:rol });
  if(error){ console.error('Error creando usuario:', error); return null; }
  return data?.[0] || null;
}
export async function editarUsuario(id, nombre, rol){
  const { error } = await supabase.rpc('editar_usuario', { p_id:id, p_nombre:nombre, p_rol:rol });
  if(error){ console.error('Error editando usuario:', error); return false; }
  return true;
}
export async function setUsuarioActivo(id, activo){
  const { error } = await supabase.rpc('set_usuario_activo', { p_id:id, p_activo:activo });
  if(error){ console.error('Error activando/desactivando usuario:', error); return false; }
  return true;
}
export async function regenerarPin(id){
  const { data, error } = await supabase.rpc('regenerar_pin', { p_id:id });
  if(error){ console.error('Error regenerando código:', error); return null; }
  return data || null;
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
