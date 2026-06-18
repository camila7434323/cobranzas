import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useHistorial() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data: result, error: dbError } = await supabase
        .from('historial_cobros')
        .select('*')
        .order('fecha_cobro', { ascending: false })

      if (dbError) {
        console.error('Error cargando historial:', dbError)
        setError(dbError.message)
        setLoading(false)
        return
      }
      setData(result || [])
      setLoading(false)
    } catch (err: any) {
      console.error('Error en cargar historial:', err)
      setError(err?.message || 'Error desconocido')
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { data, loading, error, refetch: cargar }
}