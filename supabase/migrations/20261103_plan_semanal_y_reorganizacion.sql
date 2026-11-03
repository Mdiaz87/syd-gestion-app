-- Plan semanal de los ingenieros y reorganización de proyectos (2026-11-03).

-- 1) Plan semanal: lo que el ingeniero propone hacer en la semana. Se coteja
--    con lo que los coordinadores registran a diario en su informe semanal.
create table if not exists planes_semanales (
  id uuid primary key default gen_random_uuid(),
  project text not null,
  semana date not null,                 -- lunes de la semana
  autor_id uuid references profiles(id) on delete set null,
  autor text,
  -- [{id, actividad, etapa, meta, unidad, equipo, observaciones, motivo}]
  actividades jsonb not null default '[]'::jsonb,
  estado text not null default 'borrador' check (estado in ('borrador','enviado')),
  enviado_at timestamptz,
  -- Revisión de Gerencia: {veredicto: 'adecuado'|'ajustar', comentario, por, fecha}
  revision jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project, semana)
);
alter table planes_semanales enable row level security;
drop policy if exists planes_semanales_select on planes_semanales;
create policy planes_semanales_select on planes_semanales for select to authenticated
  using (mis_proyectos() is null or project = any (mis_proyectos()));
drop policy if exists planes_semanales_insert on planes_semanales;
create policy planes_semanales_insert on planes_semanales for insert to authenticated
  with check (mi_rol() = any (array['Ingeniero','Directivo']) and (mis_proyectos() is null or project = any (mis_proyectos())));
drop policy if exists planes_semanales_update on planes_semanales;
create policy planes_semanales_update on planes_semanales for update to authenticated
  using (mi_rol() = any (array['Ingeniero','Directivo']) and (mis_proyectos() is null or project = any (mis_proyectos())))
  with check (mi_rol() = any (array['Ingeniero','Directivo']) and (mis_proyectos() is null or project = any (mis_proyectos())));
drop policy if exists planes_semanales_delete on planes_semanales;
create policy planes_semanales_delete on planes_semanales for delete to authenticated
  using (mi_rol() = 'Directivo');

-- 2) Qué proyectos deben plan semanal, y nota para los que ya no tienen compromiso.
alter table obligaciones_informes
  add column if not exists plan_semanal boolean not null default false,
  add column if not exists nota text;

-- 3) Ingeniero coordinador: un solo usuario que llena el informe de Ingeniero
--    y el semanal de Coordinador. proyectos_a_cargo limita los formularios
--    (no la visibilidad: siguen viendo sus cuentas de cobro viejas).
alter table profiles
  add column if not exists ingeniero_coordinador boolean not null default false,
  add column if not exists proyectos_a_cargo text[];

-- 4) Reorganización. SYD Universal (Citrino y Aqqua 4) se vendió: solo quedan
--    las comisiones, sin informes ni alertas.
update obligaciones_informes
  set coord_semanal = false, ing_mensual = false, plan_semanal = false, coord_responsable = null, ing_responsable = null,
      nota = 'Vendido (SYD Universal): solo comisiones, sin informes ni alertas'
  where project in ('Citrino', 'Aqqua 4');

update obligaciones_informes set plan_semanal = true
  where project in ('Aqqua Club','Icon Park','Vivante Parque Residencial','Atalí Conjunto Campestre','Brisas del Lago 1','Brisas del Lago 2','Brisas de Baranoa');

-- Rafael Espinosa: ingeniero coordinador de Aqqua Club (Aqqua 1, 2 y 3).
update profiles set rol = 'Ingeniero', ingeniero_coordinador = true, proyectos_a_cargo = array['Aqqua Club']
  where id = '134a3c94-5b96-4231-83d1-9b0c7b94ab91';
-- Iván Pérez: ingeniero coordinador de Icon Park.
update profiles set ingeniero_coordinador = true, proyectos_a_cargo = array['Icon Park']
  where id = 'cd54a3e2-0ce3-4562-8f0a-857698dc9db2';
-- Ingenieros restantes, según el equipo de cada proyecto.
update profiles set proyectos_a_cargo = array['Vivante Parque Residencial','Atalí Conjunto Campestre']
  where id = '85524f2b-b676-412a-a5b1-777f3bed9d49'; -- Felipe Zuluaga
update profiles set proyectos_a_cargo = array['Brisas del Lago 1','Brisas del Lago 2']
  where id = 'c7ef8411-0324-45e4-a688-1c9c6eadc565'; -- Jorge Torres
update profiles set proyectos_a_cargo = array['Brisas de Baranoa']
  where id = '461b5c79-efc8-473d-9f16-ded6ad6d7329'; -- Germán Mercado

update obligaciones_informes set coord_responsable = '134a3c94-5b96-4231-83d1-9b0c7b94ab91', ing_responsable = '134a3c94-5b96-4231-83d1-9b0c7b94ab91' where project = 'Aqqua Club';
update obligaciones_informes set coord_responsable = 'cd54a3e2-0ce3-4562-8f0a-857698dc9db2', ing_responsable = 'cd54a3e2-0ce3-4562-8f0a-857698dc9db2' where project = 'Icon Park';
update obligaciones_informes set ing_responsable = '85524f2b-b676-412a-a5b1-777f3bed9d49' where project in ('Vivante Parque Residencial','Atalí Conjunto Campestre');
update obligaciones_informes set ing_responsable = 'c7ef8411-0324-45e4-a688-1c9c6eadc565' where project in ('Brisas del Lago 1','Brisas del Lago 2');
update obligaciones_informes set ing_responsable = '461b5c79-efc8-473d-9f16-ded6ad6d7329' where project = 'Brisas de Baranoa';

-- Primer lunes cuyo informe semanal se exige (proyectos o responsables nuevos).
alter table obligaciones_informes add column if not exists coord_semanal_desde date;
update obligaciones_informes set coord_semanal_desde = '2026-11-02' where project = 'Icon Park';
