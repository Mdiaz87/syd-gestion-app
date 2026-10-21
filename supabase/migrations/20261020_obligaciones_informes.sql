-- Qué informes debe entregar cada proyecto. Solo los proyectos marcados
-- generan recordatorios (Dashboard y correo); antes se alertaba en todos los
-- proyectos, incluso donde nadie reporta (Itai Equipos, Grupo Itai, ...).
create table if not exists obligaciones_informes (
  project text primary key,
  coord_semanal boolean not null default false,
  ing_mensual boolean not null default false,
  -- Primer mes cuyo informe mensual de Ingeniero se exige ('YYYY-MM').
  -- Ej. Icon Park arranca con el de octubre 2026.
  ing_mensual_desde text,
  updated_at timestamptz not null default now()
);

alter table obligaciones_informes enable row level security;

drop policy if exists obligaciones_informes_select on obligaciones_informes;
create policy obligaciones_informes_select on obligaciones_informes
  for select to authenticated using (true);

drop policy if exists obligaciones_informes_write on obligaciones_informes;
create policy obligaciones_informes_write on obligaciones_informes
  for all to authenticated
  using (mi_rol() = 'Directivo' and mis_proyectos() is null)
  with check (mi_rol() = 'Directivo' and mis_proyectos() is null);

insert into obligaciones_informes (project, coord_semanal, ing_mensual, ing_mensual_desde) values
  ('Citrino',                    true,  true,  null),
  ('Vivante Parque Residencial', true,  true,  null),
  ('Aqqua Club',                 true,  true,  null),
  ('Aqqua 4',                    true,  true,  null),
  ('Atalí Conjunto Campestre',   true,  true,  null),
  ('Brisas del Lago 1',          true,  true,  null),
  ('Brisas del Lago 2',          true,  true,  null),
  ('Brisas de Baranoa',          true,  false, null),
  ('Icon Park',                  false, true,  '2026-10'),
  ('Itai Equipos',               false, false, null),
  ('Grupo Itai',                 false, false, null),
  ('SYD Inversiones',            false, false, null)
on conflict (project) do nothing;

-- Correo real de cada persona para recordatorios. Va aparte de profiles
-- porque profiles es legible sin sesión (la pantalla de login lista nombres).
create table if not exists contactos_notificacion (
  profile_id uuid primary key references profiles(id) on delete cascade,
  email text not null,
  updated_at timestamptz not null default now()
);

alter table contactos_notificacion enable row level security;

drop policy if exists contactos_notificacion_directivo on contactos_notificacion;
create policy contactos_notificacion_directivo on contactos_notificacion
  for all to authenticated
  using (mi_rol() = 'Directivo' and mis_proyectos() is null)
  with check (mi_rol() = 'Directivo' and mis_proyectos() is null);
