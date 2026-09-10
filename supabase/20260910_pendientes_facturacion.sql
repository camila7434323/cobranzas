-- Módulo "Pendientes de Facturación": cosas que faltan para poder facturar
-- (OC, HES, aprobaciones internas, respuesta del cliente…). Se registran a mano;
-- el sistema no las detecta solo. Lo puede usar cualquier usuario autenticado.
create table if not exists public.pendientes_facturacion (
  id uuid primary key default gen_random_uuid(),
  entidad text not null check (entidad in ('sa', 'llc', 'sl')),
  cliente text not null default '',
  motivo text not null default '',
  concepto text not null default '',
  resp text not null default '',                 -- ejecutivo responsable
  importe numeric(18, 2) not null default 0,
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD', 'EUR')),
  deber date,                                    -- debió facturarse el
  periodo text not null default '',             -- 'YYYY-MM'
  hist jsonb not null default '[]'::jsonb,       -- [{ f: 'DD/MM', t: 'texto' }]
  estado text not null default 'activo' check (estado in ('activo', 'aprobado')),
  aprobado_el date,
  via text,
  comentario text,
  dias_al_aprobar integer,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);

create index if not exists pendientes_facturacion_estado_idx  on public.pendientes_facturacion (estado);
create index if not exists pendientes_facturacion_entidad_idx on public.pendientes_facturacion (entidad);

alter table public.pendientes_facturacion enable row level security;

drop policy if exists "Pendientes facturacion solo admin" on public.pendientes_facturacion;
drop policy if exists "Pendientes facturacion autenticados" on public.pendientes_facturacion;
create policy "Pendientes facturacion autenticados"
on public.pendientes_facturacion for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');
