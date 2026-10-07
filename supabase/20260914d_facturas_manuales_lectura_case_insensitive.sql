-- Blinda el filtro de RLS de facturas_manuales contra diferencias de
-- mayúsculas/espacios entre el "ejecutivo" cargado a mano en una factura y
-- perfiles.ejecutivo_nombre. Antes la comparación era texto exacto, así que
-- alcanzaba con cargar "JULIETA SALVUCCI" en vez de "Julieta Salvucci" para
-- que esa cuenta dejara de ver ese cliente sin ningún error visible.
drop policy if exists "Lectura segun rol facturas manuales" on public.facturas_manuales;

create policy "Lectura segun rol facturas manuales"
on public.facturas_manuales for select
using (
  public.rol_actual() in ('admin', 'gerencia')
  or upper(btrim(ejecutivo)) = upper(btrim(public.ejecutivo_actual()))
);
