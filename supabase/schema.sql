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
