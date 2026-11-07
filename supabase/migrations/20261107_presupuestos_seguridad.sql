-- Endurecimiento del módulo de presupuestos (revisión de seguridad 2026-11-07):
-- 1) Un presupuesto aprobado no puede volver a borrador ni cambiar ningún dato;
--    solo pasa a 'reemplazado' cuando Miguel aprueba la versión siguiente.
-- 2) Quién creó y quién aprobó lo pone la base de datos con la sesión real,
--    no la pantalla (no se puede falsificar).
create or replace function public.presupuestos_reglas() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_nombre text;
begin
  select nombre into v_nombre from profiles where id = auth.uid();
  if tg_op = 'INSERT' then
    if new.estado <> 'borrador' and not es_super_admin() then
      raise exception 'Un presupuesto nuevo empieza en borrador';
    end if;
    new.creado_por := auth.uid(); new.creado_nombre := v_nombre;
    new.aprobado_por := null; new.aprobado_nombre := null; new.aprobado_at := null;
    if new.estado = 'vigente' then
      new.aprobado_por := auth.uid(); new.aprobado_nombre := v_nombre; new.aprobado_at := now();
    end if;
    new.updated_at := now();
    return new;
  end if;

  -- Aprobado o reemplazado: congelado. Lo único permitido es vigente -> reemplazado por el super admin.
  if old.estado in ('vigente','reemplazado') then
    if not (old.estado = 'vigente' and new.estado = 'reemplazado' and es_super_admin()) then
      raise exception 'Un presupuesto aprobado no se edita: crea una versión nueva';
    end if;
    if (new.project, new.nombre, new.version, new.fecha_inicio, new.fecha_fin, new.base_id, new.notas)
       is distinct from (old.project, old.nombre, old.version, old.fecha_inicio, old.fecha_fin, old.base_id, old.notas) then
      raise exception 'Un presupuesto aprobado no se edita: crea una versión nueva';
    end if;
  end if;

  if new.estado in ('vigente','reemplazado') and old.estado is distinct from new.estado and not es_super_admin() then
    raise exception 'Solo Miguel Díaz puede aprobar un presupuesto';
  end if;

  -- Datos de auditoría: inmutables salvo al aprobar, y siempre de la sesión real.
  new.creado_por := old.creado_por; new.creado_nombre := old.creado_nombre;
  if new.estado = 'vigente' and old.estado <> 'vigente' then
    new.aprobado_por := auth.uid(); new.aprobado_nombre := v_nombre; new.aprobado_at := now();
  else
    new.aprobado_por := old.aprobado_por; new.aprobado_nombre := old.aprobado_nombre; new.aprobado_at := old.aprobado_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.ejecucion_manual_autor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.creado_por := auth.uid();
  new.creado_nombre := (select nombre from profiles where id = auth.uid());
  return new;
end $$;
drop trigger if exists ejecucion_manual_autor on ejecucion_manual;
create trigger ejecucion_manual_autor before insert or update on ejecucion_manual for each row execute function ejecucion_manual_autor();
