import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useUltimoReporte() {
  const [fecha, setFecha] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('reportes')
      .select('fecha_subida')
      .order('fecha_subida', { ascending: false })
      .limit(1)
      .maybeSingle()
    setFecha(data?.fecha_subida ?? null)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { fecha, refetch: cargar }
}
