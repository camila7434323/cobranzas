import { Router, Request, Response } from 'express'
import multer from 'multer'
import { procesarArchivo, registrarCobros } from '../services/procesarExcel'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
})

// Sube y procesa un archivo Excel
router.post('/subir', upload.single('archivo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No se recibió archivo' })
      return
    }
    console.log('Archivo recibido:', req.file.originalname)
    const resultado = await procesarArchivo(
      req.file.buffer,
      req.body.usuario || 'sistema',
      req.file.originalname
    )
    res.json({ success: true, ...resultado })
  } catch (error: any) {
    console.error('❌ Error completo:', error)
    res.status(500).json({ error: error?.message || 'Error procesando el archivo' })
  }
})

// Sube un Excel de cobros: marca como cobradas las facturas que matcheen
router.post('/cobros', upload.single('archivo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No se recibió archivo' }); return }
    const resultado = await registrarCobros(req.file.buffer, req.body.usuario || 'sistema')
    res.json({ success: true, ...resultado })
  } catch (error: any) {
    console.error('❌ Error cobros:', error)
    res.status(500).json({ error: error?.message || 'Error procesando el archivo' })
  }
})

// Lista los últimos reportes subidos
router.get('/lista', async (req: Request, res: Response) => {
  try {
    const { supabase } = await import('../lib/supabase')
    const { data } = await supabase.from('reportes').select('*').order('fecha_subida', { ascending: false }).limit(10)
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: 'Error' })
  }
})

// Envía alertas manualmente
router.post('/enviar-alertas', async (req: Request, res: Response) => {
  try {
    const { enviarAlertas } = await import('../services/emailService')
    await enviarAlertas()
    res.json({ success: true, mensaje: 'Alertas enviadas' })
  } catch (error: any) {
    console.error('Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ── Nuevos endpoints para el frontend HTML ─────────────────────────────────

// GET /api/reportes/comprobantes — devuelve todos los pendientes de Supabase
router.get('/comprobantes', async (req: Request, res: Response) => {
  try {
    const { supabase } = await import('../lib/supabase')
    const { data, error } = await supabase
      .from('comprobantes')
      .select('*')
      .eq('estado', 'pendiente')
      .order('dias_mora', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/reportes/historial — devuelve el historial de cobros de Supabase
router.get('/historial', async (req: Request, res: Response) => {
  try {
    const { supabase } = await import('../lib/supabase')
    const { data, error } = await supabase
      .from('historial_cobros')
      .select('*')
      .order('fecha_cobro', { ascending: false })
      .limit(500)
    if (error) throw error
    res.json(data || [])
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/reportes/comprobantes/sync — sincroniza datos parseados del HTML a Supabase
router.post('/comprobantes/sync', async (req: Request, res: Response) => {
  try {
    const { comprobantes, usuario = 'web' } = req.body
    if (!Array.isArray(comprobantes) || comprobantes.length === 0) {
      res.status(400).json({ error: 'No se recibieron comprobantes' })
      return
    }

    const { supabase } = await import('../lib/supabase')

    // Traer pendientes actuales
    const { data: actuales } = await supabase
      .from('comprobantes')
      .select('*')
      .eq('estado', 'pendiente')

    const numerosActuales: string[] = actuales?.map((c: any) => c.comprobante) || []
    const numerosNuevos: string[]   = comprobantes.map((c: any) => c.comp || c.comprobante || '')

    // Detectar cobradas: estaban pendientes pero ya no aparecen en el nuevo reporte
    const cobradas = actuales?.filter((c: any) => !numerosNuevos.includes(c.comprobante)) || []
    for (const cobrada of cobradas) {
      await supabase.from('comprobantes')
        .update({ estado: 'cobrado', updated_at: new Date() })
        .eq('id', cobrada.id)
      await supabase.from('historial_cobros').insert({
        comprobante_id:     cobrada.id,
        comprobante_numero: cobrada.comprobante,
        cliente:            cobrada.nombre_cliente,
        monto:              cobrada.monto,
        fecha_cobro:        new Date(),
        cobrado_por:        usuario,
        ejecutivo:          cobrada.ejecutivo || 'Sin asignar'
      })
    }

    let nuevos = 0, actualizados = 0
    for (const comp of comprobantes) {
      const compNum = comp.comp || comp.comprobante || ''
      if (!compNum) continue

      const dbRecord = {
        codigo:            comp.code  || comp.codigo  || '',
        nombre_cliente:    comp.name  || comp.nombre_cliente || '',
        ejecutivo:         comp.exec?.name || comp.ejecutivo || 'Sin asignar',
        comprobante:       compNum,
        fecha_emision:     ddmmyyyy2iso(comp.emision || comp.fecha_emision),
        fecha_vencimiento: ddmmyyyy2iso(comp.vto     || comp.fecha_vencimiento),
        condicion:         comp.condicion || '',
        monto:             Number(comp.monto) || 0,
        dias_mora:         Number(comp.mora  || comp.dias_mora) || 0,
        estado:            'pendiente'
      }

      if (!numerosActuales.includes(compNum)) {
        const { error } = await supabase.from('comprobantes').insert(dbRecord)
        if (!error) nuevos++
        else console.error('Insert error:', error.message)
      } else {
        const { error } = await supabase.from('comprobantes')
          .update({ ...dbRecord, updated_at: new Date() })
          .eq('comprobante', compNum)
        if (!error) actualizados++
        else console.error('Update error:', error.message)
      }
    }

    console.log(`Sync: nuevos=${nuevos}, actualizados=${actualizados}, cobradas=${cobradas.length}`)
    res.json({ success: true, nuevos, actualizados, cobradas: cobradas.length })
  } catch (error: any) {
    console.error('Sync error:', error)
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/reportes/limpiar — borra todos los comprobantes pendientes (solo admin)
router.delete('/limpiar', async (req: Request, res: Response) => {
  try {
    const { supabase } = await import('../lib/supabase')
    const { error, count } = await supabase
      .from('comprobantes')
      .delete({ count: 'exact' })
      .eq('estado', 'pendiente')
    if (error) throw error
    res.json({ success: true, eliminados: count ?? 0 })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Convierte DD/MM/YYYY o YYYY-MM-DD → YYYY-MM-DD (para Supabase)
function ddmmyyyy2iso(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null
  const s = String(dateStr).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const parts = s.split('/')
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
  }
  return null
}

export default router
