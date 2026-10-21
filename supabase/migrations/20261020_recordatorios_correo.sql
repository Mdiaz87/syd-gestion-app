-- Responsable de cada informe por proyecto (a quién le llega el correo).
-- Si queda vacío, se usa quien hizo el último informe de ese rol ahí.
alter table obligaciones_informes
  add column if not exists coord_responsable uuid references profiles(id) on delete set null,
  add column if not exists ing_responsable uuid references profiles(id) on delete set null;

-- Para programar la Edge Function recordatorios-informes (cada 2 días).
create extension if not exists pg_cron;
create extension if not exists pg_net;
