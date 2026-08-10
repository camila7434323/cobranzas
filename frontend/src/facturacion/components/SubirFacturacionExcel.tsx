import { useRef, useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import { supabase } from '../../lib/supabase'
import type { FacturacionLinea } from '../hooks/useFacturacionLineas'

const HEADER_MAP: Record<string, string[]> = {
  desde: ['desde'],
  cliente: ['razón social cliente', 'razon social cliente'],
  cuit: ['cuit'],
  ejecutivo: ['ejecutivo comercial'],
  legajo: ['legajo'],
  colaborador: ['colaborador'],
  otrosConceptos: ['otros conceptos/proyectos'],
  svs: ['svs.', 'svs'],
  oc: ['oc'],
  leyenda: ['leyenda en factura'],
  mon: ['mon.', 'mon'],
  cant: ['cant.', 'cant'],
  precioUnitario: ['precio unitario'],
  totalNeto: ['total neto'],
  fechaFactura: ['fecha factura'],
  nFactura: ['n° factura', 'nº factura', 'n factura'],
  condVenta: ['cond. venta', 'cond venta'],
  art: ['art.', 'art'],
  descArticulo: ['descripción articulo', 'descripcion articulo', 'descripción artículo'],
  ccDescripcion: ['cc descripción', 'cc descripcion'],
}

function norm(s: any): string {
  return (s ?? '').toString().trim().toLowerCase()
}

function buildHeaderIndex(headerRow: any[]): Record<string, number> {
  const idx: Record<string, number> = {}
  headerRow.forEach((h, i) => {
    const n = norm(h)
    for (const key in HEADER_MAP) { if (HEADER_MAP[key].includes(n)) idx[key] = i }
  })
  return idx
}

function toIsoDate(v: any): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (!d) return null
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = v.toString().trim()
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (dmy) {
    const [, dd, mm, yy] = dmy
    const year = yy.length === 2 ? Number(yy) + 2000 : Number(yy)
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (ymd) {
    const [, yy, mm, dd] = ymd
    return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  return null
}

function texto(v: any): string {
  return v == null ? '' : v.toString().trim()
}

function numero(v: any): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = texto(v)
  if (!s) return 0
  const normalizado = s
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : 0
}

interface Props {
  insertarLote: (filas: Omit<FacturacionLinea, 'id' | 'creado_el'>[]) => Promise<void>
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
      const buffer = await archivo.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
      if (raw.length === 0) throw new Error('El Excel está vacío.')

      const idx = buildHeaderIndex(raw[0])
      if (idx.cliente === undefined || idx.totalNeto === undefined) {
        throw new Error('No se reconocieron las columnas esperadas (Razón social cliente / Total neto).')
      }

      const filas: Omit<FacturacionLinea, 'id' | 'creado_el'>[] = []
      for (let i = 1; i < raw.length; i++) {
        const r = raw[i]
        if (!r || r[idx.cliente] == null) continue
        filas.push({
          empresa: idx.desde !== undefined ? texto(r[idx.desde]) : '',
          cliente: texto(r[idx.cliente]),
          cuit: idx.cuit !== undefined ? texto(r[idx.cuit]) : '',
          ejecutivo: idx.ejecutivo !== undefined ? texto(r[idx.ejecutivo]) : '',
          legajo: idx.legajo !== undefined ? texto(r[idx.legajo]) : '',
          colaborador: idx.colaborador !== undefined ? texto(r[idx.colaborador]) : '',
          otros_conceptos: idx.otrosConceptos !== undefined ? texto(r[idx.otrosConceptos]) : '',
          periodo: idx.svs !== undefined ? toIsoDate(r[idx.svs]) : null,
          oc: idx.oc !== undefined ? texto(r[idx.oc]) : '',
          leyenda: idx.leyenda !== undefined ? texto(r[idx.leyenda]) : '',
          moneda: idx.mon !== undefined ? (texto(r[idx.mon]) || 'ARS') : 'ARS',
          cantidad: idx.cant !== undefined ? numero(r[idx.cant]) : 0,
          precio_unitario: idx.precioUnitario !== undefined ? numero(r[idx.precioUnitario]) : 0,
          total_neto: numero(r[idx.totalNeto]),
          fecha_factura: idx.fechaFactura !== undefined ? toIsoDate(r[idx.fechaFactura]) : null,
          n_factura: idx.nFactura !== undefined ? texto(r[idx.nFactura]) : '',
          cond_venta: idx.condVenta !== undefined ? texto(r[idx.condVenta]) : '',
          articulo_codigo: idx.art !== undefined ? texto(r[idx.art]) : '',
          articulo_descripcion: idx.descArticulo !== undefined ? texto(r[idx.descArticulo]) : '',
          cc_descripcion: idx.ccDescripcion !== undefined ? texto(r[idx.ccDescripcion]) : '',
          reporte_id: null,
        })
      }
      if (filas.length === 0) throw new Error('No se encontraron filas válidas en el archivo.')

      const { data: reportesPrevios, error: prevError } = await supabase
        .from('facturacion_reportes')
        .select('id')
        .eq('nombre_archivo', archivo.name)
      if (prevError) throw prevError

      const idsPrevios = (reportesPrevios || []).map(r => r.id).filter(Boolean)
      if (idsPrevios.length > 0) {
        const { error: lineasError } = await supabase
          .from('facturacion_lineas')
          .delete()
          .in('reporte_id', idsPrevios)
        if (lineasError) throw lineasError

        const { error: reportesError } = await supabase
          .from('facturacion_reportes')
          .delete()
          .in('id', idsPrevios)
        if (reportesError) throw reportesError
      }

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
        <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: cargando ? '#7a8fbb' : '#0ea5e9', color: '#fff', padding: '11px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 800, cursor: cargando ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
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
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0d1b38', marginBottom: '2px' }}>Cargar Excel de facturación</div>
          <div style={{ fontSize: '12px', color: '#7a8fbb' }}>Subí el desglose de facturación — las líneas quedan guardadas para futuras sesiones</div>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: cargando ? '#7a8fbb' : '#0e7490', color: '#fff', padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: cargando ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
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
