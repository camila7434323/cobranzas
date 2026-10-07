-- Sigue la limpieza de 20260914c: se encontraron más variantes del mismo
-- problema (mayúsculas / tildes / nombre incompleto) al auditar todas las
-- tablas que guardan un nombre de ejecutivo como texto libre.
--
-- facturas_manuales (clientes del exterior, LLC/SL):
update public.facturas_manuales set ejecutivo = 'Agustin Fazio' where ejecutivo = 'AGUSTIN FAZIO';
update public.facturas_manuales set ejecutivo = 'Maria Cadarso' where ejecutivo = 'MARIA CADARSO';

-- pendientes_facturacion.resp: esta tabla no filtra por ejecutivo a nivel de
-- RLS (la vía cualquiera ve todo, ver 20260910b), así que esto no rompía
-- permisos, pero sí hacía que el mismo ejecutivo apareciera con dos nombres
-- distintos en el listado.
update public.pendientes_facturacion set resp = 'Agustin Fazio'   where resp = 'Agustín Fazio';
update public.pendientes_facturacion set resp = 'Joaquin Ramirez' where resp = 'Joaquín Ramirez';
update public.pendientes_facturacion set resp = 'Fernanda Dugini' where resp = 'Maria Fernanda Dugini';
