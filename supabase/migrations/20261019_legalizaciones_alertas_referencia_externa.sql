-- Avisos de legalización que manda SYD Recaudo y Cartera (cron-legalizaciones)
-- a esta app. La tabla se creó a mano desde el Dashboard; esto agrega la
-- columna que permite cruzarla con cuentas_cobro y deja que la app la lea.

-- 1) referencia_externa = cuentas_cobro.id (el mismo id que se manda en
--    legalizar-pago). Mismo nombre de columna que usa la otra app.
alter table legalizaciones_alertas_externas
  add column if not exists referencia_externa text;

update legalizaciones_alertas_externas
  set referencia_externa = cuenta_cobro_id
  where referencia_externa is null and cuenta_cobro_id is not null;

create index if not exists legalizaciones_alertas_externas_referencia_externa_idx
  on legalizaciones_alertas_externas (referencia_externa);

-- 2) Lectura para usuarios autenticados, limitada a las cuentas de cobro que
--    ese usuario ya puede ver (la subconsulta respeta el RLS de cuentas_cobro).
--    La escritura sigue siendo solo de la Edge Function (service_role).
drop policy if exists "Leer alertas de mis cuentas de cobro" on legalizaciones_alertas_externas;
create policy "Leer alertas de mis cuentas de cobro"
  on legalizaciones_alertas_externas
  for select
  to authenticated
  using (
    exists (
      select 1 from cuentas_cobro c
      where c.id::text = legalizaciones_alertas_externas.referencia_externa
    )
  );
