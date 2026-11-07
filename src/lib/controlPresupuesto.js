// La lógica vive en supabase/functions/_shared para que la use también la
// Edge Function de recordatorios (correo) sin duplicarla.
export * from "../../supabase/functions/_shared/control-presupuesto.js";
