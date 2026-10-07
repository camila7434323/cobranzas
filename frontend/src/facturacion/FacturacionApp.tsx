import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx-js-style'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useFacturacionLineas, type FacturacionLinea } from './hooks/useFacturacionLineas'
import { SubirFacturacionExcel } from './components/SubirFacturacionExcel'
import { usePdfsStorage } from '../hooks/usePdfsStorage'
import { usePdfsManuales } from '../hooks/usePdfsManuales'
import { Sidebar, SidebarHeader, SidebarUser, SidebarNav, SidebarSeccion, SidebarItem, SidebarFooter, Bandera, Icono } from '../components/Sidebar'

type Vista = 'dashboard' | 'detalle'
type Modo = 'compania' | 'cliente' | 'cc'

const PALETTE = ['#5b8def', '#38bdf8', '#72c8ee', '#147c91', '#a7b7ff', '#b9a7f5', '#80e0a0', '#f5c84b', '#f99aaa', '#cbd5e1', '#55dfc9']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const periodoKey = (r: FacturacionLinea) => (r.periodo || r.fecha_factura || '').slice(0, 7)
const monedaFila = (r: FacturacionLinea) => (r.moneda || 'ARS').toUpperCase()
const nombreCliente = (r: FacturacionLinea) => r.cliente || 'Sin cliente'
const nombreCc = (r: FacturacionLinea) => r.cc_descripcion || 'Sin CC'

const fmtMoney = (n: number, moneda: string) => {
  const value = n.toLocaleString(moneda === 'USD' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (moneda === 'EUR') return `${value} €`
  return moneda === 'USD' ? `US$ ${value}` : `$ ${value}`
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

const normalizar = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const camposBusqueda = (r: FacturacionLinea): string[] => [
  r.cliente, r.cuit, r.ejecutivo, r.empresa, r.legajo, r.colaborador, r.otros_conceptos,
  r.oc, r.leyenda, r.moneda, r.n_factura, r.cond_venta, r.articulo_codigo, r.articulo_descripcion,
  r.cc_descripcion, r.periodo ? mesLabel(periodoKey(r)) : '', fmtFecha(r.fecha_factura),
  String(r.cantidad ?? ''), r.precio_unitario?.toFixed(2), r.total_neto?.toFixed(2),
]

const coincideBusqueda = (r: FacturacionLinea, q: string) => {
  const campos = camposBusqueda(r).map(v => normalizar(String(v || '')))
  // Cada palabra clave puede matchear en un campo distinto (colaborador + mes,
  // cliente + importe, etc.); todas tienen que aparecer en algún lado.
  const tokens = normalizar(q).split(/\s+/).filter(Boolean)
  return tokens.every(t => campos.some(c => c.includes(t)))
}

const flagCode = (moneda: string) => moneda === 'USD' ? 'us' : moneda === 'EUR' ? 'es' : 'ar'

// La bandera es la de la sociedad que emite (SA = Argentina, LLC = EE.UU., SL = España),
// no la de la moneda: una factura de SA puede estar en USD y no por eso es de EE.UU.
const flagEmpresa = (empresa: string, moneda: string) => {
  const e = normalizar(empresa || '')
  if (/\bllc\b/.test(e)) return 'us'
  if (/\bsl\b/.test(e)) return 'es'
  if (/\bsa\b/.test(e)) return 'ar'
  return flagCode(moneda)
}

const ORDEN_EMPRESAS = ['ASAP CONSULTING SA', 'ASAP CONSULTING LLC', 'IT ASAP CONSULTING SOLUTIONS, SL']
const ordenEmpresa = (nombre: string) => {
  const i = ORDEN_EMPRESAS.indexOf(nombre)
  return i === -1 ? ORDEN_EMPRESAS.length : i
}

const EXEC_PALETTE = [
  { bg: 'rgba(76,139,230,0.16)', text: '#a9c4ff', bd: 'rgba(76,132,230,0.4)' },
  { bg: 'rgba(76,230,151,0.16)', text: '#7bf4d2', bd: '#6ee7b7' },
  { bg: 'rgba(230,199,76,0.16)', text: '#f3a97d', bd: '#fcd34d' },
  { bg: 'rgba(139,92,246,0.16)', text: '#ad87e8', bd: 'rgba(108,76,230,0.4)' },
  { bg: 'rgba(76,230,197,0.16)', text: '#80efe6', bd: '#5eead4' },
  { bg: 'rgba(76,216,230,0.16)', text: '#7ee0f0', bd: '#67e8f9' },
  { bg: 'rgba(230,76,164,0.16)', text: '#ed82ad', bd: 'rgba(230,76,160,0.4)' },
  { bg: 'rgba(99,102,241,0.16)', text: '#9591df', bd: 'rgba(76,103,230,0.4)' },
  { bg: 'rgba(76,230,129,0.16)', text: '#8ae5ad', bd: '#86efac' },
  { bg: 'rgba(230,164,76,0.16)', text: '#f09b7f', bd: '#fdba74' },
]

const execColor = (name: string) => {
  let hash = 0
  const str = name || '·'
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return EXEC_PALETTE[Math.abs(hash) % EXEC_PALETTE.length]
}

const estilizarComoTabla = (ws: XLSX.WorkSheet, numRows: number, numCols: number) => {
  // Colores en ARGB de 8 dígitos para que Excel siempre los renderice.
  const HEADER_BG = 'FF1F7A44'   // verde tabla
  const BANDA_BG  = 'FFEAF4EE'   // verde muy claro (filas impares)
  const BLANCO    = 'FFFFFFFF'
  const TEXTO     = 'FF1F2937'
  const LINEA     = 'FFBFD9C7'
  const borde = { style: 'thin', color: { rgb: LINEA } }
  const bordes = { top: borde, bottom: borde, left: borde, right: borde }

  for (let ci = 0; ci < numCols; ci++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: ci })]
    if (!cell) continue
    cell.s = {
      fill: { patternType: 'solid', fgColor: { rgb: HEADER_BG } },
      font: { bold: true, color: { rgb: BLANCO }, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: bordes,
    }
  }
  for (let ri = 1; ri <= numRows; ri++) {
    for (let ci = 0; ci < numCols; ci++) {
      const cell = ws[XLSX.utils.encode_cell({ r: ri, c: ci })]
      if (!cell) continue
      const esNumero = typeof cell.v === 'number'
      cell.s = {
        fill: { patternType: 'solid', fgColor: { rgb: ri % 2 ? BANDA_BG : BLANCO } },
        font: { color: { rgb: TEXTO }, sz: 10 },
        alignment: { horizontal: esNumero ? 'right' : 'left', vertical: 'center' },
        border: bordes,
      }
      if (esNumero) cell.z = '#,##0.00'
    }
  }
  ws['!cols'] = Array.from({ length: numCols }, (_, ci) => {
    let max = 10
    for (let ri = 0; ri <= numRows; ri++) {
      const cell = ws[XLSX.utils.encode_cell({ r: ri, c: ci })]
      if (cell) max = Math.max(max, String(cell.v ?? '').length)
    }
    return { wch: Math.min(42, max + 2) }
  })
  ws['!rows'] = Array.from({ length: numRows + 1 }, (_, ri) => ({ hpt: ri === 0 ? 24 : 18 }))
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: numRows, c: Math.max(numCols - 1, 0) } }) }
}

const exportXlsx = (filename: string, rows: Array<Array<string | number>>) => {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  estilizarComoTabla(ws, rows.length - 1, rows[0]?.length || 0)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')
  XLSX.writeFile(wb, filename)
}

const CLAVE_PANEL_VENTAS = 'asap2026'

export function FacturacionApp({ session, onCambiarModulo }: { session: Session; onCambiarModulo: () => void }) {
  const { data: dataTodas, loading: loadingLineas, error, insertarLote } = useFacturacionLineas()
  const { buscarPdf } = usePdfsStorage()
  const { buscarPdfManual } = usePdfsManuales()

  // Igual que en Cobranzas: un ejecutivo ve solo sus cuentas; admin, gerencia
  // (o cualquier otro rol) ven todo. Mientras no se sabe el rol se sigue en "cargando"
  // para no mostrarle por un instante datos ajenos a un ejecutivo.
  const [perfil, setPerfil] = useState<{ rol: string; ejecutivo_nombre: string | null } | null | undefined>(undefined)
  useEffect(() => {
    let activo = true
    supabase.from('perfiles').select('rol, ejecutivo_nombre').eq('id', session.user.id).single()
      .then(({ data: p }) => { if (activo) setPerfil(p ?? null) })
    return () => { activo = false }
  }, [session.user.id])
  const soloEjecutivo = perfil?.rol === 'ejecutivo' ? normalizar(perfil.ejecutivo_nombre || '').trim() : null
  const data = useMemo(
    () => soloEjecutivo === null ? dataTodas : dataTodas.filter(r => !!soloEjecutivo && normalizar(r.ejecutivo || '').trim() === soloEjecutivo),
    [dataTodas, soloEjecutivo]
  )
  const loading = loadingLineas || perfil === undefined
  const nombreUsuario = session.user.user_metadata?.full_name || perfil?.ejecutivo_nombre || session.user.email?.split('@')[0] || 'Usuario'
  const [vista, setVista] = useState<Vista>('detalle')
  const [empresaActiva, setEmpresaActiva] = useState('all')
  const [busqueda, setBusqueda] = useState('')
  const [modo, setModo] = useState<Modo>('compania')
  const [anio, setAnio] = useState('2026')
  const [mesesSel, setMesesSel] = useState<string[]>([])
  const [clientesSel, setClientesSel] = useState<string[]>([])
  const [ccsSel, setCcsSel] = useState<string[]>([])
  const [pdfNoEncontrado, setPdfNoEncontrado] = useState('')
  const [modalPdf, setModalPdf] = useState<{ row: FacturacionLinea; url: string } | null>(null)
  const [ventasDesbloqueado, setVentasDesbloqueado] = useState(false)
  const [pedirClaveVentas, setPedirClaveVentas] = useState(false)
  const [claveVentas, setClaveVentas] = useState('')
  const [claveVentasError, setClaveVentasError] = useState(false)

  const abrirPdf = async (row: FacturacionLinea) => {
    // Primero el bucket (facturas argentinas); si no está, las cargadas a mano en Cobranzas (exterior).
    const url = buscarPdf(row.n_factura)?.url || await buscarPdfManual(row.n_factura)
    if (!url) {
      setPdfNoEncontrado(row.n_factura)
      setTimeout(() => setPdfNoEncontrado(''), 4000)
      return
    }
    setModalPdf({ row, url })
  }

  const hoy = new Date()
  const mesActualKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`

  const empresas = useMemo(() => {
    const map = new Map<string, { nombre: string; moneda: string }>()
    data.forEach(r => {
      if (!r.empresa || map.has(r.empresa)) return
      const moneda = groupSum(data.filter(x => x.empresa === r.empresa), monedaFila)[0]?.[0] || 'ARS'
      map.set(r.empresa, { nombre: r.empresa, moneda })
    })
    return Array.from(map.values()).sort((a, b) => ordenEmpresa(a.nombre) - ordenEmpresa(b.nombre) || a.nombre.localeCompare(b.nombre))
  }, [data])

  const anios = useMemo(() => {
    const set = new Set(data.map(periodoKey).filter(Boolean).map(k => k.slice(0, 4)))
    return Array.from(set).sort()
  }, [data])
  const anioActivo = anio === 'all' ? 'all' : anios.includes(anio) ? anio : (anios[anios.length - 1] || 'all')

  const dashboardRows = useMemo(() => data.filter(r => {
    const key = periodoKey(r)
    if (key && key >= mesActualKey) return false
    if (empresaActiva !== 'all' && r.empresa !== empresaActiva) return false
    if (anioActivo !== 'all' && key.slice(0, 4) !== anioActivo) return false
    if (mesesSel.length && !mesesSel.includes(key)) return false
    if (modo === 'cliente' && clientesSel.length && !clientesSel.includes(nombreCliente(r))) return false
    if (modo === 'cc' && ccsSel.length && !ccsSel.includes(nombreCc(r))) return false
    return true
  }), [data, empresaActiva, anioActivo, mesesSel, modo, clientesSel, ccsSel, mesActualKey])

  const mesesDisponibles = useMemo(() => {
    const set = new Set(data.filter(r => empresaActiva === 'all' || r.empresa === empresaActiva).map(periodoKey).filter(Boolean))
    return Array.from(set).filter(k => (anioActivo === 'all' || k.startsWith(anioActivo)) && k < mesActualKey).sort()
  }, [data, empresaActiva, anioActivo, mesActualKey])

  const clientesDisponibles = useMemo(() => groupSum(dashboardRows, nombreCliente).map(([k]) => k), [dashboardRows])
  const ccDisponibles = useMemo(() => groupSum(dashboardRows, nombreCc).map(([k]) => k), [dashboardRows])

  const rowsEmpresa = useMemo(
    () => empresaActiva === 'all' ? data : data.filter(r => r.empresa === empresaActiva),
    [data, empresaActiva]
  )
  const filas = useMemo(() => {
    if (!busqueda.trim()) return rowsEmpresa
    return rowsEmpresa.filter(r => coincideBusqueda(r, busqueda))
  }, [rowsEmpresa, busqueda])

  const abrirDashboard = () => {
    if (!ventasDesbloqueado) {
      setClaveVentas('')
      setClaveVentasError(false)
      setPedirClaveVentas(true)
      return
    }
    setVista('dashboard')
    setEmpresaActiva('all')
    setBusqueda('')
    window.scrollTo({ top: 0 })
  }

  const irEmpresa = (empresa: string) => {
    setEmpresaActiva(empresa)
    setVista('detalle')
    setBusqueda('')
    window.scrollTo({ top: 0 })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', width: '100vw', height: '100vh', overflow: 'hidden', background: 'radial-gradient(1100px 600px at 100% 0%, rgba(59,111,217,0.12), transparent 60%), radial-gradient(800px 500px at 0% 100%, rgba(79,70,229,0.08), transparent 60%), #0a1630', color: '#e7eefb', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
      <Sidebar>
        <SidebarHeader app="facturacion" />
        <SidebarUser nombre={nombreUsuario} estado={soloEjecutivo !== null ? 'Solo tus cuentas' : 'Activo'} />

        <SidebarNav>
          <SidebarSeccion>Vistas</SidebarSeccion>
          <SidebarItem
            label="Panel de Ventas"
            icono={<Icono nombre="chart" />}
            activo={vista === 'dashboard'}
            onClick={abrirDashboard}
            extra={!ventasDesbloqueado ? <span style={{ opacity: 0.55, display: 'grid' }} title="Requiere contraseña"><Icono nombre="candado" size={13} /></span> : undefined}
          />

          <SidebarSeccion>Compañías</SidebarSeccion>
          <SidebarItem label="Todas las compañías" icono={<Icono nombre="capas" />} activo={vista === 'detalle' && empresaActiva === 'all'} onClick={() => irEmpresa('all')} />
          {empresas.map(e => (
            <SidebarItem
              key={e.nombre}
              label={e.nombre}
              icono={<Bandera code={flagEmpresa(e.nombre, e.moneda)} />}
              activo={vista === 'detalle' && empresaActiva === e.nombre}
              onClick={() => irEmpresa(e.nombre)}
            />
          ))}
        </SidebarNav>

        <SidebarFooter onCambiarModulo={onCambiarModulo}>
          <SubirFacturacionExcel insertarLote={insertarLote} compact />
          <div style={{ color: 'rgba(255,255,255,.42)', fontSize: 11, lineHeight: 1.35 }}>Facturación global por cliente, ejecutivo y período.</div>
        </SidebarFooter>
      </Sidebar>

      <section style={{ minWidth: 0, overflow: 'hidden' }}>
        <header style={{ height: 58, background: '#11223f', borderBottom: '1px solid rgba(76,177,230,0.4)', padding: '0 28px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 5px rgba(10,22,40,0.08)' }}>
          <span style={{ fontSize: 20, fontWeight: 800 }}>Facturación</span>
          <span style={{ color: '#8ea0c4', fontSize: 13 }}>· {empresaActiva === 'all' ? 'Todas las compañías' : empresaActiva}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: '#8ea0c4' }}>{session.user.email}</span>
        </header>

        <main style={{ padding: '22px 28px 36px', height: 'calc(100vh - 58px)', overflowY: 'auto', overflowX: 'hidden', scrollbarGutter: 'stable', display: 'flex', flexDirection: 'column' }}>
          {error && <div style={{ color: '#eb8484', marginBottom: 14, fontSize: 13 }}>⚠ {error}</div>}
          {loading ? (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}><div style={emptyStyle}>Cargando facturación...</div></div>
          ) : data.length === 0 && soloEjecutivo !== null ? (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
              <div style={emptyStyle}>No hay facturación asignada a tu cuenta{dataTodas.length === 0 ? ' todavía' : ''}.</div>
            </div>
          ) : data.length === 0 ? (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
              <div style={{ width: '100%', maxWidth: 680, background: '#11223f', border: '1.5px dashed rgba(76,176,230,0.4)', borderRadius: 12, padding: '64px 40px', textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, margin: '0 auto', borderRadius: 14, background: '#0a1630', display: 'grid', placeItems: 'center' }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#5b8def" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="8" y1="13" x2="16" y2="13" />
                    <line x1="8" y1="17" x2="16" y2="17" />
                    <line x1="8" y1="9" x2="10" y2="9" />
                  </svg>
                </div>
                <div style={{ marginTop: 18, fontSize: 18, fontWeight: 800, color: '#e7eefb' }}>Todavía no cargaste ningún archivo</div>
                <div style={{ margin: '8px auto 22px', maxWidth: 420, fontSize: 13.5, color: '#8ea0c4', lineHeight: 1.5 }}>
                  Subí el Excel de desglose de facturación para poder filtrar por cliente, ejecutivo, período y centro de costo.
                </div>
                <div style={{ display: 'inline-block', minWidth: 190 }}>
                  <SubirFacturacionExcel insertarLote={insertarLote} compact />
                </div>
              </div>
            </div>
          ) : vista === 'dashboard' ? (
            <PanelVentas
              rows={dashboardRows}
              empresas={empresas}
              empresaActiva={empresaActiva}
              setEmpresaActiva={setEmpresaActiva}
              modo={modo}
              setModo={setModo}
              anios={anios}
              anio={anioActivo}
              setAnio={setAnio}
              meses={mesesDisponibles}
              mesesSel={mesesSel}
              setMesesSel={setMesesSel}
              clientes={clientesDisponibles}
              clientesSel={clientesSel}
              setClientesSel={setClientesSel}
              centrosCosto={ccDisponibles}
              ccsSel={ccsSel}
              setCcsSel={setCcsSel}
            />
          ) : (
            // flexShrink:0 evita que <main> (flex column) achique este bloque por
            // debajo de su contenido: sin esto la tabla larga queda recortada y
            // no se puede scrollear hasta el final del listado.
            <div style={{ flexShrink: 0 }}>
              <div style={{ marginBottom: 16 }}>
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar en toda la facturación (cliente, CUIT, ejecutivo, factura, período, artículo, importe...)" style={inputStyle} />
              </div>
              <Detalle key={empresaActiva} filas={filas} empresaActiva={empresaActiva} onAbrirPdf={abrirPdf} />
            </div>
          )}
        </main>
      </section>

      {pdfNoEncontrado && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1002, background: 'rgba(230,199,76,0.16)', border: '1px solid #fcd34d', borderRadius: 10, padding: '16px 44px 16px 24px', fontSize: 14, color: '#f3a97d', fontWeight: 500, boxShadow: '0 10px 30px rgba(0,0,0,0.55)' }}>
          ⚠ Factura <strong>{pdfNoEncontrado}</strong> no subida a la base de datos.
          <button onClick={() => setPdfNoEncontrado('')} aria-label="Cerrar" style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#f3a97d', fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
        </div>
      )}

      {pedirClaveVentas && (
        <div onClick={() => setPedirClaveVentas(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={e => {
              e.preventDefault()
              if (claveVentas !== CLAVE_PANEL_VENTAS) {
                setClaveVentasError(true)
                return
              }
              setVentasDesbloqueado(true)
              setPedirClaveVentas(false)
              setVista('dashboard')
              setEmpresaActiva('all')
              setBusqueda('')
              window.scrollTo({ top: 0 })
            }}
            style={{ background: '#11223f', borderRadius: 16, width: '100%', maxWidth: 380, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.55)', display: 'grid', gap: 12 }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: '#e7eefb' }}>🔒 Panel de Ventas</div>
            <div style={{ fontSize: 13, color: '#8ea0c4' }}>Ingresá la contraseña para ver el panel.</div>
            <input
              type="password"
              autoFocus
              value={claveVentas}
              onChange={e => { setClaveVentas(e.target.value); setClaveVentasError(false) }}
              placeholder="Contraseña"
              style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${claveVentasError ? '#dc2626' : '#24395f'}`, fontSize: 14, outline: 'none' }}
            />
            {claveVentasError && <div style={{ color: '#eb8484', fontSize: 12 }}>Contraseña incorrecta.</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setPedirClaveVentas(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(76,177,230,0.4)', background: '#11223f', color: '#e7eefb', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button type="submit" style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#3b6fd9', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Entrar</button>
            </div>
          </form>
        </div>
      )}

      {modalPdf && (
        <div onClick={() => setModalPdf(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#11223f', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.55)' }}>
            <div style={{ background: '#1c3360', borderRadius: '16px 16px 0 0', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📄</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{modalPdf.row.n_factura}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{nombreCliente(modalPdf.row)} · Supabase Storage</div>
              </div>
              <button onClick={() => setModalPdf(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#fff', fontSize: 16, flexShrink: 0 }}>✕</button>
            </div>
            <div style={{ background: '#0e1e39', padding: 16 }}>
              <iframe src={modalPdf.url} style={{ width: '100%', height: 380, border: 'none', borderRadius: 8, background: '#11223f' }} title="PDF" />
            </div>
            <div style={{ padding: '16px 24px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'CLIENTE', value: nombreCliente(modalPdf.row) },
                  { label: 'EJECUTIVO', value: modalPdf.row.ejecutivo || 'Sin asignar' },
                  { label: 'PERÍODO', value: modalPdf.row.periodo ? mesLabel(periodoKey(modalPdf.row)) : '-' },
                  { label: 'FECHA FACTURA', value: fmtFecha(modalPdf.row.fecha_factura) },
                  { label: 'IMPORTE', value: fmtMoney(modalPdf.row.total_neto, monedaFila(modalPdf.row)) },
                  { label: 'CC', value: nombreCc(modalPdf.row) },
                ].map((item, idx) => (
                  <div key={`modal-${item.label}-${idx}`} style={{ background: '#11223f', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#8ea0c4', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e7eefb' }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <a href={modalPdf.url} download target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#3b6fd9', color: '#fff', padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>⬇ Descargar</a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PanelVentas(props: {
  rows: FacturacionLinea[]
  empresas: { nombre: string; moneda: string }[]
  empresaActiva: string
  setEmpresaActiva: (v: string) => void
  modo: Modo
  setModo: (v: Modo) => void
  anios: string[]
  anio: string
  setAnio: (v: string) => void
  meses: string[]
  mesesSel: string[]
  setMesesSel: (v: string[]) => void
  clientes: string[]
  clientesSel: string[]
  setClientesSel: (v: string[]) => void
  centrosCosto: string[]
  ccsSel: string[]
  setCcsSel: (v: string[]) => void
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
    <div style={{ display: 'grid', gap: 16, width: '100%', minWidth: 0 }}>
      <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', scrollbarGutter: 'stable' }}>
        <Segmented>
          <Seg active={props.empresaActiva === 'all'} onClick={() => props.setEmpresaActiva('all')}>Todas</Seg>
          {props.empresas.map(e => (
            <Seg key={e.nombre} active={props.empresaActiva === e.nombre} onClick={() => props.setEmpresaActiva(e.nombre)}>
              <span className={`fi fi-${flagEmpresa(e.nombre, e.moneda)}`} style={{ borderRadius: 2, marginRight: 6, verticalAlign: 'middle', flexShrink: 0 }} />
              {e.nombre.toUpperCase()}
            </Seg>
          ))}
        </Segmented>
      </div>

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

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ width: 270 }}>
          <MultiSelect options={props.meses} selected={props.mesesSel} onChange={props.setMesesSel} placeholderAll="Todos los meses" formatLabel={mesLabel} />
        </div>
        {props.modo === 'cliente' && (
          <div style={{ width: 270 }}>
            <MultiSelect options={props.clientes} selected={props.clientesSel} onChange={props.setClientesSel} placeholderAll="Elegí uno o más clientes" />
          </div>
        )}
        {props.modo === 'cc' && (
          <div style={{ width: 270 }}>
            <MultiSelect options={props.centrosCosto} selected={props.ccsSel} onChange={props.setCcsSel} placeholderAll="Elegí uno o más CC" />
          </div>
        )}
        {(props.mesesSel.length > 0 || props.clientesSel.length > 0 || props.ccsSel.length > 0) && (
          <button style={clearBtn} onClick={() => { props.setMesesSel([]); props.setClientesSel([]); props.setCcsSel([]) }}>✕ Limpiar filtro</button>
        )}
      </div>

      <div style={{ color: '#8ea0c4', fontSize: 13 }}>▦ Análisis hasta <strong>{ultimoMes ? mesLabel(ultimoMes) : 'el último período cargado'}</strong> — se excluye el mes en curso por estar incompleto.</div>

      {monedas.length === 0 ? <div style={emptyStyle}>Sin datos para esta selección.</div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14, minHeight: 89 }}>
            {monedas.map(m => <Kpi key={m} label={`Facturación del ${props.anio === 'all' ? 'período' : props.anio} (${m})`} value={fmtMoney((rowsByMoneda.get(m) || []).reduce((s, r) => s + r.total_neto, 0), m)} />)}
          </div>

          {monedas.map(m => <MonedaSection key={m} rows={rowsByMoneda.get(m) || []} moneda={m} />)}
        </>
      )}
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
      <svg viewBox="0 0 940 265" style={{ width: '100%', height: 265, display: 'block', flexShrink: 0 }}>
        {[0, 1, 2, 3, 4].map(i => <line key={i} x1="60" x2="900" y1={230 - i * 45} y2={230 - i * 45} stroke="#24395f" strokeDasharray="4 5" />)}
        {area && <path d={area} fill="rgba(91,141,239,0.14)" />}
        {line && <path d={line} fill="none" stroke="#5b8def" strokeWidth="3" />}
        {points.map(p => <g key={p.k}><circle cx={p.x} cy={p.y} r="4" fill="#5b8def" stroke="#11223f" strokeWidth="2" /><text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fill="#e7eefb" fontWeight="800">{fmtShort(p.v, moneda)}</text><text x={p.x} y="252" textAnchor="middle" fontSize="11" fill="#8ea0c4">{mesCorto(p.k)}</text></g>)}
      </svg>
      <div style={{ display: 'grid', gap: 8, minHeight: 98, alignContent: 'start' }}>
        {subida && <Insight color="#22c55e" bg="rgba(34,197,94,0.12)">📈 <strong>Mayor suba:</strong> {subida.pct.toFixed(0)}% de {mesLabel(subida.from.k)} a {mesLabel(subida.to.k)} ({fmtMoney(subida.from.v, moneda)} → {fmtMoney(subida.to.v, moneda)})</Insight>}
        {baja && <Insight color="#8b5cf6" bg="rgba(139,92,246,0.14)">📉 <strong>Mayor baja:</strong> {baja.pct.toFixed(0)}% de {mesLabel(baja.from.k)} a {mesLabel(baja.to.k)} ({fmtMoney(baja.from.v, moneda)} → {fmtMoney(baja.to.v, moneda)})</Insight>}
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
      {clientes.length > 10 && <div style={{ textAlign: 'center', padding: 10, color: '#7cccf3', fontWeight: 700, borderTop: '1px solid rgba(76,177,230,0.4)' }}>▼ Ver los {clientes.length - 10} restantes</div>}
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
      <div style={{ padding: '14px 18px', fontSize: 15, fontWeight: 800, borderBottom: '1px solid rgba(76,177,230,0.4)' }}>Distribución</div>
      <div style={{ display: 'grid', gridTemplateColumns: '205px 1fr', gap: 22, alignItems: 'center', padding: 20 }}>
        <svg viewBox="0 0 220 220" style={{ width: 200 }}>{segs.map(s => <path key={s.name} d={s.d} fill={s.color} />)}</svg>
        <div style={{ display: 'grid', gap: 8 }}>{segs.map(s => <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '14px 1fr auto', gap: 8, alignItems: 'center' }}><span style={{ width: 12, height: 12, borderRadius: 3, background: s.color }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#e7eefb' }}>{s.name}</span><strong>{((s.value / total) * 100).toFixed(1)}%</strong></div>)}</div>
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
      <CardHeader><CardTitle title="Clientes x mes" badge={moneda} /><span style={{ color: '#8ea0c4', fontSize: 12 }}>clic en un cliente para ver el desglose por CC</span><button style={excelBtn} onClick={() => exportXlsx(`clientes-por-mes-${moneda}.xlsx`, [['Cliente', ...months.map(mesCorto)], ...clients.map(([client]) => [client, ...months.map(m => sumFor(client, m).toFixed(2))])])}>↓ Excel</button></CardHeader>
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
                  {open[client] && ccs.map(cc => <tr key={`${client}-${cc}`} style={{ background: '#0e1e39' }}><Td style={{ paddingLeft: 34, color: '#8ea0c4' }}>{cc}</Td>{months.map(m => { const v = sumFor(client, m, cc); return <Td key={m} right style={{ color: '#8ea0c4' }}>{v ? fmtMoney(v, moneda) : '-'}</Td> })}</tr>)}
                </Fragment>
              )
            })}
            <tr style={{ background: '#0e1e39' }}><Td><strong>TOTAL GENERAL</strong></Td>{months.map(m => <Td key={m} right><strong>{fmtMoney(monthGrandTotal.get(m) || 0, moneda)}</strong></Td>)}</tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}

type SortCol = 'cliente' | 'ejecutivo' | 'periodo' | 'fecha' | 'nfactura' | 'cc' | 'total'

function Detalle({ filas, empresaActiva, onAbrirPdf }: { filas: FacturacionLinea[]; empresaActiva: string; onAbrirPdf: (row: FacturacionLinea) => void }) {
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
    if (nFacturaText.trim() && !normalizar(String(r.n_factura || '')).includes(normalizar(nFacturaText.trim()))) return false
    return true
  }), [filas, clientesSel, ejecutivosSel, periodosSel, nFacturaText])

  // Clave canónica de CC: sin acentos, sin espacios de más, minúsculas. Evita que
  // "Salesforce - Salesforce" y variantes con doble espacio / mayúsculas queden
  // como opciones distintas y que la selección no matchee las filas.
  const ccKey = (r: FacturacionLinea) => normalizar(nombreCc(r).replace(/\s+/g, ' ').trim())
  const ccsOpts = useMemo(() => {
    const porClave = new Map<string, string>()
    for (const r of baseFiltered) {
      const k = ccKey(r)
      if (!porClave.has(k)) porClave.set(k, nombreCc(r).replace(/\s+/g, ' ').trim())
    }
    return Array.from(porClave.values()).sort((a, b) => a.localeCompare(b))
  }, [baseFiltered])
  const ccFiltered = useMemo(() => {
    if (!ccsSel.length) return baseFiltered
    const sel = new Set(ccsSel.map(v => normalizar(v.replace(/\s+/g, ' ').trim())))
    return baseFiltered.filter(r => sel.has(ccKey(r)))
  }, [baseFiltered, ccsSel])

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

  // Todo lo que esté filtrado se muestra como burbujas quitables arriba de la tabla.
  const chipsFiltro: { key: string; texto: string; quitar: () => void }[] = [
    ...clientesSel.map(v => ({ key: `cli:${v}`, texto: `Cliente: ${v}`, quitar: () => setClientesSel(clientesSel.filter(x => x !== v)) })),
    ...ejecutivosSel.map(v => ({ key: `eje:${v}`, texto: `Ejecutivo: ${v}`, quitar: () => setEjecutivosSel(ejecutivosSel.filter(x => x !== v)) })),
    ...periodosSel.map(v => ({ key: `per:${v}`, texto: `Período: ${mesLabel(v)}`, quitar: () => setPeriodosSel(periodosSel.filter(x => x !== v)) })),
    ...ccsSel.map(v => ({ key: `cc:${v}`, texto: `CC: ${v}`, quitar: () => setCcsSel(ccsSel.filter(x => x !== v)) })),
    ...(nFacturaText.trim() ? [{ key: 'nf', texto: `N° Factura: ${nFacturaText.trim()}`, quitar: () => setNFacturaText('') }] : []),
  ]

  const kpiColors = ['#5b8def', '#059669', '#d97706', '#7c3aed']

  return (
    <Card noPadding>
      <div style={{ padding: '14px 14px 0' }}>
        <div style={notice}>ℹ️ <strong>Facturación desglosada por línea</strong> (una factura puede tener varias filas). Filtrá lo que necesites — los indicadores de abajo se recalculan automáticamente con tu selección.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, padding: 14 }}>
        {porMoneda.map(([m, v]) => <Kpi key={m} label={`Total facturado (${m})`} value={fmtMoney(v, m)} color={kpiColors[0]} />)}
        <Kpi label="Clientes" value={String(clientesCount)} color={kpiColors[1]} />
        <Kpi label="Facturas" value={String(facturasCount)} color={kpiColors[2]} />
        <Kpi label="Líneas" value={String(sorted.length)} color={kpiColors[3]} />
      </div>
      <CardHeader>
        <strong>Detalle de facturación</strong>
        <span style={{ color: '#8ea0c4' }}>{sorted.length} línea{sorted.length === 1 ? '' : 's'}</span>
        <span style={{ marginLeft: 'auto' }} />
        <button style={excelBtn} onClick={() => exportXlsx('facturacion_detalle.xlsx', [
          ['Cliente', 'CUIT', 'Ejecutivo', 'Período', 'Fecha Factura', 'N° Factura', 'Cond. Venta', 'Colaborador', 'Legajo', 'CC Descripción', 'Moneda', 'Cantidad', 'Precio Unitario', 'Total Neto', 'OC', 'Leyenda'],
          ...sorted.map(r => [
            nombreCliente(r), r.cuit || '', r.ejecutivo || '', r.periodo ? mesLabel(periodoKey(r)) : '',
            fmtFecha(r.fecha_factura), r.n_factura || '', r.cond_venta || '', r.colaborador || '', r.legajo || '',
            nombreCc(r), monedaFila(r), r.cantidad || 0, r.precio_unitario, r.total_neto,
            r.oc || '', r.leyenda || '',
          ]),
        ])}>↓ Excel</button>
        {chipsFiltro.length > 0 && <button style={clearBtn} onClick={clearFilters}>✕ Limpiar filtros</button>}
      </CardHeader>
      {chipsFiltro.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '12px 16px 0' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#8ea0c4', whiteSpace: 'nowrap' }}>🔎 Filtros activos:</span>
          {chipsFiltro.map(c => (
            <span key={c.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0a1630', border: '1px solid rgba(76,180,230,0.4)', color: '#89bde6', borderRadius: 999, padding: '4px 6px 4px 12px', fontSize: 12, fontWeight: 600, maxWidth: 280 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.texto}</span>
              <button onClick={c.quitar} aria-label={`Quitar ${c.texto}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'transparent', color: '#b6c4de', fontSize: 14, lineHeight: 1, cursor: 'pointer', flexShrink: 0 }}>×</button>
            </span>
          ))}
          <button onClick={clearFilters} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#8ea0c4', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Limpiar todos</button>
        </div>
      )}
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
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#8ea0c4', fontSize: 13 }}>No se encontraron resultados con estos filtros</td></tr>
              ) : sorted.map(r => {
                const isOpen = openRows.has(r.id)
                const ec = execColor(r.ejecutivo || '')
                const moneda = monedaFila(r)
                return (
                  <Fragment key={r.id}>
                    <tr onClick={() => toggleRow(r.id)} style={{ cursor: 'pointer' }}>
                      <Td>{isOpen ? '⌄' : '›'}</Td>
                      <Td>
                        {empresaActiva === 'all' && <span className={`fi fi-${flagEmpresa(r.empresa, moneda)}`} style={{ marginRight: 6, borderRadius: 2, verticalAlign: 'middle' }} />}
                        <strong>{nombreCliente(r)}</strong>
                        {r.cuit && <div style={{ fontSize: 10, color: '#8ea0c4', fontFamily: 'monospace', marginTop: 2 }}>{r.cuit}</div>}
                      </Td>
                      <Td>{r.ejecutivo ? <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: ec.bg, color: ec.text, border: `1px solid ${ec.bd}`, whiteSpace: 'nowrap' }}>{r.ejecutivo}</span> : '-'}</Td>
                      <Td>{r.periodo ? mesLabel(periodoKey(r)) : '-'}</Td>
                      <Td>{fmtFecha(r.fecha_factura)}</Td>
                      <Td>{r.n_factura || '-'}</Td>
                      <Td>{nombreCc(r)}</Td>
                      <Td right>
                        <strong>{fmtMoney(r.total_neto, moneda)}</strong>
                        <div style={{ fontSize: 10, color: '#8ea0c4', marginTop: 2, whiteSpace: 'nowrap' }}>
                          {r.cantidad.toLocaleString('es-AR', { maximumFractionDigits: 2 })} u. × {fmtMoney(r.precio_unitario, moneda)}
                        </div>
                      </Td>
                      <Td style={{ cursor: 'default' }} onClick={e => e.stopPropagation()}>
                        <button style={pdfBtnStyle(!!r.n_factura)} disabled={!r.n_factura} onClick={() => onAbrirPdf(r)}>PDF Factura</button>
                      </Td>
                    </tr>
                    {isOpen && (
                      <tr style={{ background: '#0e1e39' }}>
                        <td colSpan={9} style={{ padding: '12px 16px 14px 34px', borderBottom: '1px solid rgba(76,177,230,0.4)' }}>
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
      <div style={{ color: '#8ea0c4', textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 9.5, fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ color: '#e7eefb' }}>{value || '-'}</div>
    </div>
  )
}

function MultiSelect({ options, selected, onChange, placeholderAll, formatLabel }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; placeholderAll: string; formatLabel?: (v: string) => string }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 270 })
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const fmt = formatLabel || ((v: string) => v)

  const actualizarCoords = () => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect) setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }

  useEffect(() => {
    if (!open) return
    actualizarCoords()
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', actualizarCoords, true)
    window.addEventListener('resize', actualizarCoords)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', actualizarCoords, true)
      window.removeEventListener('resize', actualizarCoords)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  let label = placeholderAll
  if (selected.length === 1) { const l = fmt(selected[0]); label = l.length > 16 ? l.slice(0, 15) + '…' : l }
  else if (selected.length > 1) label = `${selected.length} seleccionados`

  const visible = search ? options.filter(o => normalizar(fmt(o)).includes(normalizar(search))) : options
  const toggle = (opt: string) => onChange(selected.includes(opt) ? selected.filter(v => v !== opt) : [...selected, opt])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={mselBtn}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: 8, color: '#8ea0c4' }}>▾</span>
      </button>
      {open && createPortal(
        <div ref={panelRef} style={{ ...mselPanel, position: 'fixed', top: coords.top, left: coords.left, width: Math.max(coords.width, 220) }}>
          {options.length > 8 && <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={mselSearch} />}
          <div style={mselActions}>
            <span onClick={() => onChange(options)}>Todos</span>
            <span onClick={() => onChange([])}>Limpiar</span>
          </div>
          {visible.length === 0 ? <div style={{ padding: 6, fontSize: 11, color: '#8ea0c4' }}>Sin resultados</div> : visible.map(opt => (
            <label key={opt} style={mselOption}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmt(opt)}</span>
            </label>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

function Segmented({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'inline-flex', maxWidth: '100%', border: '1px solid rgba(76,180,230,0.4)', borderRadius: 8, overflow: 'hidden', background: '#11223f' }}>{children}</div>
}

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ border: 0, borderRight: '1px solid rgba(76,180,230,0.4)', background: active ? '#3b6fd9' : 'transparent', color: active ? '#fff' : '#e7eefb', padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', minWidth: 72, whiteSpace: 'nowrap', flexShrink: 0 }}>{children}</button>
}

function Card({ children, noPadding = false }: { children: React.ReactNode; noPadding?: boolean }) {
  return <section style={{ width: '100%', minWidth: 0, background: '#11223f', border: '1px solid rgba(76,176,230,0.4)', borderRadius: 8, padding: noPadding ? 0 : 16, boxShadow: '0 1px 4px rgba(14,74,103,.1)', overflow: 'hidden' }}>{children}</section>
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid rgba(76,177,230,0.4)', background: '#11223f' }}>{children}</div>
}

function CardTitle({ title, badge }: { title: string; badge?: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 15, fontWeight: 800 }}>{title}{badge && <span style={{ background: '#0e1e39', color: '#7bd5f4', border: '1px solid rgba(76,180,230,0.4)', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 800 }}>{badge}</span>}</div>
}

function Kpi({ label, value, color = '#5b8def' }: { label: string; value: string; color?: string }) {
  return <div style={{ background: '#11223f', border: '1px solid rgba(76,176,230,0.4)', borderTop: `3px solid ${color}`, borderRadius: 8, padding: '13px 16px', boxShadow: '0 1px 4px rgba(14,74,103,.1)' }}><div style={{ color: '#8ea0c4', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div><div style={{ color: '#7bd5f4', marginTop: 7, fontFamily: 'monospace', fontSize: 17, fontWeight: 800 }}>{value}</div></div>
}

function Insight({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return <div style={{ background: bg, border: `1px solid ${color}`, color: '#e7eefb', borderRadius: 8, padding: '10px 12px', fontSize: 13, lineHeight: 1.45 }}>{children}</div>
}

function Th({ children, right = false, onClick }: { children?: React.ReactNode; right?: boolean; onClick?: () => void }) {
  return <th onClick={onClick} style={{ padding: '8px 10px', color: '#8ea0c4', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: right ? 'right' : 'left', borderBottom: '1px solid rgba(76,177,230,0.4)', cursor: onClick ? 'pointer' : 'default', userSelect: 'none' }}>{children}</th>
}

function Td({ children, right = false, style = {}, onClick, onClickCapture }: { children: React.ReactNode; right?: boolean; style?: React.CSSProperties; onClick?: (e: React.MouseEvent) => void; onClickCapture?: (e: React.MouseEvent) => void }) {
  return <td onClick={onClick} onClickCapture={onClickCapture} style={{ padding: '8px 10px', color: '#e7eefb', fontSize: 13, textAlign: right ? 'right' : 'left', borderBottom: '1px solid rgba(76,177,230,0.4)', ...style }}>{children}</td>
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


const inputStyle: React.CSSProperties = { width: 340, background: '#11223f', border: '1px solid rgba(76,177,230,0.4)', borderRadius: 8, color: '#e7eefb', fontSize: 13, padding: '8px 10px', outline: 'none' }
const emptyStyle: React.CSSProperties = { background: '#11223f', border: '1.5px dashed rgba(76,176,230,0.4)', borderRadius: 10, padding: '78px 20px', textAlign: 'center', color: '#8ea0c4' }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const notice: React.CSSProperties = { border: '1px solid rgba(76,180,230,0.4)', background: '#0e1e39', borderRadius: 8, padding: 12, color: '#e7eefb', lineHeight: 1.4, fontSize: 13 }
const excelBtn: React.CSSProperties = { marginLeft: 'auto', border: '1px solid rgba(76,180,230,0.4)', background: '#11223f', color: '#7bd5f4', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }
const clearBtn: React.CSSProperties = { border: '1px solid rgba(76,180,230,0.4)', background: '#11223f', color: '#8ea0c4', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }
const filterInputStyle: React.CSSProperties = { width: '100%', border: '1px solid rgba(76,177,230,0.4)', borderRadius: 6, padding: '4px 6px', fontSize: 11, background: '#11223f', color: '#e7eefb', outline: 'none' }
const pdfBtnStyle = (activo: boolean): React.CSSProperties => ({
  fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 6, whiteSpace: 'nowrap',
  border: `1px solid ${activo ? '#2c4672' : '#24395f'}`,
  background: activo ? '#0e1e39' : '#11223f',
  color: activo ? '#7bd5f4' : '#8ea0c4',
  cursor: activo ? 'pointer' : 'default',
})
const mselBtn: React.CSSProperties = { border: '1px solid rgba(76,177,230,0.4)', borderRadius: 6, padding: '4px 8px', fontSize: 11, background: '#11223f', color: '#e7eefb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, width: '100%', minWidth: 90, justifyContent: 'space-between' }
const mselPanel: React.CSSProperties = { position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: '#11223f', border: '1px solid rgba(76,176,230,0.4)', borderRadius: 8, boxShadow: '0 6px 24px rgba(10,22,40,0.14)', zIndex: 50, width: 270, maxWidth: 'calc(100vw - 40px)', maxHeight: 260, overflowY: 'auto', padding: 6 }
const mselSearch: React.CSSProperties = { width: '100%', border: '1px solid rgba(76,177,230,0.4)', borderRadius: 6, padding: '5px 8px', fontSize: 11.5, color: '#e7eefb', background: '#11223f', outline: 'none', marginBottom: 6 }
const mselActions: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '2px 6px 6px', borderBottom: '1px solid rgba(76,177,230,0.4)', marginBottom: 4, fontSize: 10.5, color: '#7ecef1', fontWeight: 700, cursor: 'pointer' }
const mselOption: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', fontSize: 12, cursor: 'pointer', borderRadius: 5, color: '#b6c4de' }
