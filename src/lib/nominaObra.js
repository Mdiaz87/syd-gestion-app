import { supabase } from "../supabase.js";

// Novedades de nómina del personal de obra (Miguel, 2026-11-19). La nómina
// vive en SYD Gestión: todo pasa por la Edge Function "cajas-menores" (la
// misma de Mi caja), que verifica al ingeniero y sus proyectos antes de
// reenviar a Gestión. El ingeniero solo ve nombres y cargos, no salarios.
async function llamar(accion, datos = {}) {
  const { data, error } = await supabase.functions.invoke("cajas-menores", { body: { accion, datos } });
  if (error) throw new Error("No hay conexión con el servidor. Revisa la señal e intenta de nuevo.");
  if (!data?.ok) throw new Error(data?.error || "No se pudo completar la acción.");
  return data.data;
}

export const cargarNovedadesObra = (fechaInicio) => llamar("nomina_novedades", { fechaInicio: fechaInicio || null });
export const guardarNovedadesObra = (fechaInicio, filas, enviar) => llamar("nomina_guardar_novedades", { fechaInicio, filas, enviar });

// Mismas claves que SYD Gestión (src/lib/nomina.js HORAS).
export const TIPOS_HORA = [
  ["extra_diurna", "Extra diurna"],
  ["extra_nocturna", "Extra nocturna"],
  ["extra_diurna_dominical", "Extra diurna dominical/festiva"],
  ["extra_nocturna_dominical", "Extra nocturna dominical/festiva"],
  ["recargo_nocturno", "Recargo nocturno"],
  ["recargo_dominical", "Recargo dominical/festivo"],
  ["recargo_nocturno_dominical", "Recargo nocturno dominical"],
];
