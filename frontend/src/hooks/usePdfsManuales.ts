import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Candidata = { id: string; comprobante: string; pdf_url: string | null; pdf_nombre: string | null }

// Compara comprobantes ignorando mayúsculas, espacios, guiones y ceros a la izquierda
// ("INV-0012" == "inv 12"), porque las facturas del exterior no siguen el formato argentino.
export const claveComprobante = (s: string | null | undefined) =>
  String(s || '')
    .toUpperCase()
    .replace(/\.PDF$/, '')
    .replace(/(^|[^0-9])0+(?=[0-9])/g, '$1')
    .replace(/[^A-Z0-9]/g, '')

function dataUrlABlobUrl(dataUrl: string): string | null {
  try {
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
    const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] || 'application/pdf'
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return URL.createObjectURL(new Blob([bytes], { type: mime }))
  } catch {
    return null
  }
}

// PDFs de las facturas del exterior (LLC / SL): viven en `facturas_manuales`, no en el
// bucket. Se listan solo id + comprobante (liviano) y el PDF se baja recién al abrirlo.
export function usePdfsManuales() {
  const [filas, setFilas] = useState<Candidata[]>([])

  useEffect(() => {
    let activo = true
    supabase.from('facturas_manuales').select('id, comprobante, pdf_url, pdf_nombre')
      .then(({ data }) => { if (activo) setFilas((data as Candidata[]) || []) })
    return () => { activo = false }
  }, [])

  const buscarPdfManual = useCallback(async (comprobante: string): Promise<string | null> => {
    const clave = claveComprobante(comprobante)
    if (!clave) return null
    const tienePdf = (f: Candidata) => Number(!!(f.pdf_url || f.pdf_nombre))
    const candidatas = filas.filter(f => claveComprobante(f.comprobante) === clave).sort((a, b) => tienePdf(b) - tienePdf(a))
    for (const c of candidatas) {
      const { data } = await supabase.from('facturas_manuales').select('pdf_url, pdf_base64').eq('id', c.id).single()
      if (data?.pdf_url) return data.pdf_url
      if (data?.pdf_base64) {
        const url = dataUrlABlobUrl(data.pdf_base64)
        if (url) return url
      }
    }
    return null
  }, [filas])

  return { buscarPdfManual }
}
