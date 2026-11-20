-- CORRER (SYD Técnica): programa el recordatorio de novedades de nómina. 20-nov-2026.
-- Todos los días 7 a. m. (Colombia); la función solo actúa los días 4, 5, 6, 19, 20 y 21.
-- Usa el mismo encabezado (con el secreto) que ya tiene recordatorios-informes,
-- así el secreto no queda escrito aquí.
select cron.unschedule(jobid) from cron.job where jobname = 'recordatorio-novedades';
select cron.schedule('recordatorio-novedades', '0 12 * * *',
  replace(command, 'functions/v1/recordatorios-informes', 'functions/v1/recordatorio-novedades'))
from cron.job where jobname = 'recordatorios-informes';

-- Hoy es 20 (vence la quincena del 1 al 15): se manda el recordatorio de una vez.
do $$ declare v text; begin
  select replace(command, 'functions/v1/recordatorios-informes', 'functions/v1/recordatorio-novedades') into v
  from cron.job where jobname = 'recordatorios-informes';
  execute v;
end $$;

select jobname, schedule, active from cron.job where jobname in ('recordatorios-informes', 'recordatorio-novedades');
