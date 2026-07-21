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

  const updateComprobanteLocal = (comprobante: string, fields: Record<string, any>) => {
    setData(prev => prev.map(r =>
      r.comprobante === comprobante ? { ...r, ...fields } : r
    ))
  }

  const asignarEjecutivo = async (nombreCliente: string, ejecutivo: string) => {
    const { error } = await supabase
      .from('comprobantes')
      .update({ ejecutivo })
      .eq('nombre_cliente', nombreCliente)
    if (error) throw error
  }

  const actualizarComprobante = async (comprobante: string, fields: Record<string, any>) => {
    const { error } = await supabase
      .from('comprobantes')
      .update(fields)
      .eq('comprobante', comprobante)
    if (error) throw error
    updateComprobanteLocal(comprobante, fields)
  }

  const marcarCobrado = async (rows: any[], cobradoPor: string) => {
    if (!rows.length) return
    const ahora = new Date().toISOString()
    const ids = rows.map(r => r.id)
    const historialNuevo = rows.map(r => ({
      comprobante_id:     r.id,
      comprobante_numero: r.comprobante,
      cliente:            r.nombre_cliente || 'Sin cliente',
      monto:              r.monto || 0,
      fecha_cobro:        ahora,
      cobrado_por:        cobradoPor,
      ejecutivo:          r.ejecutivo || 'Sin asignar',
    }))
    const { error: errHist } = await supabase.from('historial_cobros').insert(historialNuevo)
    if (errHist) throw errHist
    const { error: errUpd } = await supabase.from('comprobantes').update({ estado: 'cobrado', updated_at: ahora }).in('id', ids)
    if (errUpd) throw errUpd
    setData(prev => prev.filter(r => !ids.includes(r.id)))
  }

  const deshacerCobro = async (historialId: string, comprobanteId: string) => {
    const { error: errDel } = await supabase.from('historial_cobros').delete().eq('id', historialId)
    if (errDel) throw errDel
    const { error: errUpd } = await supabase.from('comprobantes').update({ estado: 'pendiente' }).eq('id', comprobanteId)
    if (errUpd) throw errUpd
  }

  useEffect(() => { cargar() }, [cargar])

  return { data, loading, error, refetch: cargar, asignarEjecutivo, updateEjecutivoLocal, actualizarComprobante, updateComprobanteLocal, marcarCobrado, deshacerCobro }
}
