-- CORRER (SYD Técnica): Carmen Cantillo deja de firmar las cuentas de Icon Park. 20-nov-2026.
-- Pedido de Miguel: Icon Park aprueba por correo y el ingeniero carga todo.
-- Sin filas propias, Icon Park usa la cadena general (*): Susana -> Miguel.
-- Las 3 cuentas que hoy esperan firma no tienen firma de Carmen, así que
-- siguen con Susana sin saltarse a nadie.
begin;
delete from aprobadores_gerencia where project = 'Icon Park';
select project, orden, profile_id from aprobadores_gerencia order by project, orden;
commit;
