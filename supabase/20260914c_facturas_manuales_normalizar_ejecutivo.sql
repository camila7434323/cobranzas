-- Corrige el nombre de ejecutivo cargado en facturas_manuales (clientes del
-- exterior, LLC/SL) cuando no coincide exactamente con perfiles.ejecutivo_nombre.
-- Las políticas de RLS comparan por igualdad de texto, así que un nombre
-- cargado en mayúsculas (o incompleto) hacía que esa cuenta no viera sus
-- propios clientes al iniciar sesión: Julieta Salvucci y Joaquin Ramirez
-- estaban en mayúsculas, y Fernanda Dugini figuraba como
-- "MARIA FERNANDA DUGINI" en vez de "Fernanda Dugini" (su perfil).
update public.facturas_manuales set ejecutivo = 'Julieta Salvucci'  where ejecutivo = 'JULIETA SALVUCCI';
update public.facturas_manuales set ejecutivo = 'Fernanda Dugini'   where ejecutivo = 'MARIA FERNANDA DUGINI';
update public.facturas_manuales set ejecutivo = 'Joaquin Ramirez'   where ejecutivo = 'JOAQUIN RAMIREZ';
