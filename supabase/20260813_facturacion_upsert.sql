-- Evita duplicados al volver a cargar un Excel de facturación: una misma línea
-- (empresa + factura + artículo + centro de costo + OC) no puede insertarse dos
-- veces. La carga del frontend usa upsert sobre esta restricción: si la línea
-- ya existe la actualiza, si no existe la inserta.
alter table public.facturacion_lineas
  add constraint facturacion_lineas_natural_key
  unique (empresa, n_factura, articulo_codigo, cc_descripcion, oc);
