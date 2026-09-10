-- El módulo de Pendientes de Facturación pasa a estar disponible para cualquier
-- usuario autenticado (antes era solo admin). El "Modo administrador" del frontend
-- queda como control de UI para editar / eliminar / aprobar.
drop policy if exists "Pendientes facturacion solo admin" on public.pendientes_facturacion;
drop policy if exists "Pendientes facturacion autenticados" on public.pendientes_facturacion;
create policy "Pendientes facturacion autenticados"
on public.pendientes_facturacion for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');
