import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { passwordV2, genPin, corsHeaders, json } from "../_shared/pin.ts";

// "Resetear código" (slug smooth-api, nombre "reset-pin"): solo super admin.
// Genera un PIN nuevo para otra persona y lo devuelve una sola vez.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const comoUsuario = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await comoUsuario.auth.getUser();
    if (!user) return json({ error: "Sesión inválida" }, 401);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: quien } = await db.from("profiles").select("es_super_admin").eq("id", user.id).single();
    if (!quien?.es_super_admin) return json({ error: "No autorizado" }, 403);

    const { targetId } = await req.json();
    const { data: destino } = await db.from("profiles").select("id, legacy_id").eq("id", targetId).single();
    if (!destino) return json({ error: "Usuario no encontrado" }, 404);

    const pin = genPin();
    const { error } = await db.auth.admin.updateUserById(destino.id, { password: await passwordV2(destino.legacy_id || destino.id, pin) });
    if (error) return json({ error: error.message }, 400);
    await db.from("login_intentos").delete().eq("profile_id", destino.id);
    return json({ pin });
  } catch (e) {
    return json({ error: String(e) }, 400);
  }
});
