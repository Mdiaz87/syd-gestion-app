// SYD Técnica: Mensajes internos (Miguel, 2026-11-10). Los mensajes viven en
// SYD Gestión; esta función verifica la sesión del usuario y lo reenvía al
// puente "mensajes-webhook" de Gestión con el secreto de servidor del puente de
// cajas menores (CAJAS_MENORES_SECRET / CAJAS_MENORES_WEBHOOK_URL), que nunca
// llega al navegador. Gestión aplica las reglas de quién ve qué.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const responder = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: corsHeaders });
const ACCIONES = ["no_leidos", "bandeja", "abrir", "enviar", "directorio", "guardar_mis_datos", "admin", "admin_guardar"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { accion, datos } = await req.json();
    if (!ACCIONES.includes(accion)) return responder({ ok: false, error: "Acción no válida." }, 400);

    const comoUsuario = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await comoUsuario.auth.getUser();
    if (!user) return responder({ ok: false, error: "No autenticado" }, 401);

    const servicio = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: perfil } = await servicio.from("profiles").select("id, nombre, rol, email, activo").eq("id", user.id).single();
    if (!perfil?.activo) return responder({ ok: false, error: "Usuario inactivo" }, 403);

    const cuerpo: Record<string, unknown> = { accion, datos: datos ?? {}, perfil };
    // El directorio completo va solo al abrirlo, no en cada mensaje.
    if (accion === "directorio" || accion === "admin") {
      const { data: lista } = await servicio.from("profiles").select("id, nombre, rol, email, activo");
      cuerpo.perfiles = lista ?? [];
    }
    const url = Deno.env.get("CAJAS_MENORES_WEBHOOK_URL")!.replace("cajas-menores-webhook", "mensajes-webhook");
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": Deno.env.get("CAJAS_MENORES_SECRET")! },
      body: JSON.stringify(cuerpo),
    });
    const data = await resp.json().catch(() => ({ ok: false, error: `Gestión respondió HTTP ${resp.status}` }));
    return responder(data, 200);
  } catch (e) {
    return responder({ ok: false, error: String(e) }, 200);
  }
});
