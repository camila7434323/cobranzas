import express from 'express'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { parsearFacturacionExcel, reemplazarLineas } from '../../frontend/src/facturacion/lib/facturacionExcel'

// GET /api/facturacion/sincronizar
//
// La corre el cron de Vercel una vez por día (ver vercel.json).
// 1. Pide un token a Microsoft con la app registrada en Azure (solo lectura).
// 2. Baja el Excel de facturación de OneDrive/SharePoint usando su link.
// 3. Si el archivo no cambió desde la última sincronización, no hace nada.
// 4. Si cambió, lo carga con las mismas reglas que el botón "Cargar Excel".
//
// Variables de entorno:
//   MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET  → app registrada en Azure
//   FACTURACION_EXCEL_URL                         → link para compartir del Excel
//   CRON_SECRET                                   → Vercel lo manda en el header Authorization

const app = express()

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SUBIDO_POR = 'OneDrive (automático)'

async function tokenMicrosoft(): Promise<string> {
  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET } = process.env
  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET) {
    throw new Error('Faltan MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET.')
  }
  const r = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
    }),
  })
  const j: any = await r.json()
  if (!r.ok) throw new Error(`Microsoft rechazó el login: ${j.error_description || j.error || r.status}`)
  return j.access_token
}

// Graph acepta un link para compartir codificado como "u!" + base64url.
const shareId = (url: string) =>
  'u!' + Buffer.from(url).toString('base64').replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-')

app.get('*', async (req, res) => {
  const secreto = process.env.CRON_SECRET
  if (!secreto || req.headers.authorization !== `Bearer ${secreto}`) {
    res.status(401).json({ error: 'No autorizado' })
    return
  }
  const link = process.env.FACTURACION_EXCEL_URL
  if (!link) { res.status(500).json({ error: 'Falta FACTURACION_EXCEL_URL.' }); return }

  try {
    const token = await tokenMicrosoft()
    const base = `https://graph.microsoft.com/v1.0/shares/${shareId(link)}/driveItem`
    const auth = { Authorization: `Bearer ${token}` }

    const meta = await fetch(`${base}?$select=name,lastModifiedDateTime`, { headers: auth })
    const item: any = await meta.json()
    if (!meta.ok) throw new Error(`No se pudo abrir el Excel en OneDrive: ${item?.error?.message || meta.status}`)

    // El nombre del reporte incluye la fecha de modificación: si ya existe,
    // este mismo archivo ya se cargó y no hay nada nuevo.
    const nombre = `${item.name} (modificado ${item.lastModifiedDateTime})`
    const { data: previo, error: prevError } = await supabase
      .from('facturacion_reportes').select('id').eq('nombre_archivo', nombre).eq('subido_por', SUBIDO_POR).limit(1)
    if (prevError) throw prevError
    if (previo?.length) {
      res.json({ success: true, sinCambios: true, archivo: nombre })
      return
    }

    const archivo = await fetch(`${base}/content`, { headers: auth })
    if (!archivo.ok) throw new Error(`No se pudo descargar el Excel: ${archivo.status}`)
    const filas = parsearFacturacionExcel(XLSX, new Uint8Array(await archivo.arrayBuffer()))

    const { data: reporte, error: repError } = await supabase
      .from('facturacion_reportes')
      .insert({ nombre_archivo: nombre, subido_por: SUBIDO_POR, filas_importadas: filas.length })
      .select()
      .single()
    if (repError) throw repError

    try {
      // El cast es porque la raíz y el frontend tienen copias distintas de supabase-js.
      await reemplazarLineas(supabase as unknown as Parameters<typeof reemplazarLineas>[0], filas.map(f => ({ ...f, reporte_id: reporte.id })))
    } catch (e) {
      // Sin el reporte, la próxima corrida vuelve a intentar con este mismo archivo.
      await supabase.from('facturacion_reportes').delete().eq('id', reporte.id)
      throw e
    }

    console.log(`Facturación sincronizada desde OneDrive: ${filas.length} líneas (${nombre})`)
    res.json({ success: true, archivo: nombre, filas: filas.length })
  } catch (error: any) {
    console.error('Sincronización de facturación:', error)
    res.status(500).json({ error: error?.message || 'Error sincronizando el Excel' })
  }
})

export default app
