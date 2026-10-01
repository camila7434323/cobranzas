-- ── Ingreso desde WiSoft (SSO) ──────────────────────────────────────────
--
-- WiSoft (Talent) redirige a Cobranzas con un JWT en ?auth=. El endpoint
-- /api/sso lo valida y abre una sesión de Supabase para el usuario con ese
-- mismo email. Esta migración agrega lo que necesita ese endpoint.

-- 1) Tokens ya usados: cada token de WiSoft sirve para un solo ingreso.
--    Se guarda el hash (no el token) hasta que vence; el endpoint limpia los viejos.
create table if not exists public.sso_tokens_usados (
  hash text primary key,
  email text not null,
  wisoft_sub text,
  usado_el timestamptz not null default now(),
  expira_el timestamptz not null
);

-- RLS activa y sin políticas: solo la service key (backend) puede leer/escribir.
alter table public.sso_tokens_usados enable row level security;

-- 2) Buscar el id de un usuario por email (sin distinguir mayúsculas).
--    Solo la puede ejecutar el backend con la service key.
create or replace function public.sso_usuario_por_email(p_email text)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;

revoke all on function public.sso_usuario_por_email(text) from public, anon, authenticated;
grant execute on function public.sso_usuario_por_email(text) to service_role;
