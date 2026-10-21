-- La factura de legalización puede venir en varios archivos (factura + anexos).
-- factura_legalizacion_urls guarda la lista [{nombre, url}]; se mantiene
-- factura_legalizacion_url con el primero para no romper lo que ya lo usa
-- (bloqueo por legalización vencida, cron-legalizaciones de la otra app).
alter table cuentas_cobro
  add column if not exists factura_legalizacion_urls jsonb not null default '[]'::jsonb;

update cuentas_cobro
  set factura_legalizacion_urls = jsonb_build_array(jsonb_build_object('nombre', 'Factura', 'url', factura_legalizacion_url))
  where factura_legalizacion_url is not null and factura_legalizacion_urls = '[]'::jsonb;
