import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { reemplazarLineas, PAGE_SIZE, type FacturacionLinea, type LineaNueva } from '../lib/facturacionExcel'

export type { FacturacionLinea } from '../lib/facturacionExcel'

export function useFacturacionLineas() {
  const [data, setData] = useState<FacturacionLinea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { count, error: countError } = await supabase
        .from('facturacion_lineas')
        .select('id', { count: 'exact', head: true })
      if (countError) throw countError

      const paginas = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
      const respuestas = await Promise.all(
        Array.from({ length: paginas }, (_, i) =>
          supabase
            .from('facturacion_lineas')
            .select('*')
            .order('fecha_factura', { ascending: false })
            .order('id', { ascending: true })
            .range(i * PAGE_SIZE, i * PAGE_SIZE + PAGE_SIZE - 1),
        ),
      )

      const todas: FacturacionLinea[] = []
      for (const { data: result, error: dbError } of respuestas) {
        if (dbError) throw dbError
        todas.push(...(result || []))
      }
      setData(todas)
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar la facturación.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const insertarLote = async (filas: LineaNueva[]) => {
    await reemplazarLineas(supabase, filas)
    await cargar()
  }

  return { data, loading, error, refetch: cargar, insertarLote }
}
