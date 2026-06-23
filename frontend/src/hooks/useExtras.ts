import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type Extra = {
  comprobante: string
  descripcion: string
  centro_costo: string
  tipo_servicio: string
  oc_hes_pedido: string
  colaborador: string
  otros_conceptos: string
  condicion_override: string
  periodo: string
  nota: string
}

const BLANK_EXTRA = (comp: string): Extra => ({
  comprobante: comp, descripcion: '', centro_costo: '', tipo_servicio: '',
  oc_hes_pedido: '', colaborador: '', otros_conceptos: '',
  condicion_override: '', periodo: '', nota: '',
})

function mergeText(actual: string, nuevo: string) {
  const limpio = nuevo.trim()
  if (!limpio) return actual
  const partes = actual.split(' | ').map(p => p.trim()).filter(Boolean)
  return partes.includes(limpio) ? actual : [...partes, limpio].join(' | ')
}

function dedupeExtras(rows: Extra[]) {
  const map = new Map<string, Extra>()
  for (const row of rows) {
    const prev = map.get(row.comprobante)
    if (!prev) {
      map.set(row.comprobante, row)
      continue
    }
    map.set(row.comprobante, {
      ...prev,
      descripcion: mergeText(prev.descripcion, row.descripcion),
      centro_costo: mergeText(prev.centro_costo, row.centro_costo),
      tipo_servicio: mergeText(prev.tipo_servicio, row.tipo_servicio),
      oc_hes_pedido: mergeText(prev.oc_hes_pedido, row.oc_hes_pedido),
      colaborador: mergeText(prev.colaborador, row.colaborador),
      otros_conceptos: mergeText(prev.otros_conceptos, row.otros_conceptos),
      condicion_override: prev.condicion_override || row.condicion_override,
      periodo: mergeText(prev.periodo, row.periodo),
      nota: mergeText(prev.nota, row.nota),
    })
  }
  return Array.from(map.values())
}

export function useExtras() {
  const [extras, setExtras] = useState<Map<string, Extra>>(new Map())

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('comprobante_extras').select('*')
      if (error) { console.warn('comprobante_extras:', error.message); return }
      const map = new Map<string, Extra>()
      for (const row of data ?? []) map.set(row.comprobante, row as Extra)
      setExtras(map)
    } catch (err) {
      console.warn('useExtras load error:', err)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const updateExtra = async (comprobante: string, fields: Record<string, string>) => {
    await supabase
      .from('comprobante_extras')
      .upsert({ comprobante, ...fields }, { onConflict: 'comprobante' })
    setExtras(prev => {
      const next = new Map(prev)
      next.set(comprobante, { ...(prev.get(comprobante) ?? BLANK_EXTRA(comprobante)), ...fields })
      return next
    })
  }

  const batchUpsert = async (rows: Extra[]) => {
    if (!rows.length) return
    const sinRepetidos = dedupeExtras(rows)
    const { error } = await supabase.from('comprobante_extras').upsert(sinRepetidos, { onConflict: 'comprobante' })
    if (error) throw new Error(error.message)
    await load()
  }

  return { extras, updateExtra, batchUpsert }
}
