import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useFacturacionLineas, type FacturacionLinea } from './hooks/useFacturacionLineas'
import { SubirFacturacionExcel } from './components/SubirFacturacionExcel'

type Vista = 'dashboard' | 'detalle'
type Modo = 'compania' | 'cliente' | 'cc'

const PALETTE = ['#1ba9e5', '#38bdf8', '#72c8ee', '#147c91', '#a7b7ff', '#b9a7f5', '#80e0a0', '#f5c84b', '#f99aaa', '#cbd5e1', '#55dfc9']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const periodoKey = (r: FacturacionLinea) => (r.periodo || r.fecha_factura || '').slice(0, 7)
const monedaFila = (r: FacturacionLinea) => (r.moneda || 'ARS').toUpperCase()
const nombreCliente = (r: FacturacionLinea) => r.cliente || 'Sin cliente'
const nombreCc = (r: FacturacionLinea) => r.cc_descripcion || 'Sin CC'

const fmtMoney = (n: number, moneda: string) => {
  const value = n.toLocaleString(moneda === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (moneda === 'EUR') return `${value} €`
  return moneda === 'USD' ? `$${value}` : `$ ${value}`
}

const fmtShort = (n: number, moneda: string) => {
  if (moneda === 'ARS') return `${(n / 1000000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  return `${(n / 1000).toLocaleString(moneda === 'USD' ? 'en-US' : 'es-AR', { maximumFractionDigits: 1 })} mil`
}

const fmtFecha = (v: string | null) => {
  if (!v) return '-'
  const [y, m, d] = v.split('-')
  return `${d}/${m}/${y}`
}

const mesLabel = (key: string) => {
  const [y, m] = key.split('-')
  return `${MESES[Number(m) - 1] || m} ${y}`
}

const mesCorto = (key: string) => {
  const [y, m] = key.split('-')
  return `${MESES_CORTOS[Number(m) - 1] || m} ${String(y).slice(2)}`
}

const groupSum = (rows: FacturacionLinea[], key: (r: FacturacionLinea) => string) => {
  const map = new Map<string, number>()
  rows.forEach(r => map.set(key(r), (map.get(key(r)) || 0) + r.total_neto))
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
}

const flagCode = (moneda: string) => moneda === 'USD' ? 'us' : moneda === 'EUR' ? 'es' : 'ar'

const EXEC_PALETTE = [
  { bg: '#ddeafd', text: '#1d4170', bd: '#a8c4f5' },
  { bg: '#d1fae5', text: '#065f46', bd: '#6ee7b7' },
  { bg: '#fef3c7', text: '#92400e', bd: '#fcd34d' },
  { bg: '#ede9fe', text: '#4c1d95', bd: '#c4b5fd' },
  { bg: '#ccfbf1', text: '#0f766e', bd: '#5eead4' },
  { bg: '#cffafe', text: '#155e75', bd: '#67e8f9' },
  { bg: '#fce7f3', text: '#9d174d', bd: '#f9a8d4' },
  { bg: '#e0e7ff', text: '#3730a3', bd: '#a5b4fc' },
  { bg: '#dcfce7', text: '#166534', bd: '#86efac' },
  { bg: '#ffedd5', text: '#9a3412', bd: '#fdba74' },
]

const execColor = (name: string) => {
  let hash = 0
  const str = name || '·'
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return EXEC_PALETTE[Math.abs(hash) % EXEC_PALETTE.length]
}

const estilizarComoTabla = (ws: XLSX.WorkSheet, numRows: number, numCols: number) => {
  const thinBorder = { style: 'thin', color: { rgb: 'DDE3F0' } }
  for (let ci = 0; ci < numCols; ci++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: ci })]
    if (!cell) continue
    cell.s = {
      fill: { patternType: 'solid', fgColor: { rgb: '1D4170' } },
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
    }
  }
  for (let ri = 1; ri <= numRows; ri++) {
    for (let ci = 0; ci < numCols; ci++) {
      const cell = ws[XLSX.utils.encode_cell({ r: ri, c: ci })]
      if (!cell) continue
      cell.s = {
        fill: { patternType: 'solid', fgColor: { rgb: ri % 2 ? 'F8FAFF' : 'FFFFFF' } },
        font: { color: { rgb: '0F172A' }, sz: 10 },
        border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
      }
    }
  }
  ws['!cols'] = Array.from({ length: numCols }, (_, ci) => {
    let max = 10
    for (let ri = 0; ri <= numRows; ri++) {
      const cell = ws[XLSX.utils.encode_cell({ r: ri, c: ci })]
      if (cell) max = Math.max(max, String(cell.v ?? '').length)
    }
    return { wch: Math.min(40, max + 2) }
  })
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: numRows, c: Math.max(numCols - 1, 0) } }) }
}

const exportXlsx = (filename: string, rows: Array<Array<string | number>>) => {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  estilizarComoTabla(ws, rows.length - 1, rows[0]?.length || 0)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')
  XLSX.writeFile(wb, filename)
}

export function FacturacionApp({ session, onCambiarModulo }: { session: Session; onCambiarModulo: () => void }) {
  const { data, loading, error, insertarLote } = useFacturacionLineas()
  const [vista, setVista] = useState<Vista>('dashboard')
  const [empresaActiva, setEmpresaActiva] = useState('all')
  const [busqueda, setBusqueda] = useState('')
  const [modo, setModo] = useState<Modo>('compania')
  const [anio, setAnio] = useState('2026')
  const [mes, setMes] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroCc, setFiltroCc] = useState('')

  const empresas = useMemo(() => {
    const map = new Map<string, { nombre: string; moneda: string }>()
    data.forEach(r => {
      if (!r.empresa || map.has(r.empresa)) return
      const moneda = groupSum(data.filter(x => x.empresa === r.empresa), monedaFila)[0]?.[0] || 'ARS'
      map.set(r.empresa, { nombre: r.empresa, moneda })
    })
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [data])

  const anios = useMemo(() => {
    const set = new Set(data.map(periodoKey).filter(Boolean).map(k => k.slice(0, 4)))
    return Array.from(set).sort()
  }, [data])
  const anioActivo = anio === 'all' ? 'all' : anios.includes(anio) ? anio : (anios[anios.length - 1] || 'all')

  const dashboardRows = useMemo(() => data.filter(r => {
    const key = periodoKey(r)
    if (empresaActiva !== 'all' && r.empresa !== empresaActiva) return false
    if (anioActivo !== 'all' && key.slice(0, 4) !== anioActivo) return false
    if (mes && key !== mes) return false
    if (modo === 'cliente' && filtroCliente && nombreCliente(r) !== filtroCliente) return false
    if (modo === 'cc' && filtroCc && nombreCc(r) !== filtroCc) return false
    return true
  }), [data, empresaActiva, anioActivo, mes, modo, filtroCliente, filtroCc])

  const mesesDisponibles = useMemo(() => {
    const set = new Set(data.filter(r => empresaActiva === 'all' || r.empresa === empresaActiva).map(periodoKey).filter(Boolean))
    return Array.from(set).filter(k => anioActivo === 'all' || k.startsWith(anioActivo)).sort()
  }, [data, empresaActiva, anioActivo])

  const clientesDisponibles = useMemo(() => groupSum(dashboardRows, nombreCliente).map(([k]) => k), [dashboardRows])
  const ccDisponibles = useMemo(() => groupSum(dashboardRows, nombreCc).map(([k]) => k), [dashboardRows])

  const rowsEmpresa = useMemo(
    () => empresaActiva === 'all' ? data : data.filter(r => r.empresa === empresaActiva),
    [data, empresaActiva]
  )
  const filas = useMemo(() => {
    if (!busqueda.trim()) return rowsEmpresa
    const q = busqueda.toLowerCase()
    return rowsEmpresa.filter(r =>
      [r.cliente, r.cuit, r.ejecutivo, r.n_factura, r.cc_descripcion, r.empresa].some(v => String(v || '').toLowerCase().includes(q))
    )
  }, [rowsEmpresa, busqueda])

  const abrirDashboard = () => {
    setVista('dashboard')
    setEmpresaActiva('all')
    window.scrollTo({ top: 0 })
  }

  const irEmpresa = (empresa: string) => {
    setEmpresaActiva(empresa)
    setVista('detalle')
    window.scrollTo({ top: 0 })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: '100vh', background: '#eaf7fd', color: '#0d1b38', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
      <aside className="scroll-sin-barra" style={{ background: '#0c2a3d', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', boxShadow: '2px 0 14px rgba(10,22,40,0.2)' }}>
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 34, height: 34, background: '#14a9e1', borderRadius: 9, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800 }}>F</div>
            <div>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>Facturación</div>
              <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 10, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', marginTop: 4 }}>ASAP Consulting</div>
            </div>
          </div>
        </div>

        <SideTitle>Vistas</SideTitle>
        <button onClick={abrirDashboard} style={navStyle(vista === 'dashboard')}>▥ <span>Panel de Ventas</span></button>
        <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '10px 20px' }} />
        <SideTitle>Compañías</SideTitle>
        <button onClick={() => irEmpresa('all')} style={navStyle(vista === 'detalle' && empresaActiva === 'all')}><span style={dot} /> Todas las compañías</button>
        {empresas.map(e => (
          <button key={e.nombre} onClick={() => irEmpresa(e.nombre)} style={navStyle(vista === 'detalle' && empresaActiva === e.nombre)}>
            <span className={`fi fi-${flagCode(e.moneda)}`} style={{ borderRadius: 2, flexShrink: 0 }} />
            <span>{e.nombre}</span>
          </button>
        ))}

        <div style={{ marginTop: 'auto', padding: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: 10 }}>
          <SubirFacturacionExcel insertarLote={insertarLote} compact />
          <div style={{ color: 'rgba(255,255,255,.42)', fontSize: 11, lineHeight: 1.35 }}>Facturación global por cliente, ejecutivo y período.</div>
          <button onClick={onCambiarModulo} style={sideButton}>Cambiar de app</button>
          <button onClick={() => supabase.auth.signOut()} style={sideButton}>Salir</button>
        </div>
      </aside>

      <section style={{ minWidth: 0 }}>
        <header style={{ height: 58, background: '#fff', borderBottom: '1px solid #d3eaf6', padding: '0 28px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 5px rgba(10,22,40,0.08)' }}>
          <span style={{ fontSize: 20, fontWeight: 800 }}>Facturación</span>
          <span style={{ color: '#7286bd', fontSize: 13 }}>· {empresaActiva === 'all' ? 'Todas las compañías' : empresaActiva}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: '#7a8fbb' }}>{session.user.email}</span>
        </header>

        <main style={{ padding: '22px 28px 36px', maxWidth: 1080 }}>
          {error && <div style={{ color: '#dc2626', marginBottom: 14, fontSize: 13 }}>⚠ {error}</div>}
          {loading ? <div style={emptyStyle}>Cargando facturación...</div> : data.length === 0 ? <div style={emptyStyle}>Sin datos aún. Cargá el Excel para empezar.</div> : vista === 'dashboard' ? (
            <PanelVentas
              rows={dashboardRows}
              empresas={empresas.map(e => e.nombre)}
              empresaActiva={empresaActiva}
              setEmpresaActiva={setEmpresaActiva}
              modo={modo}
              setModo={setModo}
              anios={anios}
              anio={anioActivo}
              setAnio={setAnio}
              meses={mesesDisponibles}
              mes={mes}
              setMes={setMes}
              clientes={clientesDisponibles}
              filtroCliente={filtroCliente}
              setFiltroCliente={setFiltroCliente}
              centrosCosto={ccDisponibles}
              filtroCc={filtroCc}
              setFiltroCc={setFiltroCc}
            />
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por cliente, CUIT, ejecutivo o factura..." style={inputStyle} />
              </div>
              <Detalle key={empresaActiva} filas={filas} empresaActiva={empresaActiva} />
            </>
          )}
        </main>
      </section>
    </div>
  )
}

function PanelVentas(props: {
  rows: FacturacionLinea[]
  empresas: string[]
  empresaActiva: string
  setEmpresaActiva: (v: string) => void
  modo: Modo
  setModo: (v: Modo) => void
  anios: string[]
  anio: string
  setAnio: (v: string) => void
  meses: string[]
  mes: string
  setMes: (v: string) => void
  clientes: string[]
  filtroCliente: string
  setFiltroCliente: (v: string) => void
  centrosCosto: string[]
  filtroCc: string
  setFiltroCc: (v: string) => void
}) {
  const rowsByMoneda = useMemo(() => {
    const map = new Map<string, FacturacionLinea[]>()
    props.rows.forEach(r => {
      const m = monedaFila(r)
      const list = map.get(m)
      if (list) list.push(r); else map.set(m, [r])
    })
    return map
  }, [props.rows])
  const monedas = useMemo(
    () => Array.from(rowsByMoneda.entries()).sort((a, b) => b[1].reduce((s, r) => s + r.total_neto, 0) - a[1].reduce((s, r) => s + r.total_neto, 0)).map(([m]) => m),
    [rowsByMoneda]
  )
  const ultimoMes = props.meses[props.meses.length - 1]

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Segmented>
        <Seg active={props.empresaActiva === 'all'} onClick={() => props.setEmpresaActiva('all')}>Todas</Seg>
        {props.empresas.map(e => <Seg key={e} active={props.empresaActiva === e} onClick={() => props.setEmpresaActiva(e)}>{e.toUpperCase()}</Seg>)}
      </Segmented>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Segmented>
          <Seg active={props.modo === 'compania'} onClick={() => props.setModo('compania')}>Toda la compañía</Seg>
          <Seg active={props.modo === 'cliente'} onClick={() => props.setModo('cliente')}>Ventas por cliente</Seg>
          <Seg active={props.modo === 'cc'} onClick={() => props.setModo('cc')}>Ventas por CC</Seg>
        </Segmented>
        <Segmented>
          {props.anios.map(y => <Seg key={y} active={props.anio === y} onClick={() => props.setAnio(y)}>{y}</Seg>)}
          <Seg active={props.anio === 'all'} onClick={() => props.setAnio('all')}>Todos los años</Seg>
        </Segmented>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <select value={props.mes} onChange={e => props.setMes(e.target.value)} style={selectStyle}>
          <option value="">Todos los meses</option>
          {props.meses.map(m => <option key={m} value={m}>{mesLabel(m)}</option>)}
        </select>
        {props.modo === 'cliente' && <select value={props.filtroCliente} onChange={e => props.setFiltroCliente(e.target.value)} style={selectStyle}><option value="">Elegí uno o más clientes</option>{props.clientes.map(c => <option key={c}>{c}</option>)}</select>}
        {props.modo === 'cc' && <select value={props.filtroCc} onChange={e => props.setFiltroCc(e.target.value)} style={selectStyle}><option value="">Elegí uno o más CC</option>{props.centrosCosto.map(c => <option key={c}>{c}</option>)}</select>}
      </div>

      <div style={{ color: '#7286bd', fontSize: 13 }}>▦ Análisis hasta <strong>{ultimoMes ? mesLabel(ultimoMes) : 'el último período cargado'}</strong> — se excluye el mes en curso por estar incompleto.</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
        {monedas.map(m => <Kpi key={m} label={`Facturación del ${props.anio === 'all' ? 'período' : props.anio} (${m})`} value={fmtMoney((rowsByMoneda.get(m) || []).reduce((s, r) => s + r.total_neto, 0), m)} />)}
      </div>

      {monedas.map(m => <MonedaSection key={m} rows={rowsByMoneda.get(m) || []} moneda={m} />)}
    </div>
  )
}

function MonedaSection({ rows, moneda }: { rows: FacturacionLinea[]; moneda: string }) {
  const clientes = groupSum(rows, nombreCliente)
  const total = clientes.reduce((s, [, v]) => s + v, 0)
  return (
      <div style={{ display: 'grid', gap: 16, marginTop: 2 }}>
      <LineCard rows={rows} moneda={moneda} />
      <ClientConcentration rows={rows} moneda={moneda} clientes={clientes} total={total} />
      <PieCard clientes={clientes} total={total} />
      <ClientMonthTable rows={rows} moneda={moneda} />
    </div>
  )
}

function LineCard({ rows, moneda }: { rows: FacturacionLinea[]; moneda: string }) {
  const monthly = groupSum(rows, periodoKey).filter(([k]) => k).sort((a, b) => a[0].localeCompare(b[0]))
  const max = Math.max(...monthly.map(([, v]) => v), 1)
  const points = monthly.map(([k, v], i) => {
    const x = monthly.length === 1 ? 60 : 60 + (i * 820) / (monthly.length - 1)
    const y = 230 - (v / max) * 180
    return { k, v, x, y }
  })
  const line = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')
  const area = points.length ? `${line} L ${points[points.length - 1].x} 230 L 60 230 Z` : ''
  const changes = points.slice(1).map((p, i) => ({ from: points[i], to: p, diff: p.v - points[i].v, pct: points[i].v ? ((p.v - points[i].v) / points[i].v) * 100 : 0 }))
  const subida = changes.sort((a, b) => b.diff - a.diff)[0]
  const baja = [...changes].sort((a, b) => a.diff - b.diff)[0]

  return (
    <Card>
      <CardTitle title="Evolución mensual" badge={moneda} />
      <svg viewBox="0 0 940 265" style={{ width: '100%', height: 265, display: 'block' }}>
        {[0, 1, 2, 3, 4].map(i => <line key={i} x1="60" x2="900" y1={230 - i * 45} y2={230 - i * 45} stroke="#d8ecf7" strokeDasharray="4 5" />)}
        {area && <path d={area} fill="#e5f6fd" />}
        {line && <path d={line} fill="none" stroke="#19a8e6" strokeWidth="3" />}
        {points.map(p => <g key={p.k}><circle cx={p.x} cy={p.y} r="4" fill="#19a8e6" stroke="#fff" strokeWidth="2" /><text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fill="#243d71" fontWeight="800">{fmtShort(p.v, moneda)}</text><text x={p.x} y="252" textAnchor="middle" fontSize="11" fill="#7286bd">{mesCorto(p.k)}</text></g>)}
      </svg>
      <div style={{ display: 'grid', gap: 8 }}>
        {subida && <Insight color="#22c55e" bg="#d8ffe8">📈 <strong>Mayor suba:</strong> {subida.pct.toFixed(0)}% de {mesLabel(subida.from.k)} a {mesLabel(subida.to.k)} ({fmtMoney(subida.from.v, moneda)} → {fmtMoney(subida.to.v, moneda)})</Insight>}
        {baja && <Insight color="#8b5cf6" bg="#efe9ff">📉 <strong>Mayor baja:</strong> {baja.pct.toFixed(0)}% de {mesLabel(baja.from.k)} a {mesLabel(baja.to.k)} ({fmtMoney(baja.from.v, moneda)} → {fmtMoney(baja.to.v, moneda)})</Insight>}
      </div>
    </Card>
  )
}

function ClientConcentration({ clientes, total, moneda }: { rows: FacturacionLinea[]; clientes: [string, number][]; total: number; moneda: string }) {
  const top = clientes.slice(0, 10)
  const main = clientes[0]
  const top3 = clientes.slice(0, 3).reduce((s, [, v]) => s + v, 0)
  return (
    <Card noPadding>
      <CardHeader><CardTitle title="Concentración de clientes" badge={moneda} /><button style={excelBtn} onClick={() => exportXlsx(`concentracion-clientes-${moneda}.xlsx`, [['#', 'Cliente', 'Facturación', '% del total'], ...clientes.map(([name, value], i) => [i + 1, name, value.toFixed(2), ((value / total) * 100).toFixed(1)])])}>↓ Excel</button></CardHeader>
      <div style={{ padding: 14 }}>
        {main && <div style={notice}>🔎 <strong>{main[0]}</strong> es tu cliente principal: representa el <strong>{((main[1] / total) * 100).toFixed(1)}%</strong> de la facturación. Entre los 3 principales concentran el <strong>{((top3 / total) * 100).toFixed(1)}%</strong>.</div>}
      </div>
      <table style={tableStyle}>
        <thead><tr><Th>#</Th><Th>Cliente</Th><Th right>Facturación</Th><Th right>% del total</Th></tr></thead>
        <tbody>{top.map(([name, value], i) => <tr key={name}><Td>{i + 1}</Td><Td>{name}</Td><Td right>{fmtMoney(value, moneda)}</Td><Td right><strong>{((value / total) * 100).toFixed(1)}%</strong></Td></tr>)}</tbody>
      </table>
      {clientes.length > 10 && <div style={{ textAlign: 'center', padding: 10, color: '#159fe2', fontWeight: 700, borderTop: '1px solid #d3eaf6' }}>▼ Ver los {clientes.length - 10} restantes</div>}
    </Card>
  )
}

function PieCard({ clientes, total }: { clientes: [string, number][]; total: number }) {
  const top = clientes.slice(0, 10)
  const otros = clientes.slice(10).reduce((s, [, v]) => s + v, 0)
  const items = otros > 0 ? [...top, [`Otros (${clientes.length - 10} clientes)`, otros] as [string, number]] : top
  const segs = items.reduce<{ acc: number; list: { name: string; value: number; color: string; d: string }[] }>(
    (state, [name, value], i) => {
      const start = state.acc / total
      const acc = state.acc + value
      const end = acc / total
      return { acc, list: [...state.list, { name, value, color: PALETTE[i % PALETTE.length], d: pieSlice(110, 110, 88, start, end) }] }
    },
    { acc: 0, list: [] }
  ).list
  return (
    <Card noPadding>
      <div style={{ padding: '14px 18px', fontSize: 15, fontWeight: 800, borderBottom: '1px solid #d3eaf6' }}>Distribución</div>
      <div style={{ display: 'grid', gridTemplateColumns: '205px 1fr', gap: 22, alignItems: 'center', padding: 20 }}>
        <svg viewBox="0 0 220 220" style={{ width: 200 }}>{segs.map(s => <path key={s.name} d={s.d} fill={s.color} />)}</svg>
        <div style={{ display: 'grid', gap: 8 }}>{segs.map(s => <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '14px 1fr auto', gap: 8, alignItems: 'center' }}><span style={{ width: 12, height: 12, borderRadius: 3, background: s.color }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#243d71' }}>{s.name}</span><strong>{((s.value / total) * 100).toFixed(1)}%</strong></div>)}</div>
      </div>
    </Card>
  )
}

function ClientMonthTable({ rows, moneda }: { rows: FacturacionLinea[]; moneda: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const months = useMemo(() => Array.from(new Set(rows.map(periodoKey).filter(Boolean))).sort(), [rows])
  const clients = useMemo(() => groupSum(rows, nombreCliente).slice(0, 16), [rows])

  // Una sola pasada sobre rows en vez de re-filtrar por cada celda cliente×mes×CC en cada render/click.
  const { monthTotals, ccMonthTotals, ccOrder, monthGrandTotal } = useMemo(() => {
    const monthTotals = new Map<string, Map<string, number>>()
    const ccMonthTotals = new Map<string, Map<string, Map<string, number>>>()
    const ccTotal = new Map<string, Map<string, number>>()
    const monthGrandTotal = new Map<string, number>()
    rows.forEach(r => {
      const client = nombreCliente(r)
      const month = periodoKey(r)
      const cc = nombreCc(r)
      const v = r.total_neto

      monthGrandTotal.set(month, (monthGrandTotal.get(month) || 0) + v)

      const cm = monthTotals.get(client) || new Map<string, number>()
      cm.set(month, (cm.get(month) || 0) + v)
      monthTotals.set(client, cm)

      const clientCcMap = ccMonthTotals.get(client) || new Map<string, Map<string, number>>()
      const cmMap = clientCcMap.get(cc) || new Map<string, number>()
      cmMap.set(month, (cmMap.get(month) || 0) + v)
      clientCcMap.set(cc, cmMap)
      ccMonthTotals.set(client, clientCcMap)

      const ct = ccTotal.get(client) || new Map<string, number>()
      ct.set(cc, (ct.get(cc) || 0) + v)
      ccTotal.set(client, ct)
    })
    const ccOrder = new Map<string, string[]>()
    ccTotal.forEach((map, client) => ccOrder.set(client, Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([c]) => c)))
    return { monthTotals, ccMonthTotals, ccOrder, monthGrandTotal }
  }, [rows])

  const sumFor = (client: string, month: string, cc?: string) =>
    (cc ? ccMonthTotals.get(client)?.get(cc) : monthTotals.get(client))?.get(month) || 0

  return (
    <Card noPadding>
      <CardHeader><CardTitle title="Clientes x mes" badge={moneda} /><span style={{ color: '#7286bd', fontSize: 12 }}>clic en un cliente para ver el desglose por CC</span><button style={excelBtn} onClick={() => exportXlsx(`clientes-por-mes-${moneda}.xlsx`, [['Cliente', ...months.map(mesCorto)], ...clients.map(([client]) => [client, ...months.map(m => sumFor(client, m).toFixed(2))])])}>↓ Excel</button></CardHeader>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ ...tableStyle, minWidth: 680 }}>
          <thead><tr><Th>Cliente</Th>{months.map(m => <Th key={m} right>{mesCorto(m)}</Th>)}</tr></thead>
          <tbody>
            {clients.map(([client]) => {
              const ccs = ccOrder.get(client) || []
              return (
                <Fragment key={client}>
                  <tr key={client} onClick={() => setOpen(o => ({ ...o, [client]: !o[client] }))} style={{ cursor: 'pointer' }}>
                    <Td><strong>{open[client] ? '⌄' : '›'} {client}</strong></Td>{months.map(m => { const v = sumFor(client, m); return <Td key={m} right><strong>{v ? fmtMoney(v, moneda) : '-'}</strong></Td> })}
                  </tr>
                  {open[client] && ccs.map(cc => <tr key={`${client}-${cc}`} style={{ background: '#f1fbff' }}><Td style={{ paddingLeft: 34, color: '#7286bd' }}>{cc}</Td>{months.map(m => { const v = sumFor(client, m, cc); return <Td key={m} right style={{ color: '#7286bd' }}>{v ? fmtMoney(v, moneda) : '-'}</Td> })}</tr>)}
                </Fragment>
              )
            })}
            <tr style={{ background: '#e8f8ff' }}><Td><strong>TOTAL GENERAL</strong></Td>{months.map(m => <Td key={m} right><strong>{fmtMoney(monthGrandTotal.get(m) || 0, moneda)}</strong></Td>)}</tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}

type SortCol = 'cliente' | 'ejecutivo' | 'periodo' | 'fecha' | 'nfactura' | 'cc' | 'total'

function Detalle({ filas, empresaActiva }: { filas: FacturacionLinea[]; empresaActiva: string }) {
  const [openRows, setOpenRows] = useState<Set<string>>(new Set())
  const [clientesSel, setClientesSel] = useState<string[]>([])
  const [ejecutivosSel, setEjecutivosSel] = useState<string[]>([])
  const [periodosSel, setPeriodosSel] = useState<string[]>([])
  const [ccsSel, setCcsSel] = useState<string[]>([])
  const [nFacturaText, setNFacturaText] = useState('')
  const [sort, setSort] = useState<{ col: SortCol | null; dir: 'asc' | 'desc' }>({ col: null, dir: 'asc' })

  const clientesOpts = useMemo(() => Array.from(new Set(filas.map(nombreCliente))).sort((a, b) => a.localeCompare(b)), [filas])
  const ejecutivosOpts = useMemo(() => Array.from(new Set(filas.map(r => r.ejecutivo).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [filas])
  const periodosOpts = useMemo(() => Array.from(new Set(filas.map(periodoKey).filter(Boolean))).sort(), [filas])

  const baseFiltered = useMemo(() => filas.filter(r => {
    if (clientesSel.length && !clientesSel.includes(nombreCliente(r))) return false
    if (ejecutivosSel.length && !ejecutivosSel.includes(r.ejecutivo || '')) return false
    if (periodosSel.length && !periodosSel.includes(periodoKey(r))) return false
    if (nFacturaText.trim() && !String(r.n_factura || '').toLowerCase().includes(nFacturaText.trim().toLowerCase())) return false
    return true
  }), [filas, clientesSel, ejecutivosSel, periodosSel, nFacturaText])

  const ccsOpts = useMemo(() => Array.from(new Set(baseFiltered.map(nombreCc))).sort((a, b) => a.localeCompare(b)), [baseFiltered])
  const ccFiltered = useMemo(() => baseFiltered.filter(r => !ccsSel.length || ccsSel.includes(nombreCc(r))), [baseFiltered, ccsSel])

  const sorted = useMemo(() => {
    if (!sort.col) return ccFiltered
    const dir = sort.dir === 'asc' ? 1 : -1
    const col = sort.col
    return [...ccFiltered].sort((a, b) => {
      switch (col) {
        case 'cliente': return dir * nombreCliente(a).localeCompare(nombreCliente(b))
        case 'ejecutivo': return dir * (a.ejecutivo || '').localeCompare(b.ejecutivo || '')
        case 'periodo': return dir * periodoKey(a).localeCompare(periodoKey(b))
        case 'fecha': return dir * String(a.fecha_factura || '').localeCompare(String(b.fecha_factura || ''))
        case 'nfactura': return dir * String(a.n_factura || '').localeCompare(String(b.n_factura || ''))
        case 'cc': return dir * nombreCc(a).localeCompare(nombreCc(b))
        case 'total': return dir * (a.total_neto - b.total_neto)
        default: return 0
      }
    })
  }, [ccFiltered, sort])

  const porMoneda = useMemo(() => {
    const map = new Map<string, number>()
    sorted.forEach(r => { const m = monedaFila(r); map.set(m, (map.get(m) || 0) + r.total_neto) })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [sorted])
  const clientesCount = useMemo(() => new Set(sorted.map(nombreCliente)).size, [sorted])
  const facturasCount = useMemo(() => new Set(sorted.map(r => r.n_factura).filter(Boolean)).size, [sorted])

  const toggleRow = (id: string) => setOpenRows(o => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const setSortCol = (col: SortCol) => setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  const sortArrow = (col: SortCol) => sort.col === col ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''
  const clearFilters = () => { setClientesSel([]); setEjecutivosSel([]); setPeriodosSel([]); setCcsSel([]); setNFacturaText('') }

  const kpiColors = ['#19a8e6', '#059669', '#d97706', '#7c3aed']

  return (
    <Card noPadding>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, padding: 14 }}>
        {porMoneda.map(([m, v]) => <Kpi key={m} label={`Total facturado (${m})`} value={fmtMoney(v, m)} color={kpiColors[0]} />)}
        <Kpi label="Clientes" value={String(clientesCount)} color={kpiColors[1]} />
        <Kpi label="Facturas" value={String(facturasCount)} color={kpiColors[2]} />
        <Kpi label="Líneas" value={String(sorted.length)} color={kpiColors[3]} />
      </div>
      <CardHeader>
        <strong>Detalle de facturación</strong>
        <span style={{ color: '#7286bd' }}>{sorted.length} línea{sorted.length === 1 ? '' : 's'}</span>
        <span style={{ marginLeft: 'auto' }} />
        <button style={excelBtn} onClick={() => exportXlsx('facturacion_detalle.xlsx', [
          ['Cliente', 'CUIT', 'Ejecutivo', 'Período', 'Fecha Factura', 'N° Factura', 'Cond. Venta', 'Colaborador', 'Legajo', 'CC Descripción', 'Moneda', 'Cantidad', 'Precio Unitario', 'Total Neto', 'OC', 'Leyenda'],
          ...sorted.map(r => [
            nombreCliente(r), r.cuit || '', r.ejecutivo || '', r.periodo ? mesLabel(periodoKey(r)) : '',
            fmtFecha(r.fecha_factura), r.n_factura || '', r.cond_venta || '', r.colaborador || '', r.legajo || '',
            nombreCc(r), monedaFila(r), r.cantidad || 0, r.precio_unitario.toFixed(2), r.total_neto.toFixed(2),
            r.oc || '', r.leyenda || '',
          ]),
        ])}>↓ Excel</button>
        <button style={clearBtn} onClick={clearFilters}>✕ Limpiar filtros</button>
      </CardHeader>
      {filas.length === 0 ? <div style={emptyStyle}>Sin datos para esta selección.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ ...tableStyle, minWidth: 980 }}>
            <thead>
              <tr>
                <Th></Th>
                <Th onClick={() => setSortCol('cliente')}>Cliente{sortArrow('cliente')}</Th>
                <Th onClick={() => setSortCol('ejecutivo')}>Ejecutivo{sortArrow('ejecutivo')}</Th>
                <Th onClick={() => setSortCol('periodo')}>Período{sortArrow('periodo')}</Th>
                <Th onClick={() => setSortCol('fecha')}>Fecha factura{sortArrow('fecha')}</Th>
                <Th onClick={() => setSortCol('nfactura')}>N° Factura{sortArrow('nfactura')}</Th>
                <Th onClick={() => setSortCol('cc')}>CC Descripción{sortArrow('cc')}</Th>
                <Th right onClick={() => setSortCol('total')}>Importe{sortArrow('total')}</Th>
                <Th>PDF</Th>
              </tr>
              <tr>
                <Th></Th>
                <Th><MultiSelect options={clientesOpts} selected={clientesSel} onChange={setClientesSel} placeholderAll="Todos" /></Th>
                <Th><MultiSelect options={ejecutivosOpts} selected={ejecutivosSel} onChange={setEjecutivosSel} placeholderAll="Todos" /></Th>
                <Th><MultiSelect options={periodosOpts} selected={periodosSel} onChange={setPeriodosSel} placeholderAll="Todos" formatLabel={mesLabel} /></Th>
                <Th></Th>
                <Th><input value={nFacturaText} onChange={e => setNFacturaText(e.target.value)} placeholder="Buscar..." style={filterInputStyle} /></Th>
                <Th><MultiSelect options={ccsOpts} selected={ccsSel} onChange={setCcsSel} placeholderAll="Todos" /></Th>
                <Th></Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#7286bd', fontSize: 13 }}>No se encontraron resultados con estos filtros</td></tr>
              ) : sorted.map(r => {
                const isOpen = openRows.has(r.id)
                const ec = execColor(r.ejecutivo || '')
                const moneda = monedaFila(r)
                return (
                  <Fragment key={r.id}>
                    <tr onClick={() => toggleRow(r.id)} style={{ cursor: 'pointer' }}>
                      <Td>{isOpen ? '⌄' : '›'}</Td>
                      <Td>
                        {empresaActiva === 'all' && <span className={`fi fi-${flagCode(moneda)}`} style={{ marginRight: 6, borderRadius: 2, verticalAlign: 'middle' }} />}
                        <strong>{nombreCliente(r)}</strong>
                        {r.cuit && <div style={{ fontSize: 10, color: '#7a8fbb', fontFamily: 'monospace', marginTop: 2 }}>{r.cuit}</div>}
                      </Td>
                      <Td>{r.ejecutivo ? <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: ec.bg, color: ec.text, border: `1px solid ${ec.bd}`, whiteSpace: 'nowrap' }}>{r.ejecutivo}</span> : '-'}</Td>
                      <Td>{r.periodo ? mesLabel(periodoKey(r)) : '-'}</Td>
                      <Td>{fmtFecha(r.fecha_factura)}</Td>
                      <Td>{r.n_factura || '-'}</Td>
                      <Td>{nombreCc(r)}</Td>
                      <Td right><strong>{fmtMoney(r.total_neto, moneda)}</strong></Td>
                      <Td style={{ cursor: 'default' }} onClickCapture={e => e.stopPropagation()}><button style={pdfBtnStyle} disabled>PDF Factura</button></Td>
                    </tr>
                    {isOpen && (
                      <tr style={{ background: '#f1fbff' }}>
                        <td colSpan={9} style={{ padding: '12px 16px 14px 34px', borderBottom: '1px solid #d3eaf6' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: '8px 20px' }}>
                            <DetailItem label="Legajo" value={r.legajo} />
                            <DetailItem label="Colaborador" value={r.colaborador} />
                            <DetailItem label="Otros conceptos / proyecto" value={r.otros_conceptos} />
                            <DetailItem label="Cond. de venta" value={r.cond_venta} />
                            <DetailItem label="OC" value={r.oc} />
                            <DetailItem label="Leyenda en factura" value={r.leyenda} />
                            <DetailItem label="Artículo" value={[r.articulo_codigo, r.articulo_descripcion].filter(Boolean).join(' · ')} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ fontSize: 11.5 }}>
      <div style={{ color: '#7286bd', textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 9.5, fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ color: '#243d71' }}>{value || '-'}</div>
    </div>
  )
}

function MultiSelect({ options, selected, onChange, placeholderAll, formatLabel }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; placeholderAll: string; formatLabel?: (v: string) => string }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const fmt = formatLabel || ((v: string) => v)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  let label = placeholderAll
  if (selected.length === 1) { const l = fmt(selected[0]); label = l.length > 16 ? l.slice(0, 15) + '…' : l }
  else if (selected.length > 1) label = `${selected.length} seleccionados`

  const visible = search ? options.filter(o => fmt(o).toLowerCase().includes(search.toLowerCase())) : options
  const toggle = (opt: string) => onChange(selected.includes(opt) ? selected.filter(v => v !== opt) : [...selected, opt])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={mselBtn}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: 8, color: '#7286bd' }}>▾</span>
      </button>
      {open && (
        <div style={mselPanel}>
          {options.length > 8 && <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={mselSearch} />}
          <div style={mselActions}>
            <span onClick={() => onChange(options)}>Todos</span>
            <span onClick={() => onChange([])}>Limpiar</span>
          </div>
          {visible.length === 0 ? <div style={{ padding: 6, fontSize: 11, color: '#7286bd' }}>Sin resultados</div> : visible.map(opt => (
            <label key={opt} style={mselOption}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmt(opt)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function Segmented({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'inline-flex', border: '1px solid #c6e5f4', borderRadius: 8, overflow: 'hidden', background: '#f7fcff' }}>{children}</div>
}

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ border: 0, borderRight: '1px solid #c6e5f4', background: active ? '#18a9e5' : 'transparent', color: active ? '#fff' : '#243d71', padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', minWidth: 72 }}>{children}</button>
}

function Card({ children, noPadding = false }: { children: React.ReactNode; noPadding?: boolean }) {
  return <section style={{ background: '#fff', border: '1px solid #cbe5f3', borderRadius: 8, padding: noPadding ? 0 : 16, boxShadow: '0 1px 4px rgba(14,74,103,.1)', overflow: 'hidden' }}>{children}</section>
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid #d3eaf6', background: '#f6fcff' }}>{children}</div>
}

function CardTitle({ title, badge }: { title: string; badge?: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 15, fontWeight: 800 }}>{title}{badge && <span style={{ background: '#e8f8ff', color: '#087fa8', border: '1px solid #c6e5f4', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 800 }}>{badge}</span>}</div>
}

function Kpi({ label, value, color = '#19a8e6' }: { label: string; value: string; color?: string }) {
  return <div style={{ background: '#fff', border: '1px solid #cbe5f3', borderTop: `3px solid ${color}`, borderRadius: 8, padding: '13px 16px', boxShadow: '0 1px 4px rgba(14,74,103,.1)' }}><div style={{ color: '#7286bd', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div><div style={{ color: '#087fa8', marginTop: 7, fontFamily: 'monospace', fontSize: 17, fontWeight: 800 }}>{value}</div></div>
}

function SideTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ color: 'rgba(255,255,255,.36)', fontSize: 10, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase', padding: '16px 18px 7px' }}>{children}</div>
}

function Insight({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return <div style={{ background: bg, border: `1px solid ${color}`, color: '#0b4b5d', borderRadius: 8, padding: '10px 12px', fontSize: 13, lineHeight: 1.45 }}>{children}</div>
}

function Th({ children, right = false, onClick }: { children?: React.ReactNode; right?: boolean; onClick?: () => void }) {
  return <th onClick={onClick} style={{ padding: '8px 10px', color: '#7286bd', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: right ? 'right' : 'left', borderBottom: '1px solid #d3eaf6', cursor: onClick ? 'pointer' : 'default', userSelect: 'none' }}>{children}</th>
}

function Td({ children, right = false, style = {}, onClickCapture }: { children: React.ReactNode; right?: boolean; style?: React.CSSProperties; onClickCapture?: (e: React.MouseEvent) => void }) {
  return <td onClickCapture={onClickCapture} style={{ padding: '8px 10px', color: '#243d71', fontSize: 13, textAlign: right ? 'right' : 'left', borderBottom: '1px solid #d3eaf6', ...style }}>{children}</td>
}

function pieSlice(cx: number, cy: number, r: number, start: number, end: number) {
  const a0 = start * Math.PI * 2 - Math.PI / 2
  const a1 = end * Math.PI * 2 - Math.PI / 2
  const x0 = cx + Math.cos(a0) * r
  const y0 = cy + Math.sin(a0) * r
  const x1 = cx + Math.cos(a1) * r
  const y1 = cy + Math.sin(a1) * r
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${end - start > 0.5 ? 1 : 0} 1 ${x1} ${y1} Z`
}

const navStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 9, width: 'calc(100% - 24px)', margin: '0 12px 6px', padding: '9px 12px', borderRadius: 8, border: 'none', background: active ? '#18a9e5' : 'transparent', color: active ? '#fff' : 'rgba(255,255,255,.66)', cursor: 'pointer', fontSize: 13, fontWeight: active ? 800 : 600, textAlign: 'left'
})

const sideButton: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.55)', padding: '8px 10px', borderRadius: 6, fontWeight: 800 }
const dot: React.CSSProperties = { width: 9, height: 9, borderRadius: '50%', background: '#7dd3fc' }
const selectStyle: React.CSSProperties = { width: 270, background: '#f7fcff', border: '1px solid #bfe1f3', borderRadius: 8, color: '#0d1b38', fontSize: 13, padding: '8px 10px', outline: 'none' }
const inputStyle: React.CSSProperties = { width: 340, background: '#f7fcff', border: '1px solid #bfe1f3', borderRadius: 8, color: '#0d1b38', fontSize: 13, padding: '8px 10px', outline: 'none' }
const emptyStyle: React.CSSProperties = { background: '#fff', border: '1.5px dashed #b7dcf0', borderRadius: 10, padding: '78px 20px', textAlign: 'center', color: '#7286bd' }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const notice: React.CSSProperties = { border: '1px solid #c6e5f4', background: '#f5fcff', borderRadius: 8, padding: 12, color: '#243d71', lineHeight: 1.4, fontSize: 13 }
const excelBtn: React.CSSProperties = { marginLeft: 'auto', border: '1px solid #c6e5f4', background: '#fff', color: '#087fa8', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }
const clearBtn: React.CSSProperties = { border: '1px solid #c6e5f4', background: '#fff', color: '#7286bd', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }
const filterInputStyle: React.CSSProperties = { width: '100%', border: '1px solid #bfe1f3', borderRadius: 6, padding: '4px 6px', fontSize: 11, background: '#f7fcff', color: '#0d1b38', outline: 'none' }
const pdfBtnStyle: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 6, border: '1px solid #d3eaf6', background: '#f7fcff', color: '#a0b0d0', cursor: 'default', whiteSpace: 'nowrap' }
const mselBtn: React.CSSProperties = { border: '1px solid #bfe1f3', borderRadius: 6, padding: '4px 8px', fontSize: 11, background: '#f7fcff', color: '#0d1b38', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, width: '100%', minWidth: 90, justifyContent: 'space-between' }
const mselPanel: React.CSSProperties = { position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: '#fff', border: '1px solid #b7dcf0', borderRadius: 8, boxShadow: '0 6px 24px rgba(10,22,40,0.14)', zIndex: 50, maxHeight: 260, overflowY: 'auto', minWidth: 220, padding: 6 }
const mselSearch: React.CSSProperties = { width: '100%', border: '1px solid #d3eaf6', borderRadius: 6, padding: '5px 8px', fontSize: 11.5, color: '#0d1b38', background: '#f7fcff', outline: 'none', marginBottom: 6 }
const mselActions: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '2px 6px 6px', borderBottom: '1px solid #d3eaf6', marginBottom: 4, fontSize: 10.5, color: '#19a8e6', fontWeight: 700, cursor: 'pointer' }
const mselOption: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', fontSize: 12, cursor: 'pointer', borderRadius: 5, color: '#3d5278' }
