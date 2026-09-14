-- Pendientes de Facturación pasa a ser de solo lectura para cuentas que no
-- son admin: cualquier autenticado puede ver, pero crear, editar (incluida
-- la nota de seguimiento), eliminar y aprobar queda restringido a admin.
-- Antes (20260910b) cualquier autenticado podía además insertar/actualizar/
-- borrar directo contra la base, aunque el frontend mostrara el "Modo
-- administrador" en OFF: el toggle de UI no bloqueaba nada a nivel de datos.
drop policy if exists "Pendientes facturacion solo admin" on public.pendientes_facturacion;
drop policy if exists "Pendientes facturacion autenticados" on public.pendientes_facturacion;

create policy "Lectura autenticados pendientes facturacion"
on public.pendientes_facturacion for select
using (auth.role() = 'authenticated');

create policy "Escritura solo admin pendientes facturacion"
on public.pendientes_facturacion for insert
with check (public.rol_actual() = 'admin');

create policy "Actualizacion solo admin pendientes facturacion"
on public.pendientes_facturacion for update
using (public.rol_actual() = 'admin')
with check (public.rol_actual() = 'admin');

create policy "Eliminacion solo admin pendientes facturacion"
on public.pendientes_facturacion for delete
using (public.rol_actual() = 'admin');
