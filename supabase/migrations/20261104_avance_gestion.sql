-- Recorrido del pago en la columna Estado (pedido de Miguel, 2026-11-04).
-- SYD Gestión avisa cada aprobación de Contabilidad y de Cuentas por pagar
-- (aprobacion-gerencia-callback, decision 'avance'). Solo sirve para mostrar
-- quién aprobó y quién falta; el estado de la cuenta no depende de esta columna.
alter table cuentas_cobro add column if not exists avance_gestion jsonb;
