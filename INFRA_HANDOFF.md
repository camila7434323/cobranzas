# Cobranzas — Handoff de infraestructura

## Arquitectura actual

```
GitHub (camila7434323/cobranzas)
        │  push a main → deploy automático
        ▼
   Vercel (cobranzas-three.vercel.app)
   ├── Frontend: Vite/React, build desde /frontend, sirve /frontend/dist
   └── API: funciones serverless en /api (Express empaquetado como
       función Vercel), la lógica de negocio vive en /backend/src
       (services), importada directamente por /api/index.ts
        │
        ▼
   Supabase (proyecto hnawclmgtopbylubzoos)
   ├── Postgres (tablas: comprobantes, historial_cobros, facturas_manuales,
   │   pendientes_facturacion, etc. — ver /supabase/schema.sql)
   ├── Auth (roles: admin / ejecutivo, con RLS)
   └── Storage (bucket público facturas-pdf)
```

Todo corre en **un solo repo monorepo**, un solo dominio de Vercel, un solo proyecto de Supabase. No hay backend separado corriendo en Render ni en ningún otro lado actualmente.

## Piezas y quién las administra

| Pieza | Dónde | Notas |
|---|---|---|
| Código fuente | GitHub — `camila7434323/cobranzas` | main = producción, deploy automático |
| Hosting frontend + API | Vercel — proyecto detrás de `cobranzas-three.vercel.app` | Build: `npm --prefix frontend install && npm run build`. Config en `/vercel.json` |
| Base de datos | Supabase — proyecto `hnawclmgtopbylubzoos` | Migraciones versionadas en `/supabase/*.sql`, se aplican a mano (no hay CI corriendo migraciones automáticamente — confirmar con quien las corrió) |
| Storage de PDFs | Supabase Storage, bucket `facturas-pdf` | Público de lectura |
| Envío de mails/alertas | SMTP (ver `enviarAlertas` en `backend/src/services/emailService`) | Credenciales en env vars `MAIL_*` / `SMTP_*` |

## Variables de entorno necesarias

Configurar en **Vercel → Settings → Environment Variables** del proyecto (no en Render, ese plan quedó descartado):

**Backend / API (server-side, sin prefijo VITE_):**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (service role — secreta, no confundir con la anon key)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (opcional, para alertas por mail)

**Frontend (build-time, prefijo VITE_):**
- `VITE_API_URL` → debe apuntar al propio dominio de Vercel (`https://cobranzas-three.vercel.app`)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (pública, no es secreta)
- `VITE_SUPABASE_STORAGE_URL`

Los valores reales están en `frontend/.env.production` y `backend/.env` en local (ambos gitignoreados, no están en el repo). Habría que pasárselos a infra por un canal seguro (no por este documento) si necesitan re-crear el entorno en Vercel.

## Qué IGNORAR (config obsoleta, no reflejan el deploy actual)

- **`render.yaml`** — plan viejo para hostear frontend estático + backend Express en Render. Se abandonó a favor de Vercel serverless. Si nadie confirma un deploy activo en `*.onrender.com`, se puede borrar.
- **`Procfile`, `build.sh`** — restos de otro intento de deploy (estilo Heroku). No están en uso.

`backend/` **no es legacy**: aunque no se despliega solo, su código (`backend/src/services/*`) es importado directamente por las funciones serverless en `api/`. Es la lógica de negocio real, solo que corre empaquetada dentro de Vercel en vez de como servidor standalone.

## Accesos que necesita infra

1. Acceso al repo de GitHub `camila7434323/cobranzas`
2. Acceso al proyecto en Vercel (dashboard + env vars)
3. Acceso al proyecto Supabase `hnawclmgtopbylubzoos` (DB, Auth, Storage)
4. Credenciales SMTP si van a tocar el envío de alertas

## Pendiente de confirmar antes de cerrar el handoff

- ¿Sigue habiendo algo desplegado en Render (`cobranzas-backend.onrender.com`)? Si sí, hay que decidir si se apaga.
- ¿Cómo se aplican las migraciones de `/supabase/*.sql` hoy — a mano vía SQL editor, o hay algún script/CI que no vi en el repo?
- ¿Quién es el owner actual de la cuenta de Vercel y del proyecto de Supabase (para dar accesos)?
