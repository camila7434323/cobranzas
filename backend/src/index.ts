import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import cron from 'node-cron'
import { enviarAlertas } from './services/emailService'

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Servir el frontend HTML desde backend/public
app.use(express.static(path.join(__dirname, '../public')))

import('./routes/reportes').then(module => {
  const router = module.default
  app.use('/api/reportes', router)
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mensaje: 'Backend funcionando' })
})

// Fallback: cualquier ruta que no sea /api sirve el index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public/index.html'))
  }
})

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`✅ Backend + Frontend corriendo en http://localhost:${PORT}`)
})

// Enviar alertas todos los días a las 9am
cron.schedule('0 9 * * *', () => {
  console.log('⏰ Enviando alertas automáticas...')
  enviarAlertas()
}, {
  timezone: 'America/Argentina/Buenos_Aires'
})

console.log('⏰ Cron de alertas configurado para las 9am')
