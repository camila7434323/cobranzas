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

  const insertarLote = async (filas: Omit<FacturacionLinea, 'id' | 'creado_el'>[]) => {
    // El Excel es la fuente de verdad de las facturas que contiene. Reimportar
    // no debe duplicar ni colapsar líneas: borramos las líneas existentes de
    // esas facturas y reinsertamos el desglose completo tal cual viene el Excel
    // (una misma factura puede tener muchas líneas que comparten cliente,
    // artículo y centro de costo, y solo cambian el colaborador o el importe).
    const facturas = Array.from(new Set(filas.map(f => f.n_factura).filter(Boolean)))
    for (let i = 0; i < facturas.length; i += 200) {
      const { error } = await supabase
        .from('facturacion_lineas')
        .delete()
        .in('n_factura', facturas.slice(i, i + 200))
      if (error) throw error
    }

    // Líneas sin número de factura: se limpian por empresa para no acumularlas
    // entre reimportaciones del mismo archivo.
    const empresasSinFactura = Array.from(new Set(filas.filter(f => !f.n_factura).map(f => f.empresa).filter(Boolean)))
    if (empresasSinFactura.length) {
      const { error } = await supabase
        .from('facturacion_lineas')
        .delete()
        .eq('n_factura', '')
        .in('empresa', empresasSinFactura)
      if (error) throw error
    }

    for (let i = 0; i < filas.length; i += 500) {
      const { error } = await supabase
        .from('facturacion_lineas')
        .insert(filas.slice(i, i + 500))
      if (error) throw error
    }
    await cargar()
  }

  return { data, loading, error, refetch: cargar, insertarLote }
}
