-- Las cuentas aprobadas por Contabilidad que se mandaron solas a SYD Gestión
-- antes del cambio vuelven a esperar las firmas de Gerencia en SYD Técnica.
update cuentas_cobro
set aprobacion_cxp_estado = null,
    aprobacion_cxp_error = null,
    aprobaciones_gerencia = '[]'::jsonb,
    historial = historial || jsonb_build_array(jsonb_build_object(
      'accion', 'Vuelve a firma de Gerencia en SYD Técnica (cambio de flujo)',
      'por', 'Sistema', 'fecha', now()))
where estado = 'aprobado_contable';
