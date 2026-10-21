-- La política de UPDATE de cuentas_cobro tenía el texto 'aprobado_tot<salto de
-- línea>al' (quedó partido al pegarlo), así que la condición del Ingeniero
-- nunca se cumplía: no podían marcar Pendiente -> Pagado en cuentas aprobadas.
-- Se recrea igual, con el literal correcto.
drop policy if exists cuentas_cobro_update on cuentas_cobro;
create policy cuentas_cobro_update
  on cuentas_cobro
  for update
  to authenticated
  using (
    (
      mi_rol() = 'Directivo'
      or (autor_id = auth.uid() and estado = any (array['pendiente_contable', 'devuelto']))
      or (mi_rol() = 'Ingeniero' and estado = 'aprobado_total')
    )
    and (mis_proyectos() is null or project = any (mis_proyectos()))
  )
  with check (
    (
      mi_rol() = 'Directivo'
      or (autor_id = auth.uid() and estado = any (array['pendiente_contable', 'devuelto']))
      or (mi_rol() = 'Ingeniero' and estado = 'aprobado_total')
    )
    and (mis_proyectos() is null or project = any (mis_proyectos()))
  );
