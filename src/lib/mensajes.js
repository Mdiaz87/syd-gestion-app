import { supabase } from "../supabase.js";

// Mensajes internos (2026-11-10): viven en SYD Gestión; todo pasa por la Edge
// Function "mensajes", que verifica la sesión y reenvía al puente de Gestión.
async function llamar(accion, datos = {}) {
  const { data, error } = await supabase.functions.invoke("mensajes", { body: { accion, datos } });
  if (error) throw new Error("No hay conexión con el servidor. Revisa la señal e intenta de nuevo.");
  if (!data?.ok) throw new Error(data?.error || "No se pudo completar la acción.");
  return data.data;
}

export const apiMensajes = {
  noLeidos: () => llamar("no_leidos"),
  bandeja: (filtro) => llamar("bandeja", { filtro }),
  abrir: (id) => llamar("abrir", { conversacion_id: id }),
  enviar: (p) => llamar("enviar", p),
  directorio: () => llamar("directorio"),
  guardarMisDatos: (p) => llamar("guardar_mis_datos", p),
  admin: () => llamar("admin"),
  adminGuardar: (p) => llamar("admin_guardar", p),
};
