# Cobranzas ASAP

Aplicacion web para cargar reportes Excel de cuentas corrientes, detectar comprobantes pendientes/cobrados y consultar la cartera desde Supabase.

## Que hace

- Permite subir `.xls`, `.xlsx` o `.csv` desde la pantalla principal.
- Lee reportes con columnas como `Fecha`, `Comprobante`, `Vto.`, `Condicion de Venta`, `Importe` y `Mora`.
- Soporta comprobantes `FC`, `FCM`, `NC`, `NCM`, `ND` y `NDM`.
- Inserta nuevos comprobantes en Supabase.
- Actualiza comprobantes ya existentes.
- Marca como `cobrado` lo que estaba pendiente y ya no aparece en el nuevo reporte.
- Guarda historial de cobros y de reportes subidos.

## 1. Crear la base en Supabase

1. Crear un proyecto en Supabase.
2. Ir a `SQL Editor`.
3. Ejecutar el archivo [supabase/schema.sql](supabase/schema.sql).
4. Copiar:
   - `Project URL`
   - `anon public key`
   - `service_role key`

## 2. Configurar variables

Crear `backend/.env` usando [backend/.env.example](backend/.env.example):

```env
PORT=3001
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu-service-role-key
```

Crear `frontend/.env` usando [frontend/.env.example](frontend/.env.example):

```env
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
VITE_SUPABASE_STORAGE_URL=https://tu-proyecto.supabase.co/storage/v1/object/public/facturas
```

## 3. Levantar en local

En una terminal:

```bash
cd backend
npm install
npm run dev
```

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abrir la URL que muestre Vite, normalmente `http://localhost:5173`.

## 4. Subir para que lo usen otras personas

Opcion simple:

- Backend en Render, Railway o Fly.io.
- Frontend en Vercel o Netlify.
- Supabase como base de datos.

En produccion, configurar:

- `SUPABASE_SERVICE_KEY` solo en el backend.
- `VITE_SUPABASE_ANON_KEY` en el frontend.
- `VITE_API_URL` apuntando a la URL publica del backend.

Nunca publiques la `service_role key` en el frontend.
