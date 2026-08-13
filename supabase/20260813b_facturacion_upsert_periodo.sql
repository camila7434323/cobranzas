-- La clave anterior (empresa + factura + artículo + CC + OC) no alcanzaba:
-- una misma factura puede tener varias líneas con esos mismos datos para
-- distintos períodos (cargos recurrentes mes a mes). Se agrega período a
-- la clave para que cada línea mensual se identifique por separado.
alter table public.facturacion_lineas
  drop constraint if exists facturacion_lineas_natural_key;

alter table public.facturacion_lineas
  add constraint facturacion_lineas_natural_key
  unique (empresa, n_factura, articulo_codigo, cc_descripcion, oc, periodo);
