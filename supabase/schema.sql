create extension if not exists pgcrypto;

create table if not exists public.comprobantes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null default '',
  nombre_cliente text not null,
  ejecutivo text not null default 'Sin asignar',
  comprobante text not null unique,
  fecha_emision date,
  fecha_vencimiento date,
  condicion text not null default '',
  monto numeric(14, 2) not null default 0,
  dias_mora integer not null default 0,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'cobrado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comprobantes_estado_idx on public.comprobantes (estado);
create index if not exists comprobantes_ejecutivo_idx on public.comprobantes (ejecutivo);
create index if not exists comprobantes_dias_mora_idx on public.comprobantes (dias_mora desc);

create table if not exists public.historial_cobros (
  id uuid primary key default gen_random_uuid(),
  comprobante_id uuid references public.comprobantes(id) on delete set null,
  comprobante_numero text not null,
  cliente text not null,
  monto numeric(14, 2) not null default 0,
  fecha_cobro timestamptz not null default now(),
  cobrado_por text not null default 'sistema',
  ejecutivo text not null default 'Sin asignar'
);

create index if not exists historial_cobros_fecha_idx on public.historial_cobros (fecha_cobro desc);

create table if not exists public.reportes (
  id uuid primary key default gen_random_uuid(),
  nombre_archivo text not null,
  subido_por text not null default 'sistema',
  comprobantes_nuevos integer not null default 0,
  comprobantes_cobrados integer not null default 0,
  comprobantes_actualizados integer not null default 0,
  fecha_subida timestamptz not null default now()
);

create table if not exists public.comprobante_extras (
  comprobante text primary key references public.comprobantes(comprobante) on delete cascade,
  descripcion text not null default '',
  centro_costo text not null default '',
  tipo_servicio text not null default '',
  oc_hes_pedido text not null default '',
  colaborador text not null default '',
  otros_conceptos text not null default '',
  condicion_override text not null default '',
  periodo text not null default '',
  nota text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists comprobante_extras_set_updated_at on public.comprobante_extras;
create trigger comprobante_extras_set_updated_at
before update on public.comprobante_extras
for each row execute function public.set_updated_at();

alter table public.comprobante_extras enable row level security;

drop policy if exists "Lectura publica extras" on public.comprobante_extras;
create policy "Lectura publica extras"
on public.comprobante_extras for select
using (true);

drop policy if exists "Escritura autenticada extras" on public.comprobante_extras;
create policy "Escritura autenticada extras"
on public.comprobante_extras for all
using (auth.role() = 'authenticated');

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists comprobantes_set_updated_at on public.comprobantes;
create trigger comprobantes_set_updated_at
before update on public.comprobantes
for each row execute function public.set_updated_at();

alter table public.comprobantes enable row level security;
alter table public.historial_cobros enable row level security;
alter table public.reportes enable row level security;

drop policy if exists "Lectura publica comprobantes" on public.comprobantes;
create policy "Lectura publica comprobantes"
on public.comprobantes for select
using (true);

drop policy if exists "Lectura publica historial" on public.historial_cobros;
create policy "Lectura publica historial"
on public.historial_cobros for select
using (true);

drop policy if exists "Lectura publica reportes" on public.reportes;
create policy "Lectura publica reportes"
on public.reportes for select
using (true);

create table if not exists public.facturas_manuales (
  id text primary key,
  sociedad text not null check (sociedad in ('llc', 'sl')),
  comprobante text not null,
  cliente text not null,
  ejecutivo text not null default 'Sin asignar',
  fecha_emision date,
  fecha_vencimiento date,
  condicion text not null default '',
  moneda text not null default '',
  descripcion text not null default '',
  unidad text not null default '',
  cantidad numeric(14, 2) not null default 0,
  valor_unitario numeric(14, 2) not null default 0,
  monto numeric(14, 2) not null default 0,
  oc_hes_pedido text not null default '',
  periodo text not null default '',
  colaborador text not null default '',
  otros_conceptos text not null default '',
  pdf_url text not null default '',
  pdf_base64 text not null default '',
  pdf_nombre text not null default '',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'cobrado')),
  creado_el timestamptz not null default now(),
  cobrado_el timestamptz
);

create index if not exists facturas_manuales_sociedad_idx on public.facturas_manuales (sociedad);
create index if not exists facturas_manuales_estado_idx on public.facturas_manuales (estado);

alter table public.facturas_manuales enable row level security;

drop policy if exists "Lectura publica facturas manuales" on public.facturas_manuales;
create policy "Lectura publica facturas manuales"
on public.facturas_manuales for select
using (true);

drop policy if exists "Escritura autenticada facturas manuales" on public.facturas_manuales;
create policy "Escritura autenticada facturas manuales"
on public.facturas_manuales for all
using (auth.role() = 'authenticated');

drop policy if exists "Lectura publica facturas-pdf" on storage.objects;
create policy "Lectura publica facturas-pdf"
on storage.objects for select
using (bucket_id = 'facturas-pdf');

-- ── Módulo Facturación ───────────────────────────────────────────────────

create table if not exists public.facturacion_reportes (
  id uuid primary key default gen_random_uuid(),
  nombre_archivo text not null,
  subido_por text not null default 'sistema',
  filas_importadas integer not null default 0,
  fecha_subida timestamptz not null default now()
);

create table if not exists public.facturacion_lineas (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  cliente text not null,
  cuit text not null default '',
  ejecutivo text not null default '',
  legajo text not null default '',
  colaborador text not null default '',
  otros_conceptos text not null default '',
  periodo date,
  oc text not null default '',
  leyenda text not null default '',
  moneda text not null default 'ARS',
  cantidad numeric(18, 6) not null default 0,
  precio_unitario numeric(18, 6) not null default 0,
  total_neto numeric(18, 6) not null default 0,
  fecha_factura date,
  n_factura text not null default '',
  cond_venta text not null default '',
  articulo_codigo text not null default '',
  articulo_descripcion text not null default '',
  cc_descripcion text not null default '',
  reporte_id uuid references public.facturacion_reportes(id) on delete set null,
  creado_el timestamptz not null default now()
  -- Sin clave natural: una factura puede tener muchas líneas que comparten
  -- empresa/artículo/CC/OC/período y solo cambian colaborador o importe. La
  -- reimportación reemplaza por número de factura (ver useFacturacionLineas).
);

create index if not exists facturacion_lineas_empresa_idx  on public.facturacion_lineas (empresa);
create index if not exists facturacion_lineas_cliente_idx  on public.facturacion_lineas (cliente);
create index if not exists facturacion_lineas_periodo_idx  on public.facturacion_lineas (periodo);
create index if not exists facturacion_lineas_nfactura_idx on public.facturacion_lineas (n_factura);

alter table public.facturacion_reportes enable row level security;
alter table public.facturacion_lineas   enable row level security;

drop policy if exists "Lectura publica facturacion_reportes" on public.facturacion_reportes;
create policy "Lectura publica facturacion_reportes"
on public.facturacion_reportes for select
using (true);

drop policy if exists "Escritura autenticada facturacion_reportes" on public.facturacion_reportes;
create policy "Escritura autenticada facturacion_reportes"
on public.facturacion_reportes for all
using (auth.role() = 'authenticated');

drop policy if exists "Lectura publica facturacion_lineas" on public.facturacion_lineas;
create policy "Lectura publica facturacion_lineas"
on public.facturacion_lineas for select
using (true);

drop policy if exists "Escritura autenticada facturacion_lineas" on public.facturacion_lineas;
create policy "Escritura autenticada facturacion_lineas"
on public.facturacion_lineas for all
using (auth.role() = 'authenticated');
