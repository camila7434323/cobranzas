-- Extiende a comprobantes / historial_cobros / comprobante_extras el mismo
-- blindaje que 20260914d le dio a facturas_manuales: comparar el nombre de
-- ejecutivo sin importar mayúsculas ni espacios de más. Hoy los datos de
-- estas tres tablas ya están bien escritos (auditado), pero la comparación
-- exacta de texto es justo lo que causó que Julieta, Fernanda y Joaquin no
-- vieran sus propios clientes del exterior — esto evita que un futuro typo
-- vuelva a bloquear a alguien en silencio.
drop policy if exists "Lectura segun rol comprobantes" on public.comprobantes;
create policy "Lectura segun rol comprobantes"
on public.comprobantes for select
using (
  public.rol_actual() in ('admin', 'gerencia')
  or upper(btrim(ejecutivo)) = upper(btrim(public.ejecutivo_actual()))
);

drop policy if exists "Lectura segun rol historial" on public.historial_cobros;
create policy "Lectura segun rol historial"
on public.historial_cobros for select
using (
  public.rol_actual() in ('admin', 'gerencia')
  or upper(btrim(ejecutivo)) = upper(btrim(public.ejecutivo_actual()))
);

drop policy if exists "Lectura segun rol extras" on public.comprobante_extras;
create policy "Lectura segun rol extras"
on public.comprobante_extras for select
using (
  public.rol_actual() in ('admin', 'gerencia')
  or exists (
    select 1 from public.comprobantes c
    where c.comprobante = comprobante_extras.comprobante
      and upper(btrim(c.ejecutivo)) = upper(btrim(public.ejecutivo_actual()))
  )
);
