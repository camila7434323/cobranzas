import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { procesarArchivo } from '../../backend/src/services/procesarExcel'

const app = express()
app.use(cors({ origin: '*' }))

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

app.post('*', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No se recibió archivo' }); return }
    const resultado = await procesarArchivo(req.file.buffer, req.body.usuario || 'sistema', req.file.originalname)
    res.json({ success: true, ...resultado })
  } catch (error: any) {
    console.error('Error:', error)
    res.status(500).json({ error: error?.message || 'Error procesando el archivo' })
  }
})

export default app
