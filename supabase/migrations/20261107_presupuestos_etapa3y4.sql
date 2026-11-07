-- Presupuestos, etapas 3 y 4 (2026-11-07).

-- Etapa 3: avance físico registrado por el ingeniero (el último por
-- actividad es el vigente). Se guarda por linaje, como lo ejecutado.
create table if not exists avance_fisico (
  id uuid primary key default gen_random_uuid(),
  project text not null,
  linaje uuid not null,
  fecha date not null default current_date,
  pct numeric not null check (pct >= 0 and pct <= 100),
  nota text,
  creado_por uuid references profiles(id) on delete set null,
  creado_nombre text,
  created_at timestamptz not null default now()
);
create index if not exists avance_fisico_linaje_idx on avance_fisico (linaje, created_at);
alter table avance_fisico enable row level security;
drop policy if exists avance_fisico_rw on avance_fisico;
create policy avance_fisico_rw on avance_fisico for all to authenticated
  using (puede_ver_presupuesto(project)) with check (puede_ver_presupuesto(project));
drop trigger if exists avance_fisico_autor on avance_fisico;
create trigger avance_fisico_autor before insert or update on avance_fisico for each row execute function ejecucion_manual_autor();

-- Etapa 4: análisis de precios unitarios (APU) por actividad.
create table if not exists apu_insumos (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid not null references partidas(id) on delete cascade,
  tipo text not null check (tipo in ('mano_obra','material','equipo','transporte','subcontrato')),
  descripcion text not null,
  unidad text,
  cantidad numeric,          -- rendimiento o cantidad por unidad de la actividad
  precio numeric,
  orden int not null default 0
);
create index if not exists apu_insumos_partida_idx on apu_insumos (partida_id);
alter table apu_insumos enable row level security;
drop policy if exists apu_insumos_rw on apu_insumos;
create policy apu_insumos_rw on apu_insumos for all to authenticated
  using (exists (select 1 from partidas pa join presupuestos p on p.id = pa.presupuesto_id where pa.id = partida_id and puede_ver_presupuesto(p.project)))
  with check (exists (select 1 from partidas pa join presupuestos p on p.id = pa.presupuesto_id where pa.id = partida_id and puede_ver_presupuesto(p.project)));
create or replace function public.apu_reglas() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_estado text;
begin
  select p.estado into v_estado from partidas pa join presupuestos p on p.id = pa.presupuesto_id where pa.id = coalesce(new.partida_id, old.partida_id);
  if v_estado is distinct from 'borrador' then raise exception 'El presupuesto no está en borrador: no se puede cambiar el APU'; end if;
  return coalesce(new, old);
end $$;
drop trigger if exists apu_reglas on apu_insumos;
create trigger apu_reglas before insert or update or delete on apu_insumos for each row execute function apu_reglas();

-- Cotizaciones y soportes de cada actividad (archivos en Drive).
alter table partidas add column if not exists soportes jsonb not null default '[]'::jsonb;

-- Costos compartidos: un mismo gasto repartido entre actividades de varios
-- proyectos; cada parte es una fila de ejecución manual con el mismo grupo.
alter table ejecucion_manual add column if not exists grupo_id uuid, add column if not exists pct numeric;
