import { useRef, useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import { supabase } from '../../lib/supabase'
import { parsearFacturacionExcel, type LineaNueva } from '../lib/facturacionExcel'

interface Props {
  insertarLote: (filas: LineaNueva[]) => Promise<void>
  compact?: boolean
}

export function SubirFacturacionExcel({ insertarLote, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  const procesar = async (archivo: File) => {
    setCargando(true)
    setError('')
    setExito('')
    try {
      const filas = parsearFacturacionExcel(XLSX, await archivo.arrayBuffer())

      const { data: reporte, error: repError } = await supabase
        .from('facturacion_reportes')
        .insert({ nombre_archivo: archivo.name, subido_por: 'usuario@asap.com', filas_importadas: filas.length })
        .select()
        .single()
      if (repError) throw repError

      await insertarLote(filas.map(f => ({ ...f, reporte_id: reporte?.id ?? null })))
      setExito(`${filas.length} líneas cargadas correctamente.`)
    } catch (err: any) {
      setError(err?.message || 'Error al procesar el archivo.')
    } finally {
      setCargando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  if (compact) {
    return (
      <div style={{ display: 'grid', gap: '8px' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: cargando ? '#6b7a99' : '#0ea5e9', color: '#fff', padding: '11px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 800, cursor: cargando ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
          {cargando ? 'Procesando...' : '↓ Cargar Excel'}
          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx"
            onChange={e => { const f = e.target.files?.[0]; if (f) procesar(f) }}
            disabled={cargando}
            style={{ display: 'none' }}
          />
        </label>
        {error && <div style={{ color: '#fecaca', fontSize: '11px', lineHeight: 1.35 }}>{error}</div>}
        {exito && <div style={{ color: '#34d399', fontSize: '11px', lineHeight: 1.35 }}>{exito}</div>}
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #d9e2f1', borderRadius: '10px', padding: '16px 20px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(38,63,101,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#1f2a44', marginBottom: '2px' }}>Cargar Excel de facturación</div>
          <div style={{ fontSize: '12px', color: '#6b7a99' }}>Subí el desglose de facturación — las líneas quedan guardadas para futuras sesiones</div>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: cargando ? '#6b7a99' : '#0e7490', color: '#fff', padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: cargando ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
          {cargando ? 'Procesando...' : '↑ Cargar Excel'}
          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx"
            onChange={e => { const f = e.target.files?.[0]; if (f) procesar(f) }}
            disabled={cargando}
            style={{ display: 'none' }}
          />
        </label>
      </div>
      {error && <div style={{ color: '#dc2626', marginTop: '10px', fontSize: '13px', fontWeight: 500 }}>⚠️ {error}</div>}
      {exito && <div style={{ color: '#059669', marginTop: '10px', fontSize: '13px', fontWeight: 500 }}>✓ {exito}</div>}
    </div>
  )
}
