-- Presupuestos, etapa 2 (2026-11-07): cuentas de cobro cargadas a una
-- actividad del presupuesto y ejecución mes a mes.

-- Identificador permanente de una actividad a través de las versiones del
-- presupuesto: la versión nueva copia las partidas con id nuevo pero el
-- mismo linaje, así lo ejecutado no se pierde al aprobar una versión.
alter table partidas add column if not exists linaje uuid not null default gen_random_uuid();
create index if not exists partidas_linaje_idx on partidas (linaje);

-- Actividad del presupuesto a la que se carga la cuenta de cobro.
-- Obligatoria en la app cuando el proyecto tiene presupuesto vigente.
alter table cuentas_cobro add column if not exists partida_linaje uuid;
create index if not exists cuentas_cobro_partida_linaje_idx on cuentas_cobro (partida_linaje);

-- Ejecutado que no pasa por cuentas de cobro (pagos directos, costos
-- compartidos, lo ejecutado antes de usar la app).
create table if not exists ejecucion_manual (
  id uuid primary key default gen_random_uuid(),
  project text not null,
  linaje uuid not null,
  mes date not null,            -- primer día del mes
  valor numeric not null,
  nota text,
  creado_por uuid references profiles(id) on delete set null,
  creado_nombre text,
  created_at timestamptz not null default now()
);
alter table ejecucion_manual enable row level security;
drop policy if exists ejecucion_manual_rw on ejecucion_manual;
create policy ejecucion_manual_rw on ejecucion_manual for all to authenticated
  using (puede_ver_presupuesto(project)) with check (puede_ver_presupuesto(project));
