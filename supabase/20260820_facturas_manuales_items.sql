-- ── facturas_manuales: soporte para múltiples ítems por factura ───────────
--
-- Antes, cada factura manual (LLC/SL) tenía un solo renglón de ítem
-- (descripcion/unidad/cantidad/valor_unitario). Ahora el formulario permite
-- cargar varias líneas (por ejemplo, cada servicio de una factura con
-- desglose), así que se guardan como un array en la columna `items`.

alter table public.facturas_manuales add column if not exists items jsonb not null default '[]'::jsonb;

-- Migra las facturas ya cargadas: cada una pasa a tener un solo ítem con
-- los datos que ya tenía, para no perder información existente.
update public.facturas_manuales
set items = jsonb_build_array(jsonb_build_object(
  'descripcion', descripcion, 'unidad', unidad, 'cantidad', cantidad, 'valor_unitario', valor_unitario
))
where items = '[]'::jsonb and (descripcion <> '' or cantidad <> 0 or valor_unitario <> 0);

alter table public.facturas_manuales drop column if exists descripcion;
alter table public.facturas_manuales drop column if exists unidad;
alter table public.facturas_manuales drop column if exists cantidad;
alter table public.facturas_manuales drop column if exists valor_unitario;
