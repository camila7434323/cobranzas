import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { createClient } from '@supabase/supabase-js'
import { procesarArchivo, registrarCobros } from '../backend/src/services/procesarExcel'
import { enviarAlertas } from '../backend/src/services/emailService'

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '10mb' }))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
})

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const paths = (p: string) => [p, `/api${p}`]

// POST /reportes/subir
app.post(paths('/reportes/subir'), upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No se recibió archivo' }); return }
    const resultado = await procesarArchivo(req.file.buffer, req.body.usuario || 'sistema', req.file.originalname)
    res.json({ success: true, ...resultado })
  } catch (error: any) {
    console.error('❌ Error:', error)
    res.status(500).json({ error: error?.message || 'Error procesando el archivo' })
  }
})

// POST /reportes/cobros
app.post(paths('/reportes/cobros'), upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No se recibió archivo' }); return }
    const resultado = await registrarCobros(req.file.buffer, req.body.usuario || 'sistema')
    res.json({ success: true, ...resultado })
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error' })
  }
})

// GET /reportes/comprobantes
app.get(paths('/reportes/comprobantes'), async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('comprobantes').select('*').eq('estado', 'pendiente').order('dias_mora', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// GET /reportes/historial
app.get(paths('/reportes/historial'), async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('historial_cobros').select('*').order('fecha_cobro', { ascending: false }).limit(500)
    if (error) throw error
    res.json(data || [])
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// GET /health
app.get(paths('/health'), (_req, res) => {
  res.json({ status: 'ok' })
})

// POST /reportes/enviar-alertas
app.post(paths('/reportes/enviar-alertas'), async (_req, res) => {
  try {
    await enviarAlertas()
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default app
