-- Auditoría 25-nov-2026, tanda 3 (SYD Técnica). Orden de Miguel: "sigue con la tanda tres".

-- 1) Candado en cuentas_cobro. Los permisos (RLS) dejaban que un Ingeniero,
--    autor de su cuenta, la pasara de "pendiente_contable" a "aprobado_total"
--    (saltándose Contabilidad y Gerencia) o cambiara el valor/proveedor de una
--    cuenta ya aprobada. Este disparador revisa cada cambio hecho desde la app:
--    - Directivo: puede todo (como antes).
--    - Autor con su cuenta pendiente o devuelta: puede corregir los datos y
--      reenviarla (devuelto -> pendiente_contable), pero no aprobarla.
--    - Ingeniero con una cuenta aprobada: solo puede asignarle la actividad del
--      presupuesto (y las marcas de envío que dejan las funciones).
--    Los procesos del servidor (llave de servicio, sin usuario) no pasan por aquí.
create or replace function cuentas_cobro_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
  v_cambios text[];
  v_permitidos text[];
  v_seguimiento text[] := array['historial', 'revision_contable_estado', 'revision_contable_error',
    'legalizacion_estado', 'legalizacion_error', 'aprobacion_cxp_estado', 'aprobacion_cxp_error'];
begin
  if auth.uid() is null then return new; end if;
  v_rol := mi_rol();
  if v_rol = 'Directivo' then return new; end if;

  select coalesce(array_agg(k), '{}') into v_cambios
  from jsonb_object_keys(to_jsonb(new)) k
  where to_jsonb(new) -> k is distinct from to_jsonb(old) -> k;

  if old.estado in ('pendiente_contable', 'devuelto') and old.autor_id = auth.uid() then
    if new.estado is distinct from old.estado and not (old.estado = 'devuelto' and new.estado = 'pendiente_contable') then
      raise exception 'Solo Contabilidad y Gerencia pueden cambiar el estado de la cuenta.';
    end if;
    v_permitidos := v_seguimiento || array['project', 'empresa', 'centro_costo', 'categoria', 'subcategoria', 'proveedor',
      'concepto', 'cantidad', 'unidad', 'valor', 'observaciones', 'soportes', 'partida_linaje', 'estado'];
  elsif old.estado = 'aprobado_total' and v_rol = 'Ingeniero' then
    v_permitidos := v_seguimiento || array['partida_linaje'];
  else
    raise exception 'No tienes permiso para modificar esta cuenta.';
  end if;

  if exists (select 1 from unnest(v_cambios) c where c <> all (v_permitidos)) then
    raise exception 'No tienes permiso para cambiar: %',
      (select string_agg(c, ', ') from unnest(v_cambios) c where c <> all (v_permitidos));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cuentas_cobro_guardia on cuentas_cobro;
create trigger trg_cuentas_cobro_guardia before update on cuentas_cobro
  for each row execute function cuentas_cobro_guardia();

-- 2) Aviso "resuelta": SYD Gestión avisa cuando una legalización se cierra, para
--    que el ingeniero deje de estar bloqueado por ella.
alter table legalizaciones_alertas_externas drop constraint if exists legalizaciones_alertas_externas_evento_check;
alter table legalizaciones_alertas_externas add constraint legalizaciones_alertas_externas_evento_check
  check (evento in ('bloqueada', 'por_vencer', 'resuelta'));
