-- Aprobación de Gerencia en SYD Técnica, antes de mandar a SYD Gestión
-- (pedido de Miguel, 2026-10-30): después de Contabilidad firman, en orden,
-- los aprobadores del proyecto; con la última firma la cuenta va a Cuentas
-- por Pagar de Gestión (donde Susana y Miguel vuelven a aprobar).
create table if not exists aprobadores_gerencia (
  project text not null,          -- '*' = cadena por defecto
  orden int not null,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (project, orden)
);
alter table aprobadores_gerencia enable row level security;
drop policy if exists aprobadores_gerencia_select on aprobadores_gerencia;
create policy aprobadores_gerencia_select on aprobadores_gerencia for select to authenticated using (true);
drop policy if exists aprobadores_gerencia_write on aprobadores_gerencia;
create policy aprobadores_gerencia_write on aprobadores_gerencia for all to authenticated
  using (mi_rol() = 'Directivo' and mis_proyectos() is null)
  with check (mi_rol() = 'Directivo' and mis_proyectos() is null);

insert into aprobadores_gerencia (project, orden, profile_id) values
  ('*',         1, 'd6ff4bab-79b0-4527-b0c3-16b955dbf97e'), -- Susana Sierra
  ('*',         2, '8851c998-4d08-4835-b8a6-65a69dce88c2'), -- Miguel Díaz
  ('Icon Park', 1, '06ed7a61-529d-490c-9fc7-bb20ff86c813'), -- Carmen Cantillo
  ('Icon Park', 2, 'd6ff4bab-79b0-4527-b0c3-16b955dbf97e'), -- Susana Sierra
  ('Icon Park', 3, '8851c998-4d08-4835-b8a6-65a69dce88c2')  -- Miguel Díaz
on conflict (project, orden) do nothing;

-- Firmas ya dadas en Técnica: [{profile_id, nombre, fecha}] en orden.
alter table cuentas_cobro add column if not exists aprobaciones_gerencia jsonb not null default '[]'::jsonb;
