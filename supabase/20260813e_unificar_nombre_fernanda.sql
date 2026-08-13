-- Unifica la doble grafía "Maria Fernanda Dugini" -> "Fernanda Dugini" en
-- todas las tablas donde aparece como ejecutivo, para que su cuenta
-- (perfiles.ejecutivo_nombre = 'Fernanda Dugini') vea la totalidad de sus
-- comprobantes.

update public.comprobantes
set ejecutivo = 'Fernanda Dugini'
where ejecutivo = 'Maria Fernanda Dugini';

update public.historial_cobros
set ejecutivo = 'Fernanda Dugini'
where ejecutivo = 'Maria Fernanda Dugini';

update public.facturas_manuales
set ejecutivo = 'Fernanda Dugini'
where ejecutivo = 'Maria Fernanda Dugini';
