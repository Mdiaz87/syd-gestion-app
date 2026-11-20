import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Recordatorio de novedades de nómina (Miguel, 20-nov-2026). Talento Humano
// recibe las novedades del personal de obra hasta el 5 (quincena del 16 al fin
// del mes anterior) y el 20 (quincena del 1 al 15). pg_cron llama esta
// función todos los días a las 7 a. m. (Colombia) con x-cron-secret
// (RECORDATORIOS_CRON_SECRET, el mismo de recordatorios-informes) y solo
// actúa estos días:
//   4 y 5   → recordatorio a los ingenieros de la quincena 16–fin del mes anterior
//   6       → ya venció: se les insiste y se le avisa a Talento Humano
//   19 y 20 → recordatorio de la quincena 1–15 del mes
//   21      → ya venció: se les insiste y se le avisa a Talento Humano
// Los proyectos de cada ingeniero son los mismos de la pestaña Novedades de
// nómina (proyecto_asignado o, si no tiene, donde es responsable de los
// informes). Gestión decide a quién le faltan trabajadores y escribe por
// Mensajes (si no lo leen, llega el aviso por correo/WhatsApp).
// Pruebas: ?dia=20 simula el día; ?dry=1 no escribe nada.
// Se despliega con --no-verify-jwt.

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

const iso = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  try {
    if (req.headers.get("x-cron-secret") !== Deno.env.get("RECORDATORIOS_CRON_SECRET")) {
      return responder({ ok: false, error: "No autorizado" }, 401);
    }
    const url = new URL(req.url);
    const prueba = url.searchParams.get("dry") === "1";
    const hoy = new Date(Date.now() - 5 * 3600_000); // Colombia
    const dia = Number(url.searchParams.get("dia") || hoy.getUTCDate());
    const anio = hoy.getUTCFullYear(), mes = hoy.getUTCMonth();

    let fechaInicio: string | null = null;
    let vencido = false;
    if ([4, 5, 6].includes(dia)) { fechaInicio = iso(new Date(Date.UTC(anio, mes - 1, 16))); vencido = dia === 6; }
    if ([19, 20, 21].includes(dia)) { fechaInicio = iso(new Date(Date.UTC(anio, mes, 1))); vencido = dia === 21; }
    if (!fechaInicio) return responder({ ok: true, nada: `Hoy (${dia}) no toca recordatorio.` });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: perfiles, error: e1 }, { data: obligs, error: e2 }] = await Promise.all([
      supabase.from("profiles").select("id, nombre, rol, activo, proyecto_asignado").eq("rol", "Ingeniero").eq("activo", true),
      supabase.from("obligaciones_informes").select("project, ing_responsable, coord_responsable"),
    ]);
    if (e1 || e2) throw e1 || e2;

    const ingenieros = (perfiles ?? []).map((p) => {
      let proyectos: string[] = Array.isArray(p.proyecto_asignado) ? p.proyecto_asignado : [];
      if (!Array.isArray(p.proyecto_asignado)) {
        proyectos = (obligs ?? [])
          .filter((o: { ing_responsable: string | null; coord_responsable: string | null }) => o.ing_responsable === p.id || o.coord_responsable === p.id)
          .map((o: { project: string }) => o.project);
      }
      return { id: p.id, nombre: p.nombre, proyectos };
    }).filter((i) => i.proyectos.length > 0);

    const resp = await fetch(Deno.env.get("CAJAS_MENORES_WEBHOOK_URL")!, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": Deno.env.get("CAJAS_MENORES_SECRET")! },
      body: JSON.stringify({ accion: "nomina_recordatorio", datos: { ingenieros, fechaInicio, vencido, prueba } }),
    });
    const data = await resp.json().catch(() => ({ ok: false, error: `Gestión respondió HTTP ${resp.status}` }));
    return responder({ dia, fechaInicio, vencido, prueba, ingenieros: ingenieros.length, ...data }, data.ok === false ? 500 : 200);
  } catch (e) {
    return responder({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
