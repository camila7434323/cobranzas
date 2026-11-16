// Lectura del Excel de facturación y reemplazo de líneas en Supabase.
// Lo usan el botón "Cargar Excel" (navegador) y la sincronización diaria
// desde OneDrive (api/facturacion/sincronizar.ts), así ambos aplican las
// mismas reglas. No importa xlsx ni el cliente de Supabase directamente:
// cada lado pasa los suyos.
import type * as XLSXTipos from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'

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

export type LineaNueva = Omit<FacturacionLinea, 'id' | 'creado_el'>

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

function toIsoDate(XLSX: typeof XLSXTipos, v: any): string | null {
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

// Convierte el Excel (primera hoja) en líneas listas para insertar.
export function parsearFacturacionExcel(XLSX: typeof XLSXTipos, buffer: ArrayBuffer | Uint8Array): LineaNueva[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
  if (raw.length === 0) throw new Error('El Excel está vacío.')

  // Excel guarda el valor de una celda combinada solo en la celda superior-izquierda;
  // el resto queda null. Sin esto, columnas como Colaborador quedan vacías en las
  // filas que comparten una combinación (ej. varias líneas de una misma factura).
  for (const m of sheet['!merges'] || []) {
    const val = raw[m.s.r]?.[m.s.c]
    if (val == null) continue
    for (let r = m.s.r; r <= m.e.r; r++) {
      if (!raw[r]) raw[r] = []
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (raw[r][c] == null) raw[r][c] = val
      }
    }
  }

  const idx = buildHeaderIndex(raw[0])
  if (idx.cliente === undefined || idx.totalNeto === undefined) {
    throw new Error('No se reconocieron las columnas esperadas (Razón social cliente / Total neto).')
  }

  const filas: LineaNueva[] = []
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
      periodo: idx.svs !== undefined ? toIsoDate(XLSX, r[idx.svs]) : null,
      oc: idx.oc !== undefined ? texto(r[idx.oc]) : '',
      leyenda: idx.leyenda !== undefined ? texto(r[idx.leyenda]) : '',
      moneda: idx.mon !== undefined ? (texto(r[idx.mon]) || 'ARS') : 'ARS',
      cantidad: idx.cant !== undefined ? numero(r[idx.cant]) : 0,
      precio_unitario: idx.precioUnitario !== undefined ? numero(r[idx.precioUnitario]) : 0,
      total_neto: numero(r[idx.totalNeto]),
      fecha_factura: idx.fechaFactura !== undefined ? toIsoDate(XLSX, r[idx.fechaFactura]) : null,
      n_factura: idx.nFactura !== undefined ? texto(r[idx.nFactura]) : '',
      cond_venta: idx.condVenta !== undefined ? texto(r[idx.condVenta]) : '',
      articulo_codigo: idx.art !== undefined ? texto(r[idx.art]) : '',
      articulo_descripcion: idx.descArticulo !== undefined ? texto(r[idx.descArticulo]) : '',
      cc_descripcion: idx.ccDescripcion !== undefined ? texto(r[idx.ccDescripcion]) : '',
      reporte_id: null,
    })
  }
  if (filas.length === 0) throw new Error('No se encontraron filas válidas en el archivo.')
  return filas
}

export const PAGE_SIZE = 1000

// Corre `fn` sobre los trozos de `items` en tandas paralelas (hasta
// `concurrencia` requests a la vez) en lugar de una por una.
async function enTandas<T>(items: T[], tam: number, fn: (trozo: T[]) => Promise<void>, concurrencia = 6) {
  const trozos: T[][] = []
  for (let i = 0; i < items.length; i += tam) trozos.push(items.slice(i, i + tam))
  for (let i = 0; i < trozos.length; i += concurrencia) {
    await Promise.all(trozos.slice(i, i + concurrencia).map(fn))
  }
}

export async function reemplazarLineas(supabase: SupabaseClient, filas: LineaNueva[]) {
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

  // Además, el Excel reemplaza todo lo que había para cada empresa dentro del
  // rango de fechas que cubre. Así una factura anulada y rehecha con otro
  // número (que ya no viene en el Excel) no queda colgada de una carga vieja.
  const rangoPorEmpresa = new Map<string, { desde: string; hasta: string }>()
  for (const f of filas) {
    if (!f.fecha_factura) continue
    const r = rangoPorEmpresa.get(f.empresa)
    if (!r) rangoPorEmpresa.set(f.empresa, { desde: f.fecha_factura, hasta: f.fecha_factura })
    else {
      if (f.fecha_factura < r.desde) r.desde = f.fecha_factura
      if (f.fecha_factura > r.hasta) r.hasta = f.fecha_factura
    }
  }
  for (const [empresa, { desde, hasta }] of rangoPorEmpresa) {
    const { error } = await supabase
      .from('facturacion_lineas')
      .delete()
      .eq('empresa', empresa)
      .gte('fecha_factura', desde)
      .lte('fecha_factura', hasta)
    if (error) throw error
  }

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
}
