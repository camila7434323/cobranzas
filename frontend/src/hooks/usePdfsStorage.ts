import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const BUCKET = 'facturas-pdf'
const STORAGE_BASE = import.meta.env.VITE_SUPABASE_STORAGE_URL as string

export type PdfMatch = { nombre: string; url: string }

function normalizarCodigo(s: string): string {
  return String(s || '').replace(/\s+/g, '').toUpperCase()
}

// El nombre del archivo puede traer sufijos extra (ej: "-DIRETV") pegados
// al código de comprobante, así que alcanza con que el archivo empiece
// con el código normalizado (sin espacios) seguido de fin de string o "-"/"_".
function coincide(codigo: string, nombreBase: string): boolean {
  if (!codigo || !nombreBase.startsWith(codigo)) return false
  const resto = nombreBase.slice(codigo.length)
  return resto === '' || resto.startsWith('-') || resto.startsWith('_')
}

export function usePdfsStorage() {
  const [archivos, setArchivos] = useState<{ nombre: string; codigo: string; url: string }[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
    if (!error && data) {
      setArchivos(
        data
          .filter(f => f.name.toLowerCase().endsWith('.pdf'))
          .map(f => ({
            nombre: f.name,
            codigo: normalizarCodigo(f.name.replace(/\.pdf$/i, '')),
            url: `${STORAGE_BASE}/${encodeURIComponent(f.name)}`,
          }))
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const buscarPdf = useCallback((comprobante: string): PdfMatch | null => {
    const codigo = normalizarCodigo(comprobante)
    if (!codigo) return null
    const match = archivos.find(a => coincide(codigo, a.codigo))
    return match ? { nombre: match.nombre, url: match.url } : null
  }, [archivos])

  return { loading, buscarPdf, refetch: cargar }
}
