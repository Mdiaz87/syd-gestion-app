import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { passwordV1, passwordV2, pinValido, corsHeaders, json } from "../_shared/pin.ts";

// Login por PIN hecho en el servidor. Desplegar con --no-verify-jwt (se usa
// antes de tener sesión).
// - Bloqueo real: 5 fallos por persona o 20 por IP en 15 min (antes lo
//   aplicaba la pantalla y se podía saltar llamando directo a Supabase).
// - La contraseña se verifica contra el hash (verificar_password) y la
//   sesión se entrega como token de un solo uso (magic link sin correo) que
//   el navegador canjea con verifyOtp.
// - Migración: si la contraseña está aún en el formato viejo (v1), se
//   cambia a v2 en ese mismo login.
const MAX_FALLOS_PERSONA = 5;
const MAX_FALLOS_IP = 20;
const VENTANA_MIN = 15;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { profileId, pin } = await req.json();
    if (typeof profileId !== "string" || !pinValido(pin)) return json({ ok: false, error: "Datos inválidos" }, 400);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    const desde = new Date(Date.now() - VENTANA_MIN * 60_000).toISOString();

    const [{ data: fallosPersona }, { data: fallosIp }] = await Promise.all([
      db.from("login_intentos").select("creado_at").eq("profile_id", profileId).gte("creado_at", desde).order("creado_at"),
      ip ? db.from("login_intentos").select("creado_at").eq("ip", ip).gte("creado_at", desde).order("creado_at") : Promise.resolve({ data: [] }),
    ]);
    const bloqueoDesde = (fallos: { creado_at: string }[] | null, max: number) =>
      (fallos?.length || 0) >= max ? Math.max(1, Math.ceil((new Date(fallos![0].creado_at).getTime() + VENTANA_MIN * 60_000 - Date.now()) / 1000)) : 0;
    const segundos = Math.max(bloqueoDesde(fallosPersona, MAX_FALLOS_PERSONA), bloqueoDesde(fallosIp, MAX_FALLOS_IP));
    if (segundos) return json({ ok: false, bloqueado: true, segundosRestantes: segundos });

    const { data: perfil } = await db.from("profiles").select("id, email, legacy_id, activo").eq("id", profileId).maybeSingle();
    const key = perfil ? (perfil.legacy_id || perfil.id) : "";
    let valido = false;
    if (perfil?.activo && perfil.email) {
      const v2 = await passwordV2(key, pin);
      const { data: okV2 } = await db.rpc("verificar_password", { p_user_id: perfil.id, p_password: v2 });
      valido = !!okV2;
      if (!valido) {
        const { data: okV1 } = await db.rpc("verificar_password", { p_user_id: perfil.id, p_password: passwordV1(key, pin) });
        if (okV1) {
          const { error } = await db.auth.admin.updateUserById(perfil.id, { password: v2 });
          if (error) console.error("No se pudo migrar la contraseña a v2:", error.message);
          valido = true;
        }
      }
    }

    if (!valido) {
      await db.from("login_intentos").insert({ profile_id: profileId, ip });
      const restantes = Math.max(0, MAX_FALLOS_PERSONA - (fallosPersona?.length || 0) - 1);
      return json({ ok: false, intentosRestantes: restantes });
    }

    await db.from("login_intentos").delete().eq("profile_id", profileId);
    const { data: link, error: linkError } = await db.auth.admin.generateLink({ type: "magiclink", email: perfil!.email });
    if (linkError || !link?.properties?.hashed_token) return json({ ok: false, error: "No se pudo crear la sesión" }, 500);
    return json({ ok: true, tokenHash: link.properties.hashed_token });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
