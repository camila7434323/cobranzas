import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'

const app = express()
app.use(cors({ origin: '*' }))

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

app.get('*', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('comprobantes').select('*').eq('estado', 'pendiente').order('dias_mora', { ascending: false })
    if (error) throw error
    res.json(data || [])
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default app
