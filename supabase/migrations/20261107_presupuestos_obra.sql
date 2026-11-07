-- Módulo de Presupuestos de obra, etapa 1 (2026-11-07): cada ingeniero arma
-- y edita en la app el presupuesto de sus proyectos (fase preoperativa y
-- operativa, actividades y subactividades, cantidad x precio unitario,
-- fechas). Miguel (super admin) lo aprueba; un presupuesto vigente ya no se
-- edita: se crea una versión nueva a partir de él.

create table if not exists presupuestos (
  id uuid primary key default gen_random_uuid(),
  project text not null,
  nombre text not null,
  version int not null default 1,
  -- borrador -> en_revision -> vigente; al aprobar una versión nueva la
  -- anterior queda 'reemplazado'.
  estado text not null default 'borrador' check (estado in ('borrador','en_revision','vigente','reemplazado')),
  fecha_inicio date,
  fecha_fin date,
  base_id uuid references presupuestos(id) on delete set null,
  creado_por uuid references profiles(id) on delete set null,
  creado_nombre text,
  aprobado_por uuid references profiles(id) on delete set null,
  aprobado_nombre text,
  aprobado_at timestamptz,
  notas text,              -- motivo de devolución, comentarios
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists partidas (
  id uuid primary key default gen_random_uuid(),
  presupuesto_id uuid not null references presupuestos(id) on delete cascade,
  padre_id uuid references partidas(id) on delete cascade,  -- null = actividad; si no, subactividad
  fase text not null check (fase in ('pre_operativa','operativa')),
  orden int not null default 0,
  nombre text not null,
  unidad text,
  cantidad numeric,
  precio_unitario numeric,
  fecha_inicio date,
  fecha_fin date,
  notas text
);
create index if not exists partidas_presupuesto_idx on partidas (presupuesto_id);

alter table presupuestos enable row level security;
alter table partidas enable row level security;

-- Solo Ingenieros y Directivos (los coordinadores no ven precios), dentro de
-- los proyectos que cada uno puede ver.
create or replace function public.puede_ver_presupuesto(p_project text) returns boolean
language sql stable security definer set search_path = public as $$
  select mi_rol() = any (array['Ingeniero','Directivo']) and (mis_proyectos() is null or p_project = any (mis_proyectos()));
$$;
create or replace function public.es_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select es_super_admin from profiles where id = auth.uid()), false);
$$;

drop policy if exists presupuestos_rw on presupuestos;
create policy presupuestos_rw on presupuestos for all to authenticated
  using (puede_ver_presupuesto(project)) with check (puede_ver_presupuesto(project));
drop policy if exists partidas_rw on partidas;
create policy partidas_rw on partidas for all to authenticated
  using (exists (select 1 from presupuestos p where p.id = presupuesto_id and puede_ver_presupuesto(p.project)))
  with check (exists (select 1 from presupuestos p where p.id = presupuesto_id and puede_ver_presupuesto(p.project)));

-- Reglas que no dependen de la pantalla:
-- - solo el super admin pasa un presupuesto a 'vigente' o 'reemplazado';
-- - un presupuesto en revisión o vigente no cambia de datos (solo de estado);
-- - sus partidas solo se tocan mientras está en borrador.
create or replace function public.presupuestos_reglas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado in ('vigente','reemplazado') and (tg_op = 'INSERT' or old.estado is distinct from new.estado) and not es_super_admin() then
    raise exception 'Solo Miguel Díaz puede aprobar un presupuesto';
  end if;
  if tg_op = 'UPDATE' and old.estado in ('vigente','reemplazado') and new.estado = old.estado
     and (new.nombre, new.fecha_inicio, new.fecha_fin, new.project) is distinct from (old.nombre, old.fecha_inicio, old.fecha_fin, old.project) then
    raise exception 'Un presupuesto aprobado no se edita: crea una versión nueva';
  end if;
  new.updated_at := now();
  return new;
end $$;
-- Al aprobar una versión nueva, la anterior queda como 'reemplazado'.
create or replace function public.presupuestos_reemplazar_base() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'vigente' and old.estado is distinct from 'vigente' and new.base_id is not null then
    update presupuestos set estado = 'reemplazado' where id = new.base_id and estado = 'vigente';
  end if;
  return new;
end $$;
drop trigger if exists presupuestos_reemplazar_base on presupuestos;
create trigger presupuestos_reemplazar_base after update on presupuestos for each row execute function presupuestos_reemplazar_base();
drop trigger if exists presupuestos_reglas on presupuestos;
create trigger presupuestos_reglas before insert or update on presupuestos for each row execute function presupuestos_reglas();

create or replace function public.partidas_reglas() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_estado text;
begin
  select estado into v_estado from presupuestos where id = coalesce(new.presupuesto_id, old.presupuesto_id);
  if v_estado is distinct from 'borrador' then
    raise exception 'El presupuesto no está en borrador: no se pueden cambiar sus actividades';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists partidas_reglas on partidas;
create trigger partidas_reglas before insert or update or delete on partidas for each row execute function partidas_reglas();

-- Borrar un presupuesto solo si está en borrador (y en cascada sus partidas).
create or replace function public.presupuestos_borrar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.estado <> 'borrador' then raise exception 'Solo se puede borrar un presupuesto en borrador'; end if;
  delete from partidas where presupuesto_id = old.id and padre_id is not null;  -- antes que el trigger de partidas pierda el padre
  return old;
end $$;
drop trigger if exists presupuestos_borrar on presupuestos;
create trigger presupuestos_borrar before delete on presupuestos for each row execute function presupuestos_borrar();
