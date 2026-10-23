import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cajas menores: el dinero vive en SYD Gestión (Recaudo y Cartera), al lado
// de Tesorería. Esta función es el único camino del ingeniero hacia allá:
// verifica su sesión, que sea Ingeniero activo y sus proyectos asignados, y
// reenvía la acción a cajas-menores-webhook de Gestión con un secreto de
// servidor que nunca llega al navegador. Gestión vuelve a validar que la caja
// sea de este ingeniero y de uno de sus proyectos.
//
// Un Directivo solo puede pedir "sincronizar": manda la lista de ingenieros
// para que Tesorería pueda escoger responsables al crear cajas.
//
// Secretos (Dashboard → Edge Functions → Secrets): CAJAS_MENORES_WEBHOOK_URL
// (URL de cajas-menores-webhook en Gestión) y CAJAS_MENORES_SECRET (mismo
// valor que en Gestión). Esta función SÍ verifica el JWT (no usar
// --no-verify-jwt): la llama el navegador con la sesión del usuario.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const responder = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: corsHeaders });

const ACCIONES_INGENIERO = ["mi_caja", "guardar_gasto", "enviar_gasto", "anular_gasto", "confirmar_recibido"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { accion, datos } = await req.json();

    const supabaseComoUsuario = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user } } = await supabaseComoUsuario.auth.getUser();
    if (!user) return responder({ ok: false, error: "No autenticado" }, 401);

    const supabaseServicio = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: perfil } = await supabaseServicio
      .from("profiles")
      .select("id, nombre, rol, activo, proyecto_asignado")
      .eq("id", user.id)
      .single();
    if (!perfil?.activo) return responder({ ok: false, error: "Usuario inactivo" }, 403);

    const esIngeniero = perfil.rol === "Ingeniero" && ACCIONES_INGENIERO.includes(accion);
    const esSincronizacion = accion === "sincronizar" && (perfil.rol === "Directivo" || perfil.rol === "Ingeniero");
    if (!esIngeniero && !esSincronizacion) return responder({ ok: false, error: "No autorizado" }, 403);

    const cuerpo: Record<string, unknown> = { accion, datos: datos ?? {} };
    if (esIngeniero) {
      cuerpo.ingeniero = {
        id: perfil.id,
        nombre: perfil.nombre,
        rol: perfil.rol,
        proyectos: Array.isArray(perfil.proyecto_asignado) ? perfil.proyecto_asignado : null,
      };
    }
    // La lista completa va al abrir "Mi caja" y al sincronizar (no en cada guardado).
    if (accion === "mi_caja" || accion === "sincronizar") {
      const { data: lista } = await supabaseServicio
        .from("profiles")
        .select("id, nombre, rol, activo, proyecto_asignado")
        .eq("rol", "Ingeniero");
      cuerpo.ingenieros = (lista ?? []).map((p) => ({
        id: p.id, nombre: p.nombre, rol: p.rol, activo: !!p.activo,
        proyectos: Array.isArray(p.proyecto_asignado) ? p.proyecto_asignado : null,
      }));
    }

    const resp = await fetch(Deno.env.get("CAJAS_MENORES_WEBHOOK_URL")!, {
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
