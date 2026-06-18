import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useComprobantes } from './hooks/useComprobantes'
import { useHistorial } from './hooks/useHistorial'
import { SubirReporte } from './components/SubirReporte'
import { Login } from './components/Login'
import { EJECUTIVOS } from './data/ejecutivos'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'

const COLORES_EXEC: Record<string, { bg: string; color: string; initials: string }> = {
  'Lucas Roca':            { bg: '#1d4170', color: '#fff', initials: 'LR' },
  'Joaquin Ramirez':       { bg: '#065f46', color: '#fff', initials: 'JR' },
  'Julieta Salvucci':      { bg: '#4c1d95', color: '#fff', initials: 'JS' },
  'Emiliano Angelinetta':  { bg: '#92400e', color: '#fff', initials: 'EA' },
  'Leonardo Nocera':       { bg: '#1e3a5f', color: '#fff', initials: 'LN' },
  'Maria Cadarso':         { bg: '#831843', color: '#fff', initials: 'MC' },
  'Fernanda Dugini':       { bg: '#14532d', color: '#fff', initials: 'FD' },
  'Pablo Cruz':            { bg: '#7c2d12', color: '#fff', initials: 'PC' },
  'Matias Gimenez':        { bg: '#0f4c75', color: '#fff', initials: 'MG' },
}

type Vista = 'dashboard' | 'todos' | 'mora' | 'criticas' | 'historial' | 'clientes'

function getExecColor(nombre: string) {
  return COLORES_EXEC[nombre] || { bg: '#374151', color: '#fff', initials: nombre?.slice(0, 2).toUpperCase() || '?' }
}

const SEL: React.CSSProperties = {
  padding: '7px 12px', borderRadius: '8px', border: '1px solid #dde3f0',
  fontSize: '12px', color: '#0d1b38', background: '#fff', outline: 'none',
  cursor: 'pointer', minWidth: '160px',
}
const BTN_LIMPIAR: React.CSSProperties = {
  padding: '7px 14px', borderRadius: '8px', border: '1px solid #fecaca',
  fontSize: '12px', color: '#dc2626', background: '#fff5f5', cursor: 'pointer', fontWeight: 600,
}

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Login />

  return <AppInterna />
}

function AppInterna() {
  const { data, loading, error: errorComprobantes, refetch, asignarEjecutivo, updateEjecutivoLocal } = useComprobantes()
  const { data: historial, loading: loadingHistorial, error: errorHistorial, refetch: refetchHistorial } = useHistorial()
  const [vista, setVista] = useState<Vista>('dashboard')
  const [tableKey, setTableKey] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [ejecutivoSeleccionado, setEjecutivoSeleccionado] = useState<string | null>(null)
  const [sidebarAbierto, setSidebarAbierto] = useState(true)
  const [modalComprobante, setModalComprobante] = useState<any | null>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [pdfNoEncontrado, setPdfNoEncontrado] = useState('')

  const mainRef = useRef<HTMLDivElement>(null)
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }) }, [vista])

  // asignación de ejecutivo
  const [errorAsignacion, setErrorAsignacion] = useState('')
  const [localEjecutivos, setLocalEjecutivos] = useState<Record<string, string>>({})

  // manejo de errores de carga
  const [errorCarga, setErrorCarga] = useState('')
  useEffect(() => {
    if (errorCarga) {
      const timer = setTimeout(() => setErrorCarga(''), 5000)
      return () => clearTimeout(timer)
    }
  }, [errorCarga])

  // filtros – tabla (todos / mora / criticas)
  const [filtroClienteTabla, setFiltroClienteTabla] = useState('')
  const [filtroEstadoTabla, setFiltroEstadoTabla] = useState('')

  // filtros – historial
  const [filtroEjecutivoHistorial, setFiltroEjecutivoHistorial] = useState('')
  const [filtroClienteHistorial, setFiltroClienteHistorial] = useState('')

  // filtros – clientes
  const [filtroEjecutivoClientes, setFiltroEjecutivoClientes] = useState('')
  const [filtroEstadoClientes, setFiltroEstadoClientes] = useState('')

  const ejecutivos = Array.from(new Set(data.map(r => r.ejecutivo).filter(Boolean).filter(e => e !== 'Sin asignar'))) as string[]

  // ── datos filtrados para vistas de tabla ──────────────────────────────────
  const esSinAsignar = (ej: string | null | undefined) => !ej || ej === 'Sin asignar'

  const filtrados = data.filter(r => {
    if (ejecutivoSeleccionado === 'Sin asignar') {
      if (!esSinAsignar(r.ejecutivo)) return false
    } else if (ejecutivoSeleccionado && r.ejecutivo !== ejecutivoSeleccionado) return false
    if (filtroClienteTabla && r.nombre_cliente !== filtroClienteTabla) return false
    if (filtroEstadoTabla === 'sinvencer' && r.dias_mora > 0) return false
    if (filtroEstadoTabla === 'mora'    && r.dias_mora <= 0) return false
    if (filtroEstadoTabla === '1-30'   && !(r.dias_mora >= 1 && r.dias_mora <= 30)) return false
    if (filtroEstadoTabla === '31-60'  && !(r.dias_mora > 30 && r.dias_mora <= 60)) return false
    if (filtroEstadoTabla === '60+'    && r.dias_mora <= 60) return false
    if (vista === 'mora'     && r.dias_mora <= 0) return false
    if (vista === 'criticas' && r.dias_mora <= 60) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return (
        r.nombre_cliente?.toLowerCase().includes(q) ||
        r.comprobante?.toLowerCase().includes(q) ||
        r.ejecutivo?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const dataSel     = ejecutivoSeleccionado ? data.filter(r => r.ejecutivo === ejecutivoSeleccionado) : data
  const totalVencido = dataSel.filter(r => r.dias_mora > 0).reduce((s, r) => s + r.monto, 0)
  const maxMora      = dataSel.reduce((mx, r) => r.dias_mora > mx.dias ? { dias: r.dias_mora, cliente: r.nombre_cliente } : mx, { dias: 0, cliente: '' })
  const criticas     = dataSel.filter(r => r.dias_mora > 60).length
  const carteraTotal = dataSel.reduce((s, r) => s + r.monto, 0)

  const dashboardPorEjecutivo = ejecutivos
    .map(exec => {
      const registros = data.filter(r => r.ejecutivo === exec)
      const vencido   = registros.filter(r => r.dias_mora > 0).reduce((s, r) => s + r.monto, 0)
      const total     = registros.reduce((s, r) => s + r.monto, 0)
      const moraMax   = registros.reduce((mx, r) => Math.max(mx, r.dias_mora), 0)
      return { exec, registros, vencido, total, moraMax }
    })
    .sort((a, b) => b.vencido - a.vencido)

  // ── mapa de clientes (usado en dashboard y vista clientes) ────────────────
  type ClienteRow = { cliente: string; ejecutivo: string; monto: number; vencido: number; facturas: number; moraMax: number }
  const clientesMap = data.reduce<Map<string, ClienteRow>>((acc, r) => {
    const actual = acc.get(r.nombre_cliente) || {
      cliente: r.nombre_cliente, ejecutivo: r.ejecutivo || 'Sin asignar',
      monto: 0, vencido: 0, facturas: 0, moraMax: 0,
    }
    actual.monto   += r.monto
    actual.vencido += r.dias_mora > 0 ? r.monto : 0
    actual.facturas += 1
    actual.moraMax  = Math.max(actual.moraMax, r.dias_mora)
    acc.set(r.nombre_cliente, actual)
    return acc
  }, new Map<string, ClienteRow>())

  const sinAsignarClientesCount = Array.from(clientesMap.values())
    .filter(c => c.ejecutivo === 'Sin asignar').length

  const dashboardPorCliente = Array.from(clientesMap.values())
    .sort((a, b) => b.vencido - a.vencido)
    .slice(0, 8)

  const clientesFiltrados = Array.from(clientesMap.values())
    .filter(c => {
      if (filtroEjecutivoClientes && c.ejecutivo !== filtroEjecutivoClientes) return false
      if (filtroEstadoClientes === 'sinmora'  && c.vencido > 0)    return false
      if (filtroEstadoClientes === 'mora'     && c.vencido <= 0)   return false
      if (filtroEstadoClientes === 'critica'  && c.moraMax <= 60)  return false
      return true
    })
    .sort((a, b) => b.vencido - a.vencido)

  const rangosMora = [
    { label: 'Sin vencer', total: data.filter(r => r.dias_mora <= 0).reduce((s, r) => s + r.monto, 0), color: '#059669' },
    { label: '1-30 días',  total: data.filter(r => r.dias_mora >= 1 && r.dias_mora <= 30).reduce((s, r) => s + r.monto, 0), color: '#2563eb' },
    { label: '31-60 días', total: data.filter(r => r.dias_mora > 30 && r.dias_mora <= 60).reduce((s, r) => s + r.monto, 0), color: '#d97706' },
    { label: '+60 días',   total: data.filter(r => r.dias_mora > 60).reduce((s, r) => s + r.monto, 0), color: '#dc2626' },
  ]

  // ── historial filtrado ────────────────────────────────────────────────────
  const historialFiltrado = historial.filter(r => {
    if (filtroEjecutivoHistorial && r.ejecutivo !== filtroEjecutivoHistorial) return false
    if (filtroClienteHistorial   && r.cliente   !== filtroClienteHistorial)   return false
    return true
  })

  // ── helpers ───────────────────────────────────────────────────────────────
  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

  const fmtFecha = (fecha: string) => {
    if (!fecha) return '-'
    const [y, m, d] = fecha.split('-')
    return `${d}/${m}/${y}`
  }

  const moraBadge = (dias: number) => {
    if (dias <= 0)  return { label: 'Sin vencer',   color: '#059669', bg: '#d1fae5' }
    if (dias <= 30) return { label: `${dias}d`,     color: '#059669', bg: '#d1fae5' }
    if (dias <= 60) return { label: `${dias}d`,     color: '#d97706', bg: '#fef3c7' }
    if (dias <= 90) return { label: `${dias}d`,     color: '#dc2626', bg: '#fee2e2' }
    return           { label: `⚠ ${dias}d`,        color: '#7c3aed', bg: '#ede9fe' }
  }

  const pdfUrl = (comprobante: string) =>
    `${import.meta.env.VITE_SUPABASE_STORAGE_URL}/${encodeURIComponent(comprobante)}.pdf`

  const abrirPdf = async (row: any) => {
    const url = pdfUrl(row.comprobante || row.comprobante_numero)
    try {
      const res = await fetch(url, { method: 'HEAD' })
      if (!res.ok) {
        setPdfNoEncontrado(row.comprobante || row.comprobante_numero)
        setTimeout(() => setPdfNoEncontrado(''), 4000)
        return
      }
    } catch {
      setPdfNoEncontrado(row.comprobante || row.comprobante_numero)
      setTimeout(() => setPdfNoEncontrado(''), 4000)
      return
    }
    setModalComprobante(row)
  }

  const copiarLink = () => {
    navigator.clipboard.writeText(pdfUrl(modalComprobante.comprobante))
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2000)
  }

  const cerrarModal = () => { setModalComprobante(null); setLinkCopiado(false) }

  // ── asignación de ejecutivo ───────────────────────────────────────────────
  const handleAsignarEjecutivo = async (cliente: string, nuevoEjecutivo: string, viejoEjecutivo: string) => {
    try {
      await asignarEjecutivo(cliente, nuevoEjecutivo)
    } catch {
      setLocalEjecutivos(prev => ({ ...prev, [cliente]: viejoEjecutivo }))
      updateEjecutivoLocal(cliente, viejoEjecutivo)
      setErrorAsignacion(`No se pudo asignar el ejecutivo a "${cliente}". Intentá de nuevo.`)
      setTimeout(() => setErrorAsignacion(''), 5000)
    }
  }

  // ── exportar xlsx (solo filas visibles) ───────────────────────────────────
  const exportar = () => {
    const hoy = new Date().toISOString().slice(0, 10)
    let rows: object[]
    let sheet: string
    let file: string

    if (vista === 'historial') {
      rows  = historialFiltrado.map(r => ({
        'Comprobante': r.comprobante_numero,
        'Cliente':     r.cliente,
        'Ejecutivo':   r.ejecutivo || 'Sin asignar',
        'Monto':       r.monto,
        'Fecha cobro': r.fecha_cobro,
      }))
      sheet = 'Historial'; file = `historial_${hoy}.xlsx`
    } else if (vista === 'clientes') {
      rows  = clientesFiltrados.map(c => ({
        'Cliente':            c.cliente,
        'Ejecutivo':          c.ejecutivo,
        'Cartera total':      c.monto,
        'Total vencido':      c.vencido,
        'Facturas':           c.facturas,
        'Mora máxima (días)': c.moraMax,
      }))
      sheet = 'Clientes'; file = `clientes_${hoy}.xlsx`
    } else {
      rows  = filtrados.map(r => ({
        'Comprobante': r.comprobante,
        'Cliente':     r.nombre_cliente,
        'Ejecutivo':   r.ejecutivo || 'Sin asignar',
        'Condición':   r.condicion || '',
        'Vencimiento': r.fecha_vencimiento,
        'Monto':       r.monto,
        'Días mora':   r.dias_mora,
      }))
      sheet = 'Comprobantes'; file = `comprobantes_${hoy}.xlsx`
    }

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheet)
    XLSX.writeFile(wb, file)
  }

  // ── booleanos de vista ────────────────────────────────────────────────────
  const esDashboard = vista === 'dashboard'
  const esHistorial = vista === 'historial'
  const esClientes  = vista === 'clientes'
  const esTabla     = !esDashboard && !esHistorial && !esClientes

  // opciones de clientes para dropdowns
  const clientesTablaOpts    = [...new Set(data.map(r => r.nombre_cliente).filter(Boolean))].sort() as string[]
  const clientesHistorialOpts = [...new Set(historial.map(r => r.cliente).filter(Boolean))].sort() as string[]

  const hayFiltrosTabla     = !!(ejecutivoSeleccionado || filtroClienteTabla || filtroEstadoTabla)
  const hayFiltrosHistorial = !!(filtroEjecutivoHistorial || filtroClienteHistorial)
  const hayFiltrosClientes  = !!(filtroEjecutivoClientes || filtroEstadoClientes)

  const limpiarFiltrosTabla     = () => { setEjecutivoSeleccionado(null); setFiltroClienteTabla(''); setFiltroEstadoTabla('') }
  const limpiarFiltrosHistorial = () => { setFiltroEjecutivoHistorial(''); setFiltroClienteHistorial('') }
  const limpiarFiltrosClientes  = () => { setFiltroEjecutivoClientes(''); setFiltroEstadoClientes('') }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', fontFamily: 'Inter, sans-serif', background: '#eef2f8', overflow: 'hidden' }}>

      {/* ── MODAL PDF ─────────────────────────────────────────────────────── */}
      {modalComprobante && (
        <div onClick={cerrarModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ background: '#0a1628', borderRadius: '16px 16px 0 0', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>📄</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{modalComprobante.comprobante}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{modalComprobante.nombre_cliente} · Supabase Storage</div>
              </div>
              <button onClick={cerrarModal} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', color: '#fff', fontSize: '16px', flexShrink: 0 }}>✕</button>
            </div>
            <div style={{ background: '#f4f6fb', padding: '16px' }}>
              <iframe src={pdfUrl(modalComprobante.comprobante)} style={{ width: '100%', height: '380px', border: 'none', borderRadius: '8px', background: '#fff' }} title="PDF" />
            </div>
            <div style={{ padding: '16px 24px 24px' }}>
              {modalComprobante.dias_mora > 0 && (
                <div style={{ background: '#fee2e2', color: '#dc2626', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, marginBottom: '14px', display: 'inline-block' }}>
                  EN MORA · {modalComprobante.dias_mora} días
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                {[
                  { label: 'CLIENTE',     value: modalComprobante.nombre_cliente },
                  { label: 'EJECUTIVO',   value: modalComprobante.ejecutivo || 'Sin asignar' },
                  { label: 'EMISIÓN',     value: fmtFecha(modalComprobante.fecha_emision) },
                  { label: 'VENCIMIENTO', value: fmtFecha(modalComprobante.fecha_vencimiento) },
                  { label: 'MONTO',       value: fmt(modalComprobante.monto) },
                  { label: 'MORA',        value: modalComprobante.dias_mora > 0 ? `${modalComprobante.dias_mora} días` : 'Sin vencer' },
                ].map((item, idx) => (
                  <div key={`modal-${item.label}-${idx}`} style={{ background: '#f8faff', borderRadius: '10px', padding: '12px 16px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>{item.label}</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#0d1b38' }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <a href={pdfUrl(modalComprobante.comprobante)} download style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#2554a0', color: '#fff', padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>⬇ Descargar</a>
                <button onClick={copiarLink} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: linkCopiado ? '#d1fae5' : '#f0f4ff', color: linkCopiado ? '#059669' : '#2554a0', padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, border: linkCopiado ? '1px solid #6ee7b7' : '1px solid transparent', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                  {linkCopiado ? '✅ Copiado!' : '🔗 Copiar link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SIDEBAR ───────────────────────────────────────────────────────── */}
      <aside style={{ width: sidebarAbierto ? '260px' : '0px', overflow: 'hidden', transition: 'width 0.25s ease', background: 'linear-gradient(180deg, #081a35 0%, #05101f 100%)', display: 'flex', flexDirection: 'column', flexShrink: 0, boxShadow: '4px 0 24px rgba(0,0,0,0.35)' }}>

        {/* logo */}
        <div style={{ padding: '20px 16px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', minHeight: '40px', flex: 1, marginRight: '10px' }}>
              <img
                src="/asap-logo.png"
                alt="ASAP Consulting"
                style={{ maxHeight: '48px', maxWidth: '180px', objectFit: 'contain', display: 'block' }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.nextSibling as HTMLElement).style.display = 'block' }}
              />
              <span style={{ display: 'none', color: '#fff', fontWeight: 800, fontSize: '13px', letterSpacing: '-0.3px' }}>ASAP Consulting</span>
            </div>
            <div style={{ width: '34px', height: '34px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }} onClick={() => setSidebarAbierto(false)}>
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><rect y="0" width="16" height="2" rx="1" fill="rgba(255,255,255,0.5)"/><rect y="5" width="11" height="2" rx="1" fill="rgba(255,255,255,0.5)"/><rect y="10" width="7" height="2" rx="1" fill="rgba(255,255,255,0.5)"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '1.4px' }}>Cobranzas</div>
        </div>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 20px 14px' }} />

        {/* vistas */}
        <div style={{ padding: '0 12px 8px' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', padding: '0 8px', marginBottom: '6px' }}>Vistas</div>
          {([
            { key: 'dashboard', label: 'Dashboard',              count: data.length,                                  badgeStyle: 'blue' },
            { key: 'todos',     label: 'Todos los comprobantes', count: data.length,                                  badgeStyle: 'blue' },
            { key: 'mora',      label: 'En mora',                count: data.filter(r => r.dias_mora > 0).length,    badgeStyle: 'red'  },
            { key: 'criticas',  label: 'Críticas +60d',          count: data.filter(r => r.dias_mora > 60).length,   badgeStyle: 'red'  },
            { key: 'historial', label: 'Historial cobrado',      count: historial.length,                             badgeStyle: 'green'},
            { key: 'clientes',  label: 'Listado de clientes',    count: clientesMap.size,                             badgeStyle: 'gray' },
          ] as { key: string; label: string; count: number; badgeStyle: 'blue' | 'red' | 'green' | 'gray' }[]).map(item => {
            const isActive = vista === item.key
            const badgeColors = {
              blue:  { bg: 'rgba(37,84,160,0.55)',  text: '#93b8ff' },
              red:   { bg: 'rgba(220,38,38,0.35)',  text: '#fca5a5' },
              green: { bg: 'rgba(5,150,105,0.25)',  text: '#6ee7b7' },
              gray:  { bg: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.45)' },
            }
            const bc = badgeColors[item.badgeStyle]
            return (
              <div
                key={item.key}
                onClick={() => {
                  setVista(item.key as Vista)
                  setEjecutivoSeleccionado(null)
                  setFiltroClienteTabla(''); setFiltroEstadoTabla('')
                  setFiltroEjecutivoHistorial(''); setFiltroClienteHistorial('')
                  setFiltroEjecutivoClientes(''); setFiltroEstadoClientes('')
                  if (item.key === 'historial') refetchHistorial()
                  else refetch()
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '9px', cursor: 'pointer', background: isActive ? 'rgba(37,84,160,0.4)' : 'transparent', marginBottom: '1px', transition: 'background 0.15s' }}
              >
                <span style={{ fontSize: '13px', color: isActive ? '#fff' : 'rgba(255,255,255,0.48)', flex: 1, fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
                {item.count > 0 && (
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', background: bc.bg, color: bc.text, letterSpacing: '0.2px' }}>
                    {item.count}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '8px 20px 14px' }} />

        {/* ejecutivos */}
        <div style={{ padding: '0 12px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', padding: '0 8px', marginBottom: '6px' }}>Ejecutivos</div>

          <div onClick={() => setEjecutivoSeleccionado(null)} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 10px', borderRadius: '9px', cursor: 'pointer', background: !ejecutivoSeleccionado ? 'rgba(255,255,255,0.1)' : 'transparent', marginBottom: '2px', transition: 'background 0.15s' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>✦</div>
            <span style={{ color: !ejecutivoSeleccionado ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: '13px', flex: 1, fontWeight: !ejecutivoSeleccionado ? 600 : 400 }}>Todos</span>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}>{data.length}</span>
          </div>

          {sinAsignarClientesCount > 0 && (() => {
            const isActive = ejecutivoSeleccionado === 'Sin asignar'
            return (
              <div onClick={() => setEjecutivoSeleccionado(isActive ? null : 'Sin asignar')} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 10px', borderRadius: '9px', marginBottom: '2px', cursor: 'pointer', background: isActive ? 'rgba(245,158,11,0.15)' : 'transparent', transition: 'background 0.15s' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>⚠</div>
                <span style={{ color: '#fcd34d', fontSize: '13px', flex: 1, fontWeight: isActive ? 600 : 400 }}>Sin asignar</span>
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', background: 'rgba(245,158,11,0.2)', color: '#fcd34d' }}>{sinAsignarClientesCount}</span>
              </div>
            )
          })()}

          {ejecutivos.map(exec => {
            const ec = getExecColor(exec)
            const count     = data.filter(r => r.ejecutivo === exec).length
            const moraCount = data.filter(r => r.ejecutivo === exec && r.dias_mora > 0).length
            const isActive  = ejecutivoSeleccionado === exec
            return (
              <div key={exec} onClick={() => setEjecutivoSeleccionado(exec)} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 10px', borderRadius: '9px', cursor: 'pointer', background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent', marginBottom: '2px', transition: 'background 0.15s' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: ec.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>{ec.initials}</div>
                <span style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.55)', fontSize: '12px', flex: 1, fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{exec}</span>
                {moraCount > 0 && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f87171', flexShrink: 0 }} />}
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}>{count}</span>
              </div>
            )
          })}
        </div>

        {/* footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399' }} />
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>Período hasta 30/03/2026</span>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '11px', color: 'rgba(255,255,255,0.4)', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}
          >
            Salir
          </button>
        </div>
      </aside>

      {/* ── MAIN ──────────────────────────────────────────────────────────── */}
      <main ref={mainRef} style={{ flex: 1, minWidth: 0, padding: '28px 32px', overflowY: 'auto', background: '#eef2f8' }}>

        {(errorCarga || errorComprobantes || errorHistorial) && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 16px', marginBottom: '14px', fontSize: '13px', color: '#dc2626', fontWeight: 500 }}>
            ⚠ {errorCarga || errorComprobantes || errorHistorial}
          </div>
        )}

        {pdfNoEncontrado && (
          <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 16px', marginBottom: '14px', fontSize: '13px', color: '#92400e', fontWeight: 500 }}>
            ⚠ Factura <strong>{pdfNoEncontrado}</strong> no subida a la base de datos.
          </div>
        )}

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {!sidebarAbierto && (
              <button onClick={() => setSidebarAbierto(true)} style={{ background: '#0a1628', border: 'none', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', color: '#fff', fontSize: '16px', marginRight: '12px' }}>≡</button>
            )}
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#0d1b38', margin: 0 }}>
                {esDashboard ? 'Dashboard ejecutivo'
                  : esHistorial ? 'Historial cobrado'
                  : esClientes  ? 'Listado de clientes'
                  : ejecutivoSeleccionado || 'Todos los comprobantes'}
              </h1>
              <p style={{ color: '#7a8fbb', fontSize: '13px', margin: '2px 0 0' }}>· Al {new Date().toLocaleDateString('es-AR')}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {esTabla && (
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#7a8fbb', fontSize: '13px' }}>🔍</span>
                <input type="text" placeholder="Buscar cliente o factura..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid #dde3f0', fontSize: '13px', width: '220px', outline: 'none', color: '#0d1b38', background: '#fff' }} />
              </div>
            )}
            {!esDashboard && (
              <button onClick={exportar} style={{ background: '#2554a0', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                ↗ Exportar .xlsx
              </button>
            )}
          </div>
        </div>

        <SubirReporte onActualizado={() => {
          setTimeout(() => {
            setTableKey(prev => prev + 1)
            refetch()
            refetchHistorial()
          }, 1500)
        }} />

        {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
        {esDashboard ? (
          <>
            {loading && data.length === 0 ? (
              <div style={{ padding: '80px 20px', textAlign: 'center', color: '#7a8fbb', fontSize: '16px' }}>
                <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #dde3f0', borderTopColor: '#2554a0', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '16px' }} />
                <div>Cargando datos...</div>
              </div>
            ) : (
              <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(220px, 1fr))', gap: '18px', marginBottom: '24px' }}>
              <div onClick={() => setVista('todos')} style={{ background: '#fff', border: '1px solid #d9e2f1', borderTop: '4px solid #2554a0', borderRadius: '8px', padding: '22px', minHeight: '150px', boxShadow: '0 12px 30px rgba(38,63,101,0.07)', cursor: 'pointer', transition: 'box-shadow 0.15s' }} onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 16px 40px rgba(37,84,160,0.18)')} onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 12px 30px rgba(38,63,101,0.07)')}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#7a8fbb', textTransform: 'uppercase', marginBottom: '6px' }}>Cartera total</div>
                <div style={{ fontSize: '30px', fontWeight: 800, color: '#163358', lineHeight: 1.1 }}>{fmt(carteraTotal)}</div>
                <div style={{ fontSize: '11px', color: '#7a8fbb' }}>{data.length} comprobantes activos</div>
              </div>
              <div onClick={() => setVista('mora')} style={{ background: '#fff', border: '1px solid #d9e2f1', borderTop: '4px solid #dc2626', borderRadius: '8px', padding: '22px', minHeight: '150px', boxShadow: '0 12px 30px rgba(38,63,101,0.07)', cursor: 'pointer', transition: 'box-shadow 0.15s' }} onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 16px 40px rgba(220,38,38,0.18)')} onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 12px 30px rgba(38,63,101,0.07)')}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#7a8fbb', textTransform: 'uppercase', marginBottom: '6px' }}>Total vencido</div>
                <div style={{ fontSize: '30px', fontWeight: 800, color: '#dc2626', lineHeight: 1.1 }}>{fmt(totalVencido)}</div>
                <div style={{ fontSize: '11px', color: '#7a8fbb' }}>{data.filter(r => r.dias_mora > 0).length} facturas en mora</div>
              </div>
              <div onClick={() => setVista('mora')} style={{ background: '#fff', border: '1px solid #d9e2f1', borderTop: '4px solid #d97706', borderRadius: '8px', padding: '22px', minHeight: '150px', boxShadow: '0 12px 30px rgba(38,63,101,0.07)', cursor: 'pointer', transition: 'box-shadow 0.15s' }} onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 16px 40px rgba(217,119,6,0.18)')} onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 12px 30px rgba(38,63,101,0.07)')}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#7a8fbb', textTransform: 'uppercase', marginBottom: '6px' }}>Mora máxima</div>
                <div style={{ fontSize: '30px', fontWeight: 800, color: '#d97706', lineHeight: 1.1 }}>{maxMora.dias}d</div>
                <div style={{ fontSize: '11px', color: '#7a8fbb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{maxMora.cliente || '-'}</div>
              </div>
              <div onClick={() => setVista('criticas')} style={{ background: '#fff', border: '1px solid #d9e2f1', borderTop: '4px solid #7c3aed', borderRadius: '8px', padding: '22px', minHeight: '150px', boxShadow: '0 12px 30px rgba(38,63,101,0.07)', cursor: 'pointer', transition: 'box-shadow 0.15s' }} onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 16px 40px rgba(124,58,237,0.18)')} onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 12px 30px rgba(38,63,101,0.07)')}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#7a8fbb', textTransform: 'uppercase', marginBottom: '6px' }}>Críticas +60d</div>
                <div style={{ fontSize: '30px', fontWeight: 800, color: '#7c3aed', lineHeight: 1.1 }}>{criticas}</div>
                <div style={{ fontSize: '11px', color: '#7a8fbb' }}>Requieren gestión prioritaria</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(520px, 1.45fr) minmax(360px, 0.85fr)', gap: '20px', marginBottom: '20px' }}>
              <div style={{ background: '#fff', border: '1px solid #d9e2f1', borderRadius: '8px', overflow: 'hidden', minHeight: '380px', boxShadow: '0 12px 30px rgba(38,63,101,0.06)' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #d9e2f1', background: '#f8faff', fontSize: '14px', fontWeight: 700, color: '#0d1b38' }}>Deuda por ejecutivo</div>
                <div style={{ padding: '22px 20px' }}>
                  {dashboardPorEjecutivo.length === 0 ? (
                    <div style={{ padding: '34px', color: '#7a8fbb', textAlign: 'center' }}>Todavía no hay datos para mostrar</div>
                  ) : dashboardPorEjecutivo.map(item => {
                    const ec  = getExecColor(item.exec)
                    const pct = carteraTotal > 0 ? Math.round((item.total / carteraTotal) * 100) : 0
                    return (
                      <div key={item.exec} style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: ec.bg, color: '#fff', fontSize: '9px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ec.initials}</span>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0d1b38', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.exec}</span>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: item.vencido > 0 ? '#dc2626' : '#059669' }}>{fmt(item.vencido)}</div>
                            <div style={{ fontSize: '10px', color: '#7a8fbb' }}>{item.registros.length} facturas</div>
                          </div>
                        </div>
                        <div style={{ height: '10px', background: '#edf2fb', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: ec.bg }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #d9e2f1', borderRadius: '8px', overflow: 'hidden', minHeight: '380px', boxShadow: '0 12px 30px rgba(38,63,101,0.06)' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #d9e2f1', background: '#f8faff', fontSize: '14px', fontWeight: 700, color: '#0d1b38' }}>Distribución de mora</div>
                <div style={{ padding: '24px 20px' }}>
                  {rangosMora.map(rango => {
                    const pct = carteraTotal > 0 ? Math.round((rango.total / carteraTotal) * 100) : 0
                    return (
                      <div key={rango.label} style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', color: '#3d5278', fontWeight: 600 }}>{rango.label}</span>
                          <span style={{ fontSize: '12px', color: '#0d1b38', fontWeight: 700 }}>{fmt(rango.total)}</span>
                        </div>
                        <div style={{ height: '10px', background: '#edf2fb', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: rango.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #d9e2f1', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 12px 30px rgba(38,63,101,0.06)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #d9e2f1', background: '#f8faff', fontSize: '14px', fontWeight: 700, color: '#0d1b38' }}>Principales clientes con deuda</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8faff', borderBottom: '1px solid #dde3f0' }}>
                    {['Cliente', 'Total', 'Vencido', 'Facturas', 'Mora max.'].map(h => (
                      <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dashboardPorCliente.map(c => (
                    <tr key={c.cliente} style={{ borderBottom: '1px solid #dde3f0' }}>
                      <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 700, color: '#0d1b38' }}>{c.cliente}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}>{fmt(c.monto)}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: c.vencido > 0 ? '#dc2626' : '#059669' }}>{fmt(c.vencido)}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#3d5278' }}>{c.facturas}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#3d5278' }}>{c.moraMax}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              </>
            )}
          </>

        /* ── HISTORIAL ──────────────────────────────────────────────────── */
        ) : esHistorial ? (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={filtroEjecutivoHistorial} onChange={e => setFiltroEjecutivoHistorial(e.target.value)} style={SEL}>
                <option value="">Todos los ejecutivos</option>
                {EJECUTIVOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select value={filtroClienteHistorial} onChange={e => setFiltroClienteHistorial(e.target.value)} style={SEL}>
                <option value="">Todos los clientes</option>
                {clientesHistorialOpts.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {hayFiltrosHistorial && <button onClick={limpiarFiltrosHistorial} style={BTN_LIMPIAR}>✕ Limpiar</button>}
            </div>

            <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #dde3f0', display: 'flex', alignItems: 'center', gap: '8px', background: '#f8faff' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0d1b38' }}>Historial de cobrados</span>
                <span style={{ fontSize: '12px', color: '#7a8fbb' }}>{historialFiltrado.length} registros</span>
                {loadingHistorial && <span style={{ fontSize: '11px', color: '#d97706' }}>Actualizando...</span>}
              </div>
              {loadingHistorial && historial.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#7a8fbb' }}>Cargando...</div>
              ) : historialFiltrado.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#7a8fbb' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
                  <div style={{ fontWeight: 600, marginBottom: '6px' }}>Sin resultados</div>
                  <div style={{ fontSize: '12px' }}>No hay registros para los filtros aplicados.</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8faff', borderBottom: '1px solid #dde3f0' }}>
                      {['Comprobante', 'Cliente', 'Ejecutivo', 'Monto', 'Fecha cobro', 'PDF'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 600, color: '#7a8fbb', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historialFiltrado.map((r) => {
                      const ec = getExecColor(r.ejecutivo)
                      return (
                        <tr key={r.comprobante_id ? `hist-${r.comprobante_id}` : `${r.comprobante_numero}-${r.cliente}`} style={{ borderBottom: '1px solid #dde3f0' }}>
                          <td style={{ padding: '12px 16px', fontSize: '12px', fontFamily: 'monospace', color: '#3d5278' }}>{r.comprobante_numero}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#0d1b38' }}>{r.cliente}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: '20px', background: ec.bg + '20', color: ec.bg }}>
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: ec.bg, flexShrink: 0 }} />
                              {r.ejecutivo || 'Sin asignar'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', color: '#059669' }}>{fmt(r.monto)}</td>
                          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#3d5278' }}>{r.fecha_cobro}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <button onClick={() => abrirPdf({ ...r, comprobante: r.comprobante_numero, nombre_cliente: r.cliente, fecha_emision: null, fecha_vencimiento: null })} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f0f4ff', color: '#2554a0', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                              📄 Ver PDF
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>

        /* ── LISTADO DE CLIENTES ──────────────────────────────────────── */
        ) : esClientes ? (
          <>
            {sinAsignarClientesCount > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>⚠</span>
                <span style={{ fontSize: '13px', color: '#92400e', fontWeight: 500 }}>
                  {sinAsignarClientesCount === 1
                    ? '1 cliente sin ejecutivo asignado'
                    : `${sinAsignarClientesCount} clientes sin ejecutivo asignado`} — asigná desde la tabla de abajo.
                </span>
              </div>
            )}
            {errorAsignacion && (
              <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: 500 }}>⚠ {errorAsignacion}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={filtroEjecutivoClientes} onChange={e => setFiltroEjecutivoClientes(e.target.value)} style={SEL}>
                <option value="">Todos los ejecutivos</option>
                {EJECUTIVOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select value={filtroEstadoClientes} onChange={e => setFiltroEstadoClientes(e.target.value)} style={SEL}>
                <option value="">Todos los estados</option>
                <option value="sinmora">Sin mora</option>
                <option value="mora">Con mora</option>
                <option value="critica">Crítica (+60d)</option>
              </select>
              {hayFiltrosClientes && <button onClick={limpiarFiltrosClientes} style={BTN_LIMPIAR}>✕ Limpiar</button>}
            </div>

            <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #dde3f0', display: 'flex', alignItems: 'center', gap: '8px', background: '#f8faff' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0d1b38' }}>Listado de clientes</span>
                <span style={{ fontSize: '12px', color: '#7a8fbb' }}>{clientesFiltrados.length} clientes</span>
              </div>
              {clientesFiltrados.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#7a8fbb' }}>No hay clientes para los filtros aplicados.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8faff', borderBottom: '1px solid #dde3f0' }}>
                      {['Cliente', 'Ejecutivo', 'Cartera total', 'Total vencido', 'Facturas', 'Mora máx.'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltrados.map(c => {
                      const execEfectivo = localEjecutivos[c.cliente] || c.ejecutivo
                      const ec = getExecColor(execEfectivo)
                      const mb = c.moraMax <= 0
                        ? { label: 'Sin mora',       bg: '#d1fae5', color: '#059669' }
                        : c.moraMax <= 60
                        ? { label: `${c.moraMax}d`,  bg: '#fef3c7', color: '#d97706' }
                        : { label: `⚠ ${c.moraMax}d`, bg: '#ede9fe', color: '#7c3aed' }
                      return (
                        <tr key={c.cliente} style={{ borderBottom: '1px solid #dde3f0' }}>
                          <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, color: '#0d1b38' }}>{c.cliente}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <select
                              value={execEfectivo}
                              onChange={e => {
                                const nuevo = e.target.value
                                const viejo = execEfectivo
                                setLocalEjecutivos(prev => ({ ...prev, [c.cliente]: nuevo }))
                                updateEjecutivoLocal(c.cliente, nuevo)
                                handleAsignarEjecutivo(c.cliente, nuevo, viejo)
                              }}
                              style={{ padding: '4px 8px', borderRadius: '20px', border: `1px solid ${ec.bg}`, fontSize: '11px', fontWeight: 600, color: ec.bg, background: ec.bg + '20', cursor: 'pointer', outline: 'none' }}
                            >
                              {EJECUTIVOS.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', color: '#0d1b38' }}>{fmt(c.monto)}</td>
                          <td style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', color: c.vencido > 0 ? '#dc2626' : '#059669' }}>{fmt(c.vencido)}</td>
                          <td style={{ padding: '14px 16px', fontSize: '12px', color: '#3d5278' }}>{c.facturas}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ background: mb.bg, color: mb.color, padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{mb.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>

        /* ── TABLA (todos / mora / criticas) ─────────────────────────── */
        ) : (
          <>
            {/* barra de filtros */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={ejecutivoSeleccionado || ''} onChange={e => setEjecutivoSeleccionado(e.target.value || null)} style={SEL}>
                <option value="">Todos los ejecutivos</option>
                {EJECUTIVOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select value={filtroClienteTabla} onChange={e => setFiltroClienteTabla(e.target.value)} style={SEL}>
                <option value="">Todos los clientes</option>
                {clientesTablaOpts.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filtroEstadoTabla} onChange={e => setFiltroEstadoTabla(e.target.value)} style={SEL}>
                <option value="">Todos los estados</option>
                <option value="sinvencer">Sin vencer</option>
                <option value="mora">En mora</option>
                <option value="1-30">Mora 1–30 días</option>
                <option value="31-60">Mora 31–60 días</option>
                <option value="60+">Mora +60 días</option>
              </select>
              {hayFiltrosTabla && <button onClick={limpiarFiltrosTabla} style={BTN_LIMPIAR}>✕ Limpiar</button>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
              <div style={{ background: '#fff', border: '1px solid #dde3f0', borderTop: '3px solid #dc2626', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#7a8fbb', textTransform: 'uppercase', marginBottom: '6px' }}>Total vencido</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>{fmt(totalVencido)}</div>
                <div style={{ fontSize: '11px', color: '#7a8fbb' }}>{dataSel.filter(r => r.dias_mora > 0).length} facturas en mora</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #dde3f0', borderTop: '3px solid #d97706', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#7a8fbb', textTransform: 'uppercase', marginBottom: '6px' }}>Mora máxima</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#d97706' }}>{maxMora.dias}d</div>
                <div style={{ fontSize: '11px', color: '#7a8fbb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{maxMora.cliente || '-'}</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #dde3f0', borderTop: '3px solid #7c3aed', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#7a8fbb', textTransform: 'uppercase', marginBottom: '6px' }}>Críticas +60d</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#7c3aed' }}>{criticas}</div>
                <div style={{ fontSize: '11px', color: '#7a8fbb' }}>Requieren gestión urgente</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #dde3f0', borderTop: '3px solid #2554a0', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#7a8fbb', textTransform: 'uppercase', marginBottom: '6px' }}>Cartera total</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#163358' }}>{fmt(carteraTotal)}</div>
                <div style={{ fontSize: '11px', color: '#7a8fbb' }}>{dataSel.length} comprobantes</div>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #dde3f0', display: 'flex', alignItems: 'center', gap: '8px', background: '#f8faff' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0d1b38' }}>Comprobantes</span>
                <span style={{ fontSize: '12px', color: '#7a8fbb' }}>{filtrados.length} registros</span>
                {loading && <span style={{ fontSize: '11px', color: '#d97706' }}>Actualizando...</span>}
              </div>
              {loading && data.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#7a8fbb' }}>Cargando...</div>
              ) : filtrados.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#7a8fbb' }}>No hay comprobantes para mostrar</div>
              ) : (
                <table key={tableKey} style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8faff', borderBottom: '1px solid #dde3f0' }}>
                      {['Comprobante', 'Cliente', 'Ejecutivo', 'Condición', 'Vencimiento', 'Monto', 'Mora', 'PDF'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 600, color: '#7a8fbb', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((r) => {
                      const badge = moraBadge(r.dias_mora)
                      const execEfectivo = localEjecutivos[r.nombre_cliente] || r.ejecutivo
                      const ec    = getExecColor(execEfectivo)
                      return (
                        <tr key={r.id || r.comprobante} style={{ borderBottom: '1px solid #dde3f0' }}>
                          <td style={{ padding: '12px 16px', fontSize: '12px', fontFamily: 'monospace', color: '#3d5278' }}>{r.comprobante}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#0d1b38' }}>{r.nombre_cliente}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <select
                              value={execEfectivo || ''}
                              onChange={e => {
                                const nuevo = e.target.value
                                if (!nuevo) return
                                const viejo = execEfectivo
                                setLocalEjecutivos(prev => ({ ...prev, [r.nombre_cliente]: nuevo }))
                                updateEjecutivoLocal(r.nombre_cliente, nuevo)
                                handleAsignarEjecutivo(r.nombre_cliente, nuevo, viejo)
                              }}
                              style={{ padding: '3px 8px', borderRadius: '20px', border: `1px solid ${ec.bg}`, fontSize: '11px', fontWeight: 500, color: ec.bg, background: ec.bg + '20', cursor: 'pointer', outline: 'none' }}
                            >
                              {!execEfectivo && <option value="">Sin asignar</option>}
                              {EJECUTIVOS.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#7a8fbb' }}>{r.condicion || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#3d5278' }}>{r.fecha_vencimiento}</td>
                          <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace' }}>{fmt(r.monto)}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: badge.bg, color: badge.color, padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{badge.label}</span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <button onClick={() => abrirPdf(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f0f4ff', color: '#2554a0', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                              📄 Ver PDF
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default App
