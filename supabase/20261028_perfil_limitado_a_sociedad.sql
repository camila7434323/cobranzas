-- Cuentas limitadas a una sola sociedad (ej. Maria Cadarso: todo lo de España).
--
-- Nueva columna perfiles.sociedad ('sa' | 'llc' | 'sl'). Si está vacía, la cuenta
-- se comporta como siempre según su rol. Si tiene valor, la cuenta solo ve esa
-- sociedad, sin importar el rol: con rol 'gerencia' ve lo de todos los ejecutivos
-- de esa sociedad; con rol 'ejecutivo', solo lo suyo dentro de esa sociedad.

alter table public.perfiles
  add column if not exists sociedad text check (sociedad in ('sa', 'llc', 'sl'));

create or replace function public.sociedad_actual()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select sociedad from public.perfiles where id = auth.uid()
$$;

-- ── comprobantes / historial / extras: son todos de ASAP SA ────────────────
drop policy if exists "Lectura segun rol comprobantes" on public.comprobantes;
create policy "Lectura segun rol comprobantes"
on public.comprobantes for select
using (
  coalesce(public.sociedad_actual(), 'sa') = 'sa'
  and (
    public.rol_actual() in ('admin', 'gerencia')
    or upper(btrim(ejecutivo)) = upper(btrim(public.ejecutivo_actual()))
  )
);

drop policy if exists "Lectura segun rol historial" on public.historial_cobros;
create policy "Lectura segun rol historial"
on public.historial_cobros for select
using (
  coalesce(public.sociedad_actual(), 'sa') = 'sa'
  and (
    public.rol_actual() in ('admin', 'gerencia')
    or upper(btrim(ejecutivo)) = upper(btrim(public.ejecutivo_actual()))
  )
);

drop policy if exists "Lectura segun rol extras" on public.comprobante_extras;
create policy "Lectura segun rol extras"
on public.comprobante_extras for select
using (
  coalesce(public.sociedad_actual(), 'sa') = 'sa'
  and (
    public.rol_actual() in ('admin', 'gerencia')
    or exists (
      select 1 from public.comprobantes c
      where c.comprobante = comprobante_extras.comprobante
        and upper(btrim(c.ejecutivo)) = upper(btrim(public.ejecutivo_actual()))
    )
  )
);

-- ── facturas_manuales: LLC y SL ─────────────────────────────────────────────
drop policy if exists "Lectura segun rol facturas manuales" on public.facturas_manuales;
create policy "Lectura segun rol facturas manuales"
on public.facturas_manuales for select
using (
  (public.sociedad_actual() is null or sociedad = public.sociedad_actual())
  and (
    public.rol_actual() in ('admin', 'gerencia')
    or upper(btrim(ejecutivo)) = upper(btrim(public.ejecutivo_actual()))
  )
);

-- ── Maria Cadarso: ve todo lo de España (IT ASAP Solutions SL) ──────────────
update public.perfiles
set rol = 'gerencia', sociedad = 'sl'
where upper(btrim(ejecutivo_nombre)) = 'MARIA CADARSO';
