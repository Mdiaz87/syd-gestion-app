-- Fase 1 del login por servidor (solo agrega; no cambia nada de lo actual).

-- Verifica una contraseña contra el hash de auth.users sin pasar por el
-- endpoint de login de Supabase (que limita por IP y la Edge Function
-- comparte IP para todos). Solo la usa la Edge Function iniciar-sesion.
create or replace function public.verificar_password(p_user_id uuid, p_password text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select u.encrypted_password = extensions.crypt(p_password, u.encrypted_password)
       from auth.users u where u.id = p_user_id),
    false);
$$;
revoke all on function public.verificar_password(uuid, text) from public, anon, authenticated;
grant execute on function public.verificar_password(uuid, text) to service_role;

-- Lo único que necesita la pantalla de login antes de tener sesión.
create or replace function public.usuarios_login()
returns table (id uuid, nombre text, rol text, activo boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nombre, p.rol, p.activo from public.profiles p where p.activo order by p.nombre;
$$;
revoke all on function public.usuarios_login() from public;
grant execute on function public.usuarios_login() to anon, authenticated;
