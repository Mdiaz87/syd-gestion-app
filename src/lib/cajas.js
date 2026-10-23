import { supabase } from "../supabase.js";
import { subirSoporteCuentaCobro } from "./pdf.js";

// Cajas menores. El dinero se registra en SYD Gestión; todo pasa por la Edge
// Function "cajas-menores", que verifica quién es el ingeniero y sus proyectos
// antes de reenviar a Gestión. Cada acción es segura de reintentar: el gasto
// lleva un id generado aquí, así que un reenvío no crea otro.
async function llamar(accion, datos = {}) {
  const { data, error } = await supabase.functions.invoke("cajas-menores", { body: { accion, datos } });
  if (error) throw new Error("No hay conexión con el servidor. Revisa la señal e intenta de nuevo.");
  if (!data?.ok) throw new Error(data?.error || "No se pudo completar la acción.");
  return data.data;
}

export const cargarMiCaja = () => llamar("mi_caja");
export const guardarGasto = (gasto) => llamar("guardar_gasto", { gasto });
export const enviarGasto = (gastoId) => llamar("enviar_gasto", { gastoId });
export const anularGasto = (gastoId, motivo) => llamar("anular_gasto", { gastoId, motivo });
export const confirmarRecibido = (movimientoId) => llamar("confirmar_recibido", { movimientoId });
// Directivo: manda la lista de ingenieros a Gestión para escoger responsables.
export const sincronizarIngenieros = () => llamar("sincronizar").catch(() => null);

const leerComoBase64 = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1]);
  r.onerror = rej;
  r.readAsDataURL(blob);
});

// Las fotos del celular pesan varios MB: se reducen a 1600 px de lado mayor
// en JPEG antes de subirlas, para que suban rápido con poca señal.
async function comprimirImagen(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.8));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function subirSoporteGasto(file, proyecto) {
  const esImagen = file.type.startsWith("image/");
  const blob = esImagen ? await comprimirImagen(file) : file;
  if (blob.size > 15 * 1024 * 1024) throw new Error("El archivo pesa más de 15 MB.");
  const base = file.name.replace(/\.[^.]+$/, "") || "soporte";
  const nombre = `CAJA_${Date.now()}_${base}${esImagen ? ".jpg" : file.name.match(/\.[^.]+$/)?.[0] || ""}`;
  const url = await subirSoporteCuentaCobro({ project: proyecto, fileName: nombre, base64: await leerComoBase64(blob) });
  if (!url) throw new Error("No se pudo subir el soporte. Intenta de nuevo.");
  return { nombre: file.name, url };
}
