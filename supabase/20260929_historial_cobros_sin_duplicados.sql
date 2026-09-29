-- Limpia el historial de cobros: un mismo comprobante quedaba varias veces
-- (se marcaba cobrado, un XML lo volvía a pendiente y se lo marcaba de nuevo).
-- Deja una sola fila por comprobante: la del cobro más reciente.

-- Ver antes qué se va a borrar:
-- select comprobante_numero, cliente, count(*) from public.historial_cobros
-- where comprobante_id is not null group by 1, 2 having count(*) > 1 order by 3 desc;

delete from public.historial_cobros h
using (
  select id,
         row_number() over (partition by comprobante_id order by fecha_cobro desc, id) as n
  from public.historial_cobros
  where comprobante_id is not null
) d
where h.id = d.id
  and d.n > 1;
