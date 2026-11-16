import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { passwordV2, genPin, corsHeaders, json } from "../_shared/pin.ts";

// "Agregar persona" en Equipo. Antes se hacía con el registro público de
// Supabase desde el navegador; ahora solo un Directivo sin restricción de
// proyecto, con la API de administración (el registro público queda apagado).
const ROLES = ["Coordinador", "Ingeniero", "Directivo"];
const EMAIL_DOMAIN = "sydinversiones.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const comoUsuario = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await comoUsuario.auth.getUser();
    if (!user) return json({ ok: false, error: "Sesión inválida" }, 401);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: quien } = await db.from("profiles").select("rol, activo, proyecto_asignado").eq("id", user.id).single();
    if (!quien?.activo || quien.rol !== "Directivo" || quien.proyecto_asignado?.length) return json({ ok: false, error: "No autorizado" }, 403);

    const { nombre, rol } = await req.json();
    if (typeof nombre !== "string" || !nombre.trim() || !ROLES.includes(rol)) return json({ ok: false, error: "Datos inválidos" }, 400);

    const key = crypto.randomUUID();
    const email = `syd-user-${key}@${EMAIL_DOMAIN}`;
    const pin = genPin();
    const { data: creado, error } = await db.auth.admin.createUser({ email, password: await passwordV2(key, pin), email_confirm: true });
    if (error || !creado.user) return json({ ok: false, error: error?.message || "No se pudo crear" }, 500);

    const { error: errPerfil } = await db.from("profiles").insert({ id: creado.user.id, nombre: nombre.trim(), rol, activo: true, email, legacy_id: key });
    if (errPerfil) {
      await db.auth.admin.deleteUser(creado.user.id);
      return json({ ok: false, error: errPerfil.message }, 500);
    }
    return json({ ok: true, id: creado.user.id, nombre: nombre.trim(), rol, pin });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
