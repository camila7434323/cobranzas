import express from 'express'
import cors from 'cors'
import { enviarAlertas } from '../../backend/src/services/emailService'

const app = express()
app.use(cors({ origin: '*' }))
app.use(express.json())

app.post('*', async (_req, res) => {
  try {
    await enviarAlertas()
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default app
