// Envío de una cuenta de cobro a Cuentas por Pagar de SYD Gestión.
// Crea (o actualiza, si sigue pendiente allá) la obligación.
export const RESPONSABLES_CONTABLES: Record<string, { auxiliar: string; correo: string }> = {
  "Aqqua 4": { auxiliar: "Ismael Miranda Almeida", correo: "analistacontable2@sydinversiones.com" },
  "Citrino": { auxiliar: "Ismael Miranda Almeida", correo: "auxcontable5@sydinversiones.com" },
  "Aqqua Club": { auxiliar: "Luis Carlos Alcalá Torres", correo: "auxcontable2@sydinversiones.com" },
  "Itai Equipos": { auxiliar: "Maria Alejandra Lara", correo: "auxcontable2@sydinversiones.com" },
  "Vivante Parque Residencial": { auxiliar: "Maria Jose Meza", correo: "analistacontable1@sydinversiones.com" },
  "Atalí Conjunto Campestre": { auxiliar: "Maria Jose Meza", correo: "analistacontable1@sydinversiones.com" },
  "Vivante Norte": { auxiliar: "Maria Jose Meza", correo: "analistacontable1@sydinversiones.com" },
  "SYD Inversiones": { auxiliar: "Maria Jose Meza", correo: "analistacontable1@sydinversiones.com" },
};

// deno-lint-ignore no-explicit-any
export async function enviarACuentasPorPagar(supabase: any, cuenta: any): Promise<{ ok: boolean; error?: string }> {
  const responsable = RESPONSABLES_CONTABLES[cuenta.project] || null;
  try {
    const resp = await fetch(Deno.env.get("APROBACION_CXP_WEBHOOK_URL")!, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": Deno.env.get("APROBACION_CXP_WEBHOOK_SECRET")! },
      body: JSON.stringify({
        referenciaExterna: String(cuenta.id),
        centroCosto: cuenta.centro_costo || cuenta.project,
        empresa: cuenta.empresa || null,
        categoria: cuenta.categoria || null,
        subcategoria: cuenta.subcategoria || null,
        concepto: cuenta.concepto,
        valor: cuenta.valor_final_pagar ?? cuenta.valor,
        proveedorTercero: cuenta.proveedor,
        auxiliarContable: responsable?.auxiliar || null,
        correoRevisor: responsable?.correo || null,
        soportes: Array.isArray(cuenta.soportes) ? cuenta.soportes : [],
      }),
    });
    if (!resp.ok) {
      const error = `HTTP ${resp.status}: ${(await resp.text()).slice(0, 500)}`;
      await supabase.from("cuentas_cobro").update({ aprobacion_cxp_estado: "error", aprobacion_cxp_error: error }).eq("id", cuenta.id);
      return { ok: false, error };
    }
    await supabase.from("cuentas_cobro").update({ aprobacion_cxp_estado: "enviado", aprobacion_cxp_error: null }).eq("id", cuenta.id);
    return { ok: true };
  } catch (e) {
    await supabase.from("cuentas_cobro").update({ aprobacion_cxp_estado: "error", aprobacion_cxp_error: String(e).slice(0, 500) }).eq("id", cuenta.id);
    return { ok: false, error: String(e) };
  }
}

// Cadena de firmas de Gerencia en Técnica para un proyecto (o la de '*').
// deno-lint-ignore no-explicit-any
export async function cadenaAprobadores(supabase: any, project: string): Promise<string[]> {
  const { data } = await supabase.from("aprobadores_gerencia").select("project, orden, profile_id").in("project", [project, "*"]).order("orden");
  const propia = (data || []).filter((r: { project: string }) => r.project === project);
  return (propia.length ? propia : (data || []).filter((r: { project: string }) => r.project === "*")).map((r: { profile_id: string }) => r.profile_id);
}
