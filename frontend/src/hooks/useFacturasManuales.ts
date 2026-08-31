import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ManualFactura, SociedadKey } from '../types/sociedades'

type Row = ManualFactura & { estado: 'pendiente' | 'cobrado' }

export function useFacturasManuales() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: dbError } = await supabase
        .from('facturas_manuales')
        .select('*')
        .order('creado_el', { ascending: false })
      if (dbError) { setError(dbError.message); setLoading(false); return }
      setRows((data as Row[]) || [])
      setLoading(false)
    } catch (err: any) {
      setError(err?.message || 'Error desconocido')
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const facturas = rows.filter(r => r.estado === 'pendiente')
  const historial = {
    sa: [] as ManualFactura[],
    llc: rows.filter(r => r.estado === 'cobrado' && r.sociedad === 'llc'),
    sl:  rows.filter(r => r.estado === 'cobrado' && r.sociedad === 'sl'),
  } as Record<SociedadKey, ManualFactura[]>
  const execsConocidos = {
    sa: [] as string[],
    llc: [...new Set(rows.filter(r => r.sociedad === 'llc').map(r => r.ejecutivo).filter(e => e && e !== 'Sin asignar'))].sort(),
    sl:  [...new Set(rows.filter(r => r.sociedad === 'sl').map(r => r.ejecutivo).filter(e => e && e !== 'Sin asignar'))].sort(),
  } as Record<SociedadKey, string[]>
  const clientesConocidos = {
    sa: [] as string[],
    llc: [...new Set(rows.filter(r => r.sociedad === 'llc').map(r => r.cliente).filter(Boolean))].sort(),
    sl:  [...new Set(rows.filter(r => r.sociedad === 'sl').map(r => r.cliente).filter(Boolean))].sort(),
  } as Record<SociedadKey, string[]>

  const guardarFactura = async (factura: ManualFactura) => {
    const { cobrado_el, ...resto } = factura
    const payload = {
      ...resto,
      fecha_emision: resto.fecha_emision || null,
      fecha_vencimiento: resto.fecha_vencimiento || null,
      estado: cobrado_el ? 'cobrado' as const : 'pendiente' as const,
      cobrado_el: cobrado_el || null,
    }
    const { error: err } = await supabase.from('facturas_manuales').upsert(payload, { onConflict: 'id' })
    if (err) throw new Error(err.message)
    await cargar()
  }

  const marcarCobrada = async (factura: ManualFactura, fechaPago: string) => {
    const { error: err } = await supabase.from('facturas_manuales').update({ estado: 'cobrado', cobrado_el: fechaPago }).eq('id', factura.id)
    if (err) throw new Error(err.message)
    await cargar()
  }

  const deshacerCobro = async (factura: ManualFactura) => {
    const { error: err } = await supabase.from('facturas_manuales').update({ estado: 'pendiente', cobrado_el: null }).eq('id', factura.id)
    if (err) throw new Error(err.message)
    await cargar()
  }

  const eliminarFactura = async (factura: ManualFactura) => {
    const { error: err } = await supabase.from('facturas_manuales').delete().eq('id', factura.id)
    if (err) throw new Error(err.message)
    await cargar()
  }

  const reasignarEjecutivo = async (sociedad: SociedadKey, cliente: string, nuevoEjecutivo: string) => {
    const { error: err } = await supabase.from('facturas_manuales').update({ ejecutivo: nuevoEjecutivo }).eq('sociedad', sociedad).eq('cliente', cliente)
    if (err) throw new Error(err.message)
    await cargar()
  }

  return {
    loading, error, refetch: cargar,
    facturas, historial, execsConocidos, clientesConocidos,
    guardarFactura, marcarCobrada, deshacerCobro, eliminarFactura, reasignarEjecutivo,
  }
}
