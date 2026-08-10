alter table public.facturacion_lineas
  alter column cantidad type numeric(18, 6),
  alter column precio_unitario type numeric(18, 6),
  alter column total_neto type numeric(18, 6);
