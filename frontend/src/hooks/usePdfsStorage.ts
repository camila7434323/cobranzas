import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const BUCKET = 'facturas-pdf'
const STORAGE_BASE = import.meta.env.VITE_SUPABASE_STORAGE_URL as string

export type PdfMatch = { nombre: string; url: string }

function normalizarCodigo(s: string): string {
  return String(s || '')
    .replace(/\.pdf$/i, '')
    .replace(/\s+/g, '')
    .replace(/_/g, '-')
    .toUpperCase()
}

function variantesCodigo(s: string): string[] {
  const base = normalizarCodigo(s)
  if (!base) return []

  const variantes = new Set<string>([base])
  const prefijosEquivalentes = [
    ['FCM', 'FC'],
    ['FC', 'FCM'],
    ['NCM', 'NC'],
    ['NC', 'NCM'],
    ['NDM', 'ND'],
    ['ND', 'NDM'],
  ] as const

  const agregarVariantes = (codigo: string) => {
    for (const [desde, hacia] of prefijosEquivalentes) {
      if (codigo.startsWith(desde)) variantes.add(hacia + codigo.slice(desde.length))
    }

    const partes = codigo.match(/^(FCM?|NCM?|NDM?|CG|CIB|CR|RC|RS)([A-Z])?(\d{4,5}-\d+)/)
    if (partes) {
      const [, prefijo, letra, numero] = partes
      variantes.add(`${prefijo}${numero}`)
      for (const letraFiscal of ['A', 'B', 'C']) variantes.add(`${prefijo}${letraFiscal}${numero}`)
      if (letra) variantes.add(`${prefijo}${letra}${numero}`)
    }
  }

  for (const variante of Array.from(variantes)) agregarVariantes(variante)
  return Array.from(variantes)
}

function codigoDesdeNombreArchivo(nombre: string): string {
  const limpio = normalizarCodigo(nombre)
  // sin ^: el código puede no estar al inicio del nombre (prefijos de fecha, "COPIA-", etc.)
  const match = limpio.match(/(FCM?|NCM?|NDM?|CG|CIB|CR|RC|RS)[A-Z]?\d{4,5}-\d+/)
  return match?.[0] || limpio
}

export function usePdfsStorage() {
  const [archivos, setArchivos] = useState<{ nombre: string; codigos: string[]; url: string }[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const todos: { name: string }[] = []
    let offset = 0
    let errorCarga = false

    while (true) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list('', { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })

      if (error) {
        errorCarga = true
        break
      }

      const lote = data || []
      todos.push(...lote)
      if (lote.length < 1000) break
      offset += 1000
    }

    if (!errorCarga) {
      setArchivos(
        todos
          .filter(f => f.name.toLowerCase().endsWith('.pdf'))
          .map(f => ({
            nombre: f.name,
            codigos: variantesCodigo(codigoDesdeNombreArchivo(f.name)),
            url: `${STORAGE_BASE}/${encodeURIComponent(f.name)}`,
          }))
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const buscarPdf = useCallback((comprobante: string): PdfMatch | null => {
    const codigos = variantesCodigo(comprobante)
    if (!codigos.length) return null
    const match = archivos.find(a => codigos.some(codigo => a.codigos.includes(codigo)))
    return match ? { nombre: match.nombre, url: match.url } : null
  }, [archivos])

  return { loading, buscarPdf, refetch: cargar }
}
