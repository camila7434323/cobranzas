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

const PAGE_SIZE = 1000

// Corre `fn` sobre los trozos de `items` en tandas paralelas (hasta
// `concurrencia` requests a la vez) en lugar de una por una.
async function enTandas<T>(items: T[], tam: number, fn: (trozo: T[]) => Promise<void>, concurrencia = 6) {
  const trozos: T[][] = []
  for (let i = 0; i < items.length; i += tam) trozos.push(items.slice(i, i + tam))
  for (let i = 0; i < trozos.length; i += concurrencia) {
    await Promise.all(trozos.slice(i, i + concurrencia).map(fn))
  }
}

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

  const insertarLote = async (filas: Omit<FacturacionLinea, 'id' | 'creado_el'>[]) => {
    // El Excel es la fuente de verdad de las facturas que contiene. Reimportar
    // no debe duplicar ni colapsar líneas: borramos las líneas existentes de
    // esas facturas y reinsertamos el desglose completo tal cual viene el Excel
    // (una misma factura puede tener muchas líneas que comparten cliente,
    // artículo y centro de costo, y solo cambian el colaborador o el importe).
    const facturas = Array.from(new Set(filas.map(f => f.n_factura).filter(Boolean)))
    await enTandas(facturas, 500, async trozo => {
      const { error } = await supabase.from('facturacion_lineas').delete().in('n_factura', trozo)
      if (error) throw error
    })

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

    await enTandas(filas, PAGE_SIZE, async trozo => {
      const { error } = await supabase.from('facturacion_lineas').insert(trozo)
      if (error) throw error
    })
    await cargar()
  }

  return { data, loading, error, refetch: cargar, insertarLote }
}
