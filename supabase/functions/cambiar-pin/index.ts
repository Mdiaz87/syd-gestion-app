import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { passwordV2, pinValido, corsHeaders, json } from "../_shared/pin.ts";

// "Cambiar mi código": cada persona cambia su propio PIN (formato v2).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const comoUsuario = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await comoUsuario.auth.getUser();
    if (!user) return json({ ok: false, error: "Sesión inválida" }, 401);

    const { pin } = await req.json();
    if (!pinValido(pin)) return json({ ok: false, error: "El código debe tener 4 dígitos" }, 400);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: perfil } = await db.from("profiles").select("id, legacy_id").eq("id", user.id).single();
    if (!perfil) return json({ ok: false, error: "Perfil no encontrado" }, 404);
    const { error } = await db.auth.admin.updateUserById(user.id, { password: await passwordV2(perfil.legacy_id || perfil.id, pin) });
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
