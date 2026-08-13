-- ── Corrige fuga de datos: política "public_all" no documentada ───────────
--
-- La migración anterior (20260813c) no pudo eliminar esta política porque
-- no figuraba en supabase/schema.sql ni se conocía su nombre exacto. Como
-- las políticas RLS se combinan con OR, "public_all" (using true) anulaba
-- por completo la restricción por rol/ejecutivo recién creada.

drop policy if exists "public_all" on public.comprobantes;

-- Estas tres tablas tampoco están documentadas en schema.sql y el frontend
-- actual no las consulta. Igual tenían "public_all" (lectura y escritura
-- para cualquiera, incluso sin sesión). Las dejamos accesibles solo para
-- admin como medida de precaución, sin asumir su estructura interna.
drop policy if exists "public_all" on public.ediciones;
create policy "Solo admin ediciones"
on public.ediciones for all
using (public.rol_actual() = 'admin')
with check (public.rol_actual() = 'admin');

drop policy if exists "public_all" on public.eliminados;
create policy "Solo admin eliminados"
on public.eliminados for all
using (public.rol_actual() = 'admin')
with check (public.rol_actual() = 'admin');

drop policy if exists "public_all" on public.historial;
create policy "Solo admin historial legacy"
on public.historial for all
using (public.rol_actual() = 'admin')
with check (public.rol_actual() = 'admin');
