-- Cada persona puede ver y poner su propio correo para recordatorios
-- (botón "Mi correo"); los Directivos siguen pudiendo editar el de todos.
drop policy if exists contactos_notificacion_propio on contactos_notificacion;
create policy contactos_notificacion_propio on contactos_notificacion
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
