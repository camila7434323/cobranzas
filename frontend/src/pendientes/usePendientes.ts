import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type HistItem = { f: string; t: string }

export type Pendiente = {
  id: string
  entidad: 'sa' | 'llc' | 'sl'
  cliente: string
  motivo: string
  concepto: string
  resp: string
  importe: number
  moneda: 'ARS' | 'USD' | 'EUR'
  deber: string | null
  periodo: string
  hist: HistItem[]
  estado: 'activo' | 'aprobado'
  aprobado_el: string | null
  via: string | null
  comentario: string | null
  dias_al_aprobar: number | null
}

export type NuevoPendiente = {
  entidad: 'sa' | 'llc' | 'sl'
  cliente: string
  motivo: string
  concepto: string
  resp: string
  importe: number
  moneda: 'ARS' | 'USD' | 'EUR'
  deber: string
  periodo: string
  hist: HistItem[]
}

export function usePendientes() {
  const [rows, setRows] = useState<Pendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: dbError } = await supabase
      .from('pendientes_facturacion')
      .select('*')
      .order('creado_el', { ascending: true })
    if (dbError) setError(dbError.message)
    else setRows((data || []).map(r => ({ ...r, hist: Array.isArray(r.hist) ? r.hist : [] })) as Pendiente[])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const crear = async (p: NuevoPendiente) => {
    const { error: dbError } = await supabase
      .from('pendientes_facturacion')
      .insert({ ...p, estado: 'activo' })
    if (dbError) throw dbError
    await cargar()
  }

  const actualizar = async (id: string, campos: Partial<Pendiente>) => {
    const { error: dbError } = await supabase
      .from('pendientes_facturacion')
      .update({ ...campos, actualizado_el: new Date().toISOString() })
      .eq('id', id)
    if (dbError) throw dbError
    await cargar()
  }

  const eliminar = async (id: string) => {
    const { error: dbError } = await supabase
      .from('pendientes_facturacion')
      .delete()
      .eq('id', id)
    if (dbError) throw dbError
    await cargar()
  }

  return { rows, loading, error, refetch: cargar, crear, actualizar, eliminar }
}
