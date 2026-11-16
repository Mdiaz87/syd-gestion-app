-- Las personas nuevas las crea el servidor (Edge Function crear-usuario, con
-- la llave de servicio). Ya nadie puede crearse su propio perfil: antes
-- cualquier cuenta del registro abierto podía insertarse como Directivo.
drop policy if exists profiles_insert_self on profiles;
