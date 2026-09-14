-- Permite a cualquier cuenta autenticada (no solo admin) dejar un comentario
-- de seguimiento en un pendiente de facturación, dejando registro de quién
-- lo escribió. Es la única escritura habilitada para cuentas no-admin en
-- este módulo: la función solo puede *agregar* una entrada al historial
-- (columna `hist`), no puede tocar ningún otro campo de la fila, y por ser
-- SECURITY DEFINER se ejecuta salteando la política de UPDATE que en
-- 20260914_pendientes_facturacion_solo_admin_escribe.sql quedó restringida
-- a admin.
create or replace function public.pendientes_agregar_comentario(p_id uuid, p_texto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
  v_texto text := btrim(p_texto);
begin
  if v_texto = '' or v_texto is null then
    raise exception 'El comentario no puede estar vacío';
  end if;

  select nullif(btrim(nombre), '') into v_nombre
  from public.perfiles where id = auth.uid();

  if v_nombre is null then
    v_nombre := coalesce(auth.jwt() ->> 'email', 'Usuario');
  end if;

  update public.pendientes_facturacion
  set hist = hist || jsonb_build_object('f', to_char(now(), 'DD/MM'), 't', v_texto, 'by', v_nombre),
      actualizado_el = now()
  where id = p_id;

  if not found then
    raise exception 'Pendiente no encontrado';
  end if;
end;
$$;

revoke all on function public.pendientes_agregar_comentario(uuid, text) from public;
grant execute on function public.pendientes_agregar_comentario(uuid, text) to authenticated;
