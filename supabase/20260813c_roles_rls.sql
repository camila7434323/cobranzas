-- ── Roles y permisos por usuario (módulo Cobranzas) ────────────────────────
--
-- Tres roles:
--   admin      -> ve y edita todo (único que puede escribir)
--   gerencia   -> ve todo, solo lectura
--   ejecutivo  -> ve solo las filas donde `ejecutivo` = su nombre, solo lectura
--
-- Antes de esta migración, las políticas de RLS eran públicas para lectura
-- (using (true)) y de escritura para "cualquier usuario autenticado" sin
-- distinción de rol. Esto se reemplaza por políticas basadas en el rol
-- guardado en `public.perfiles`.

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  rol text not null check (rol in ('admin', 'gerencia', 'ejecutivo')),
  ejecutivo_nombre text,
  nombre text not null default '',
  creado_el timestamptz not null default now()
);

alter table public.perfiles enable row level security;

drop policy if exists "Perfil propio" on public.perfiles;
create policy "Perfil propio"
on public.perfiles for select
using (auth.uid() = id);

-- Asegura que la cuenta admin existente no quede bloqueada apenas se
-- activen las políticas nuevas de abajo.
insert into public.perfiles (id, rol, nombre)
select id, 'admin', 'Administración'
from auth.users
where email = 'cobranzas@asap.com'
on conflict (id) do update set rol = 'admin';

-- Funciones security definer: evitan recursión de RLS al consultar el
-- propio rol/ejecutivo dentro de las políticas de otras tablas.
create or replace function public.rol_actual()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select rol from public.perfiles where id = auth.uid()
$$;

create or replace function public.ejecutivo_actual()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select ejecutivo_nombre from public.perfiles where id = auth.uid()
$$;

-- ── comprobantes ────────────────────────────────────────────────────────
drop policy if exists "Lectura publica comprobantes" on public.comprobantes;
drop policy if exists "Escritura autenticada comprobantes" on public.comprobantes;
drop policy if exists "Lectura segun rol comprobantes" on public.comprobantes;
drop policy if exists "Escritura solo admin comprobantes" on public.comprobantes;

create policy "Lectura segun rol comprobantes"
on public.comprobantes for select
using (
  public.rol_actual() in ('admin', 'gerencia')
  or ejecutivo = public.ejecutivo_actual()
);

create policy "Escritura solo admin comprobantes"
on public.comprobantes for all
using (public.rol_actual() = 'admin')
with check (public.rol_actual() = 'admin');

-- ── historial_cobros ────────────────────────────────────────────────────
drop policy if exists "Lectura publica historial" on public.historial_cobros;
drop policy if exists "Lectura segun rol historial" on public.historial_cobros;
drop policy if exists "Escritura solo admin historial" on public.historial_cobros;

create policy "Lectura segun rol historial"
on public.historial_cobros for select
using (
  public.rol_actual() in ('admin', 'gerencia')
  or ejecutivo = public.ejecutivo_actual()
);

create policy "Escritura solo admin historial"
on public.historial_cobros for all
using (public.rol_actual() = 'admin')
with check (public.rol_actual() = 'admin');

-- ── comprobante_extras (se filtra por el ejecutivo del comprobante padre) ─
drop policy if exists "Lectura publica extras" on public.comprobante_extras;
drop policy if exists "Escritura autenticada extras" on public.comprobante_extras;
drop policy if exists "Lectura segun rol extras" on public.comprobante_extras;
drop policy if exists "Escritura solo admin extras" on public.comprobante_extras;

create policy "Lectura segun rol extras"
on public.comprobante_extras for select
using (
  public.rol_actual() in ('admin', 'gerencia')
  or exists (
    select 1 from public.comprobantes c
    where c.comprobante = comprobante_extras.comprobante
      and c.ejecutivo = public.ejecutivo_actual()
  )
);

create policy "Escritura solo admin extras"
on public.comprobante_extras for all
using (public.rol_actual() = 'admin')
with check (public.rol_actual() = 'admin');

-- ── facturas_manuales ───────────────────────────────────────────────────
drop policy if exists "Lectura publica facturas manuales" on public.facturas_manuales;
drop policy if exists "Escritura autenticada facturas manuales" on public.facturas_manuales;
drop policy if exists "Lectura segun rol facturas manuales" on public.facturas_manuales;
drop policy if exists "Escritura solo admin facturas manuales" on public.facturas_manuales;

create policy "Lectura segun rol facturas manuales"
on public.facturas_manuales for select
using (
  public.rol_actual() in ('admin', 'gerencia')
  or ejecutivo = public.ejecutivo_actual()
);

create policy "Escritura solo admin facturas manuales"
on public.facturas_manuales for all
using (public.rol_actual() = 'admin')
with check (public.rol_actual() = 'admin');

-- ── reportes (historial de cargas: admin y gerencia únicamente) ─────────
drop policy if exists "Lectura publica reportes" on public.reportes;
drop policy if exists "Lectura admin gerencia reportes" on public.reportes;
drop policy if exists "Escritura solo admin reportes" on public.reportes;

create policy "Lectura admin gerencia reportes"
on public.reportes for select
using (public.rol_actual() in ('admin', 'gerencia'));

create policy "Escritura solo admin reportes"
on public.reportes for all
using (public.rol_actual() = 'admin')
with check (public.rol_actual() = 'admin');

-- Nota: el módulo Facturación (facturacion_lineas, facturacion_reportes) y
-- el bucket de storage "facturas-pdf" quedan fuera de esta migración a
-- propósito; no se tocaron sus políticas.
