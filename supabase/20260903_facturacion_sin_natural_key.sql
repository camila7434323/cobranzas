-- La clave natural (empresa + factura + artículo + CC + OC + período) colapsaba
-- líneas legítimas distintas de una misma factura: cuando varias líneas comparten
-- esas 6 columnas pero cambian el colaborador, la cantidad o el importe (ej. una
-- factura de "Contractor" con 8 colaboradores), el upsert las guardaba como una
-- sola fila. Resultado: un Excel de 6901 líneas terminaba como 1988 en la base.
--
-- El módulo Facturación ahora reemplaza por número de factura al reimportar
-- (borra las líneas de las facturas presentes en el Excel y reinserta el
-- desglose completo), así que la restricción ya no hace falta y cada línea del
-- Excel se guarda tal cual.
alter table public.facturacion_lineas
  drop constraint if exists facturacion_lineas_natural_key;
