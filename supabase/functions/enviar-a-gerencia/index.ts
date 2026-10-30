import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enviarACuentasPorPagar, cadenaAprobadores } from "../_shared/cxp.ts";

// Reenvía a Cuentas por Pagar de SYD Gestión una cuenta que ya tiene todas
// las firmas de Gerencia en SYD Técnica, cuando el envío automático de
// aprobar-gerencia-tecnica falló. La llama el navegador con la sesión de un
// Directivo.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const responder = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { cuentaId } = await req.json();
    if (!cuentaId) return responder({ ok: false, error: "Falta cuentaId" }, 400);

    const comoUsuario = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await comoUsuario.auth.getUser();
    if (!user) return responder({ ok: false, error: "No autenticado" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: perfil } = await supabase.from("profiles").select("rol, activo, nombre").eq("id", user.id).single();
    if (!perfil?.activo || perfil.rol !== "Directivo") return responder({ ok: false, error: "Solo un Directivo puede reenviar" }, 403);

    const { data: cuenta } = await supabase.from("cuentas_cobro").select("*").eq("id", cuentaId).single();
    if (!cuenta) return responder({ ok: false, error: "Cuenta no encontrada" }, 404);
    if (cuenta.estado !== "aprobado_contable") return responder({ ok: false, error: "La cuenta no está aprobada por Contabilidad" }, 400);

    const cadena = await cadenaAprobadores(supabase, cuenta.project);
    if ((cuenta.aprobaciones_gerencia || []).length < cadena.length) {
      return responder({ ok: false, error: "Faltan firmas de Gerencia en SYD Técnica" }, 400);
    }
    const envio = await enviarACuentasPorPagar(supabase, cuenta);
    if (!envio.ok) return responder({ ok: false, error: envio.error });
    const historial = [...(cuenta.historial || []), { accion: "Reenviado a Cuentas por Pagar de SYD Gestión", por: perfil.nombre, fecha: new Date().toISOString() }];
    await supabase.from("cuentas_cobro").update({ historial }).eq("id", cuentaId);
    return responder({ ok: true });
  } catch (e) {
    return responder({ ok: false, error: String(e) });
  }
});
