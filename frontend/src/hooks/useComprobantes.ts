import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useComprobantes() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data: result, error: dbError } = await supabase
        .from('comprobantes')
        .select('*')
        .eq('estado', 'pendiente')
        .order('dias_mora', { ascending: false })

      if (dbError) {
        console.error('Error cargando comprobantes:', dbError)
        setError(dbError.message)
        setLoading(false)
        return
      }
      setData(result || [])
      setLoading(false)
    } catch (err: any) {
      console.error('Error en cargar comprobantes:', err)
      setError(err?.message || 'Error desconocido')
      setLoading(false)
    }
  }, [])

  const updateEjecutivoLocal = (nombreCliente: string, ejecutivo: string) => {
    setData(prev => prev.map(r =>
      r.nombre_cliente === nombreCliente ? { ...r, ejecutivo } : r
    ))
  }

  const asignarEjecutivo = async (nombreCliente: string, ejecutivo: string) => {
    const { error } = await supabase
      .from('comprobantes')
      .update({ ejecutivo })
      .eq('nombre_cliente', nombreCliente)
    if (error) throw error
  }

  useEffect(() => { cargar() }, [cargar])

  return { data, loading, error, refetch: cargar, asignarEjecutivo, updateEjecutivoLocal }
}