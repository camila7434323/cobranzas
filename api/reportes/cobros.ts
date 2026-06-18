import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { registrarCobros } from '../../backend/src/services/procesarExcel'

const app = express()
app.use(cors({ origin: '*' }))

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

app.post('*', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No se recibió archivo' }); return }
    const resultado = await registrarCobros(req.file.buffer, req.body.usuario || 'sistema')
    res.json({ success: true, ...resultado })
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error' })
  }
})

export default app
