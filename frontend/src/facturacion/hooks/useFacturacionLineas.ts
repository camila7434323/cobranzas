import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export type FacturacionLinea = {
  id: string
  empresa: string
  cliente: string
  cuit: string
  ejecutivo: string
  legajo: string
  colaborador: string
  otros_conceptos: string
  periodo: string | null
  oc: string
  leyenda: string
  moneda: string
  cantidad: number
  precio_unitario: number
  total_neto: number
  fecha_factura: string | null
  n_factura: string
  cond_venta: string
  articulo_codigo: string
  articulo_descripcion: string
  cc_descripcion: string
  reporte_id: string | null
  creado_el: string
}

export function useFacturacionLineas() {
  const [data, setData] = useState<FacturacionLinea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const PAGE_SIZE = 1000
    const todas: FacturacionLinea[] = []
    let desde = 0
    while (true) {
      const { data: result, error: dbError } = await supabase
        .from('facturacion_lineas')
        .select('*')
        .order('fecha_factura', { ascending: false })
        .order('id', { ascending: true })
        .range(desde, desde + PAGE_SIZE - 1)

      if (dbError) {
        setError(dbError.message)
        setLoading(false)
        return
      }
      todas.push(...(result || []))
      if (!result || result.length < PAGE_SIZE) break
      desde += PAGE_SIZE
    }
    setData(todas)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const CLAVE_NATURAL = ['empresa', 'n_factura', 'articulo_codigo', 'cc_descripcion', 'oc', 'periodo'] as const

  const insertarLote = async (filas: Omit<FacturacionLinea, 'id' | 'creado_el'>[]) => {
    // Si el mismo Excel trae dos filas con la misma clave natural (ej. una
    // línea recurrente repetida), nos quedamos con la última: un solo
    // comando de upsert no puede actualizar la misma fila dos veces.
    const porClave = new Map<string, Omit<FacturacionLinea, 'id' | 'creado_el'>>()
    for (const f of filas) porClave.set(CLAVE_NATURAL.map(k => f[k] ?? '').join('|'), f)
    const filasUnicas = Array.from(porClave.values())

    for (let i = 0; i < filasUnicas.length; i += 500) {
      const { error } = await supabase
        .from('facturacion_lineas')
        .upsert(filasUnicas.slice(i, i + 500), { onConflict: CLAVE_NATURAL.join(',') })
      if (error) throw error
    }
    await cargar()
  }

  return { data, loading, error, refetch: cargar, insertarLote }
}
