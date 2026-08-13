import { useState, useEffect, useRef, Fragment } from 'react'
import * as XLSX from 'xlsx-js-style'
import { useComprobantes } from './hooks/useComprobantes'
import { useHistorial } from './hooks/useHistorial'
import { SubirReporte } from './components/SubirReporte'
import { ManualSociedadView } from './components/ManualSociedadView'
import { Login } from './components/Login'
import { ModuloSelector } from './components/ModuloSelector'
import { FacturacionApp } from './facturacion/FacturacionApp'
import { EJECUTIVOS, CONDICIONES_CLIENTE } from './data/ejecutivos'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { useExtras } from './hooks/useExtras'
import type { Extra } from './hooks/useExtras'
import { useFacturasManuales } from './hooks/useFacturasManuales'
import { usePdfsStorage } from './hooks/usePdfsStorage'
import { useUltimoReporte } from './hooks/useUltimoReporte'
import { CONDICION_OPTS, SOCIEDADES, type SociedadKey, type ManualFactura } from './types/sociedades'
import { DASH_BAR_COLORS, EXEC_PIE_COLORS, svgPie } from './lib/dashboardUtils'

const MESES_ABREV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fmtPeriodo(v: string): string {
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return v
  const mes = MESES_ABREV[Number(m[2]) - 1]
  if (!mes) return v
  return `${mes}-${m[3].slice(2)}`
}

function DescPanel({ comprobante, extra, adminMode, onUpdate, condicionActual = '' }: {
  comprobante: string
  extra: Extra | undefined
  adminMode: boolean
  onUpdate: (comp: string, fields: Record<string, string>) => void | Promise<void>
  condicionActual?: string
}) {
  const toVals = (e: Extra | undefined): Record<string, string> => ({
    descripcion: e?.descripcion ?? '', centro_costo: e?.centro_costo ?? '',
    tipo_servicio: e?.tipo_servicio ?? '', oc_hes_pedido: e?.oc_hes_pedido ?? '',
    colaborador: e?.colaborador ?? '', otros_conceptos: e?.otros_conceptos ?? '',
    condicion_override: e?.condicion_override ?? condicionActual, periodo: e?.periodo ?? '', nota: e?.nota ?? '',
  })
  const [vals, setVals] = useState<Record<string, string>>(toVals(extra))
  const [initialVals, setInitialVals] = useState<Record<string, string>>(toVals(extra))
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    const nextVals = toVals(extra)
    setVals(nextVals)
    setInitialVals(nextVals)
    setSaveState('idle')
  }, [extra, condicionActual])

  const hasChanges = Object.keys(vals).some(key => (vals[key] || '') !== (initialVals[key] || ''))

  const handleSave = async () => {
    if (!adminMode || !hasChanges || saving) return
    setSaving(true)
    setSaveState('idle')
    try {
      const changedFields = Object.fromEntries(
        Object.entries(vals).filter(([key, value]) => (value || '') !== (initialVals[key] || ''))
      )
      await onUpdate(comprobante, changedFields)
      setInitialVals(vals)
      setSaveState('saved')
    } catch {
      setSaveState('error')
    } finally {
      setSaving(false)
    }
  }

  const FIELDS = [
    { key: 'descripcion',        label: 'Descripción',       wide: true },
    { key: 'centro_costo',       label: 'Centro de costo' },
    { key: 'oc_hes_pedido',      label: 'OC / HES / Pedido' },
    { key: 'colaborador',        label: 'Ejecutivo' },
    { key: 'condicion_override', label: 'Condición override', type: 'select' },
    { key: 'periodo',            label: 'Período' },
    { key: 'nota',               label: 'Nota',              wide: true },
  ]

  return (
    <div style={{ padding: '14px 20px 18px', background: '#f8faff', borderTop: '2px solid #e0e7ff' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
        Información adicional{!adminMode && <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', marginLeft: '6px' }}>(solo lectura)</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        {FIELDS.map(f => (
          <div key={f.key} style={f.wide ? { gridColumn: '1 / -1' } : {}}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '4px' }}>{f.label}</div>
            {f.type === 'select' ? (
              <select
                value={vals[f.key] || ''}
                onChange={e => { setVals(p => ({ ...p, [f.key]: e.target.value })); setSaveState('idle') }}
                disabled={!adminMode}
                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #dde3f0', fontSize: '12px', background: '#fff', color: '#374151', outline: 'none' }}
              >
                <option value="">—</option>
                {CONDICION_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={f.key === 'periodo' && !adminMode ? fmtPeriodo(vals[f.key] || '') : (vals[f.key] || '')}
                onChange={e => { setVals(p => ({ ...p, [f.key]: e.target.value })); setSaveState('idle') }}
                readOnly={!adminMode}
                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #dde3f0', fontSize: '12px', background: adminMode ? '#fff' : '#f1f5f9', color: '#374151', outline: 'none', boxSizing: 'border-box' }}
              />
            )}
          </div>
        ))}
      </div>
      {adminMode && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
          {saveState === 'saved' && <span style={{ color: '#059669', fontSize: '12px', fontWeight: 600 }}>Cambios guardados</span>}
          {saveState === 'error' && <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: 600 }}>No se pudo guardar</span>}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            style={{ background: !hasChanges || saving ? '#94a3b8' : '#2554a0', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, cursor: !hasChanges || saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  )
}

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

type Vista = 'global' | 'dashboard' | 'todos' | 'historial' | 'clientes' | 'nueva'

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
  const [modulo, setModulo] = useState<'cobranzas' | 'facturacion' | null>(
    () => (localStorage.getItem('asap_modulo') as 'cobranzas' | 'facturacion' | null) || null
  )

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  const elegirModulo = (m: 'cobranzas' | 'facturacion') => {
    localStorage.setItem('asap_modulo', m)
    setModulo(m)
  }
  const cambiarModulo = () => {
    localStorage.removeItem('asap_modulo')
    setModulo(null)
  }

  if (session === undefined) return null
  if (!modulo) return <ModuloSelector onSelect={elegirModulo} />
  if (!session) return <Login modulo={modulo} onVolver={cambiarModulo} />

  return modulo === 'facturacion'
    ? <FacturacionApp session={session} onCambiarModulo={cambiarModulo} />
    : <AppInterna session={session} onCambiarModulo={cambiarModulo} />
}

function AppInterna({ session, onCambiarModulo }: { session: Session; onCambiarModulo: () => void }) {
  const { data, loading, error: errorComprobantes, refetch, asignarEjecutivo, updateEjecutivoLocal, actualizarComprobante, marcarCobrado, deshacerCobro } = useComprobantes()
  const { data: historial, loading: loadingHistorial, error: errorHistorial, refetch: refetchHistorial } = useHistorial()
  const { extras, updateExtra, batchUpsert } = useExtras()
  const [vista, setVista] = useState<Vista>('global')
  const [sociedadActiva, setSociedadActiva] = useState<SociedadKey>('sa')
  const [sociedadesAbiertas, setSociedadesAbiertas] = useState<Record<SociedadKey, boolean>>({ sa: true, llc: false, sl: false })
  const {
    facturas: manualFacturas, historial: manualHistorial, execsConocidos: manualExecs, clientesConocidos: manualClients,
    error: errorFacturasManuales,
    guardarFactura: guardarFacturaManualDb, marcarCobrada: marcarCobradaManualDb,
    deshacerCobro: deshacerCobroManualDb, reasignarEjecutivo: reasignarEjecutivoManualDb,
  } = useFacturasManuales()
  const { buscarPdf } = usePdfsStorage()
  const { fecha: fechaUltimoReporte } = useUltimoReporte()
  const [editandoManual, setEditandoManual] = useState<ManualFactura | null>(null)
  const [tableKey] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [ejecutivoSeleccionado, setEjecutivoSeleccionado] = useState<string | null>(null)
  const [sidebarAbierto, setSidebarAbierto] = useState(true)
  const [modalComprobante, setModalComprobante] = useState<any | null>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [mostrarTodosClientesDash, setMostrarTodosClientesDash] = useState(false)
  const [pdfNoEncontrado, setPdfNoEncontrado] = useState('')
  const [adminMode, setAdminMode]             = useState(false)
  const [showAdminPrompt, setShowAdminPrompt] = useState(false)
  const [adminPwInput, setAdminPwInput]       = useState('')
  const [expandedRows, setExpandedRows]       = useState<Set<string>>(new Set())
  const [expandedGlobalRows, setExpandedGlobalRows] = useState<Set<string>>(new Set())
  const [sortCol, setSortCol]                 = useState<string | null>(null)
  const [sortDir, setSortDir]                 = useState<'asc' | 'desc'>('asc')
  const [filtroMoraRange, setFiltroMoraRange] = useState('')
  const [seleccionCobro, setSeleccionCobro]   = useState<Set<string>>(new Set())
  const [marcandoCobro, setMarcandoCobro]     = useState(false)

  // filtros – vista global
  const [globalFiltroEjecutivo, setGlobalFiltroEjecutivo] = useState('')
  const [globalFiltroCliente, setGlobalFiltroCliente]     = useState('')
  const [globalFiltroEstado, setGlobalFiltroEstado]       = useState('')

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

  const [toastExito, setToastExito] = useState('')
  useEffect(() => {
    if (toastExito) {
      const timer = setTimeout(() => setToastExito(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [toastExito])

  // filtros – tabla
  const [filtroClienteTabla, setFiltroClienteTabla] = useState('')
  const [filtroEstadoTabla, setFiltroEstadoTabla] = useState('')

  // filtros – historial
  const [filtroEjecutivoHistorial, setFiltroEjecutivoHistorial] = useState('')
  const [filtroClienteHistorial,   setFiltroClienteHistorial]   = useState('')
  const [filtroFechaDesde,         setFiltroFechaDesde]         = useState('')
  const [filtroFechaHasta,         setFiltroFechaHasta]         = useState('')

  // filtros – clientes
  const [filtroEjecutivoClientes, setFiltroEjecutivoClientes] = useState('')
  const [filtroEstadoClientes, setFiltroEstadoClientes] = useState('')

  const ejecutivos = Array.from(new Set(data.map(r => r.ejecutivo).filter(Boolean).filter(e => e !== 'Sin asignar'))) as string[]

  // ── datos filtrados para vistas de tabla ──────────────────────────────────
  const esSinAsignar = (ej: string | null | undefined) => !ej || ej === 'Sin asignar'

  const hoyDate = new Date(); hoyDate.setHours(0, 0, 0, 0)
  const en7dias = new Date(hoyDate.getTime() + 7 * 86400000)
  const rowKey = (r: any) => String(r.id || r.comprobante)
  const esProximaAVencer = (r: any) => {
    if (r.dias_mora > 0 || !r.fecha_vencimiento) return false
    const v = new Date(r.fecha_vencimiento + 'T00:00:00')
    return v >= hoyDate && v <= en7dias
  }

  const filtrados = data.filter(r => {
    if (ejecutivoSeleccionado === 'Sin asignar') {
      if (!esSinAsignar(r.ejecutivo)) return false
    } else if (ejecutivoSeleccionado && r.ejecutivo !== ejecutivoSeleccionado) return false
    if (filtroClienteTabla && r.nombre_cliente !== filtroClienteTabla) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      const ex = extras.get(r.comprobante)
      return (
        r.nombre_cliente?.toLowerCase().includes(q) ||
        r.comprobante?.toLowerCase().includes(q) ||
        r.ejecutivo?.toLowerCase().includes(q) ||
        [ex?.descripcion, ex?.centro_costo, ex?.tipo_servicio, ex?.oc_hes_pedido, ex?.colaborador, ex?.otros_conceptos, ex?.periodo, ex?.nota, ex?.condicion_override]
          .some(v => v?.toLowerCase().includes(q))
      )
    }
    return true
  })

  const aplicarFiltroEstado = (lista: typeof data) => {
    switch (filtroEstadoTabla) {
      case 'mora':     return lista.filter(r => r.dias_mora > 0)
      case 'sinvencer':return lista.filter(r => r.dias_mora <= 0)
      case '1-30':     return lista.filter(r => r.dias_mora >= 1 && r.dias_mora <= 30)
      case '31-60':    return lista.filter(r => r.dias_mora > 30 && r.dias_mora <= 60)
      case '60+':      return lista.filter(r => r.dias_mora > 60)
      case 'proximas': return lista.filter(esProximaAVencer)
      default: return lista
    }
  }

  const dataSel     = ejecutivoSeleccionado === 'Sin asignar'
    ? data.filter(r => esSinAsignar(r.ejecutivo))
    : ejecutivoSeleccionado ? data.filter(r => r.ejecutivo === ejecutivoSeleccionado) : data
  const totalVencido = dataSel.filter(r => r.dias_mora > 0).reduce((s, r) => s + r.monto, 0)
  const carteraTotal = dataSel.reduce((s, r) => s + r.monto, 0)

  // ── mapa de clientes (usado en dashboard y vista clientes) ────────────────
  type ClienteRow = { cliente: string; ejecutivo: string; monto: number; vencido: number; facturas: number; moraMax: number; condiciones: string[] }
  const clientesMap = data.reduce<Map<string, ClienteRow>>((acc, r) => {
    const actual = acc.get(r.nombre_cliente) || {
      cliente: r.nombre_cliente, ejecutivo: r.ejecutivo || 'Sin asignar',
      monto: 0, vencido: 0, facturas: 0, moraMax: 0,
      condiciones: [...(CONDICIONES_CLIENTE[r.nombre_cliente] ?? [])],
    }
    const condicionActual = extras.get(r.comprobante)?.condicion_override || r.condicion || ''
    if (condicionActual && !actual.condiciones.includes(condicionActual)) actual.condiciones.push(condicionActual)
    actual.monto   += r.monto
    actual.vencido += r.dias_mora > 0 ? r.monto : 0
    actual.facturas += 1
    actual.moraMax  = Math.max(actual.moraMax, r.dias_mora)
    acc.set(r.nombre_cliente, actual)
    return acc
  }, new Map<string, ClienteRow>())

  const clientesFiltrados = Array.from(clientesMap.values())
    .filter(c => {
      if (filtroEjecutivoClientes && c.ejecutivo !== filtroEjecutivoClientes) return false
      if (filtroEstadoClientes === 'sinmora'  && c.vencido > 0)    return false
      if (filtroEstadoClientes === 'mora'     && c.vencido <= 0)   return false
      if (filtroEstadoClientes === 'critica'  && c.moraMax <= 60)  return false
      return true
    })
    .sort((a, b) => b.vencido - a.vencido)

  // ── métricas adicionales para nuevo dashboard ─────────────────────────────
  const proxAVencer = dataSel.filter(esProximaAVencer)
  const proxSet = new Set(proxAVencer.map(rowKey))
  const sinVencerArr = dataSel.filter(r => r.dias_mora <= 0 && !proxSet.has(rowKey(r)))
  const totalProxAVencer = proxAVencer.reduce((s, r) => s + r.monto, 0)
  const totalSinVencer   = sinVencerArr.reduce((s, r) => s + r.monto, 0)
  const porcentajeMora   = carteraTotal > 0 ? Math.round((totalVencido / carteraTotal) * 100) : 0
  const vencidasArr      = dataSel.filter(r => r.dias_mora > 0)
  const moraPromedio     = vencidasArr.length > 0
    ? Math.round(vencidasArr.reduce((s, r) => s + r.dias_mora, 0) / vencidasArr.length) : 0

  const clientDashMap = vencidasArr.reduce<Map<string, {monto: number; facturas: number; moraSum: number}>>((acc, r) => {
    const cur = acc.get(r.nombre_cliente) || {monto: 0, facturas: 0, moraSum: 0}
    cur.monto += r.monto; cur.facturas++; cur.moraSum += r.dias_mora
    acc.set(r.nombre_cliente, cur); return acc
  }, new Map())
  const clientDashList = Array.from(clientDashMap.entries())
    .map(([name, d]) => ({
      name, monto: d.monto, facturas: d.facturas,
      moraProm: Math.round(d.moraSum / d.facturas),
      pct: totalVencido > 0 ? Math.round((d.monto / totalVencido) * 100) : 0
    })).sort((a, b) => b.monto - a.monto)

  const clientesConMoraSet = new Set(vencidasArr.map(r => r.nombre_cliente))
  const clientesAlDia = [...new Set(dataSel.filter(r => r.dias_mora <= 0).map(r => r.nombre_cliente))]
    .filter(n => !clientesConMoraSet.has(n)).sort()

  const moraDist = [
    {label: '1–7d',   color: '#d97706', bg: '#fef3c7', items: vencidasArr.filter(r => r.dias_mora >= 1 && r.dias_mora <= 7)},
    {label: '8–15d',  color: '#ea580c', bg: '#ffedd5', items: vencidasArr.filter(r => r.dias_mora > 7 && r.dias_mora <= 15)},
    {label: '16–30d', color: '#dc2626', bg: '#fee2e2', items: vencidasArr.filter(r => r.dias_mora > 15 && r.dias_mora <= 30)},
    {label: '+30d',   color: '#7c3aed', bg: '#ede9fe', items: vencidasArr.filter(r => r.dias_mora > 30)},
  ]

  const execPieMap = vencidasArr.reduce<Map<string, number>>((acc, r) => {
    const k = r.ejecutivo || 'Sin asignar'
    acc.set(k, (acc.get(k) || 0) + r.monto); return acc
  }, new Map())
  const execPieList = Array.from(execPieMap.entries())
    .map(([name, monto], i) => ({
      name, monto, color: EXEC_PIE_COLORS[i % EXEC_PIE_COLORS.length],
      pct: totalVencido > 0 ? Math.round((monto / totalVencido) * 100) : 0
    })).sort((a, b) => b.monto - a.monto)

  // ── historial filtrado ────────────────────────────────────────────────────
  const historialFiltrado = historial.filter(r => {
    if (filtroEjecutivoHistorial && r.ejecutivo !== filtroEjecutivoHistorial) return false
    if (filtroClienteHistorial   && r.cliente   !== filtroClienteHistorial)   return false
    if (filtroFechaDesde && r.fecha_cobro < filtroFechaDesde) return false
    if (filtroFechaHasta && r.fecha_cobro > filtroFechaHasta + 'T23:59:59') return false
    return true
  })

  // ── helpers ───────────────────────────────────────────────────────────────
  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

  const fmtUltimaActualizacion = (fechaIso: string | null) => {
    if (!fechaIso) return 'Sin actualizaciones aún'
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(fechaIso) ? fechaIso : fechaIso + 'Z'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return 'Sin actualizaciones aún'
    const hoy = new Date()
    const esHoy = d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate()
    const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    if (esHoy) return `Actualizado hoy a las ${hora}`
    const dia = String(d.getDate()).padStart(2, '0')
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    return `Actualizado el ${dia}/${mes} a las ${hora}`
  }

  const fmtFecha = (fecha: string) => {
    if (!fecha) return '-'
    const [y, m, d] = fecha.split('-')
    return `${d}/${m}/${y}`
  }

  const calcularVencimientoPorCondicion = (fechaEmision: string | null | undefined, condicion: string) => {
    if (!fechaEmision || !/^\d{4}-\d{2}-\d{2}$/.test(fechaEmision) || !condicion) return null
    const diasMatch = condicion.match(/(\d+)/)
    const dias = diasMatch ? parseInt(diasMatch[1], 10) : /^contado$/i.test(condicion.trim()) ? 0 : 30
    const fecha = new Date(`${fechaEmision}T00:00:00`)
    fecha.setDate(fecha.getDate() + dias)
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
  }

  const calcularDiasMora = (fechaVencimiento: string | null) => {
    if (!fechaVencimiento) return 0
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const vencimiento = new Date(`${fechaVencimiento}T00:00:00`)
    return Math.max(0, Math.floor((hoy.getTime() - vencimiento.getTime()) / 86400000))
  }

  const handleUpdateExtra = async (comprobante: string, fields: Record<string, string>) => {
    try {
      if ('condicion_override' in fields) {
        const condicion = fields.condicion_override || ''
        const row = data.find(r => r.comprobante === comprobante)
        const fecha_vencimiento = calcularVencimientoPorCondicion(row?.fecha_emision, condicion)
        await actualizarComprobante(comprobante, {
          condicion,
          fecha_vencimiento,
          dias_mora: calcularDiasMora(fecha_vencimiento),
        })
      }
      await updateExtra(comprobante, fields)
      setToastExito('Actualizado correctamente ✓')
    } catch {
      setErrorCarga('No se pudo guardar el cambio. Intentá de nuevo.')
    }
  }

  const moraBadge = (dias: number) => {
    if (dias <= 0)  return { label: 'Sin vencer', color: '#059669', bg: '#d1fae5' }
    if (dias <= 7)  return { label: `${dias}d`,   color: '#854d0e', bg: '#fef9c3' }
    if (dias <= 15) return { label: `${dias}d`,   color: '#9a3412', bg: '#ffedd5' }
    if (dias <= 30) return { label: `${dias}d`,   color: '#7f1d1d', bg: '#fee2e2' }
    return           { label: `🔴 ${dias}d`,      color: '#ffffff', bg: '#dc2626' }
  }

  const abrirPdf = (row: any, urlDirecta?: string) => {
    const comprobante = row.comprobante || row.comprobante_numero
    const url = urlDirecta || buscarPdf(comprobante)?.url
    if (!url) {
      setPdfNoEncontrado(comprobante)
      setTimeout(() => setPdfNoEncontrado(''), 4000)
      return
    }
    setModalComprobante({ ...row, comprobante, _pdfUrl: url })
  }

  const copiarLink = () => {
    navigator.clipboard.writeText(modalComprobante._pdfUrl)
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2000)
  }

  const cerrarModal = () => { setModalComprobante(null); setLinkCopiado(false) }

  const limpiarSeleccionTabla = () => {
    setEjecutivoSeleccionado(null)
    setFiltroClienteTabla('')
    setFiltroEstadoTabla('')
    setFiltroMoraRange('')
    setFiltroEjecutivoHistorial('')
    setFiltroClienteHistorial('')
    setFiltroEjecutivoClientes('')
    setFiltroEstadoClientes('')
    setSortCol(null)
    setSortDir('asc')
    setExpandedRows(new Set())
    setSeleccionCobro(new Set())
    setGlobalFiltroEjecutivo('')
    setGlobalFiltroCliente('')
    setGlobalFiltroEstado('')
  }

  const cobradoPorActual = session.user.user_metadata?.full_name || session.user.email || 'Admin'

  const handleMarcarCobradas = async () => {
    const rows = data.filter(r => seleccionCobro.has(String(r.id)))
    if (!rows.length || marcandoCobro) return
    if (!confirm(`¿Marcar ${rows.length} factura${rows.length > 1 ? 's' : ''} como cobrada${rows.length > 1 ? 's' : ''}?`)) return
    setMarcandoCobro(true)
    try {
      await marcarCobrado(rows, cobradoPorActual)
      setSeleccionCobro(new Set())
      await refetchHistorial()
      setToastExito(`${rows.length} factura${rows.length > 1 ? 's' : ''} movida${rows.length > 1 ? 's' : ''} al historial ✓`)
    } catch {
      setErrorCarga('No se pudo marcar como cobrada. Intentá de nuevo.')
    } finally {
      setMarcandoCobro(false)
    }
  }

  const handleDeshacerCobro = async (row: any) => {
    if (!confirm(`¿Deshacer el cobro de ${row.comprobante_numero}? Volverá a la lista de pendientes.`)) return
    try {
      await deshacerCobro(row.id, row.comprobante_id)
      await Promise.all([refetch(), refetchHistorial()])
      setToastExito('Cobro deshecho ✓')
    } catch {
      setErrorCarga('No se pudo deshacer el cobro. Intentá de nuevo.')
    }
  }

  const irAVista = (nuevaVista: Vista, sociedad: SociedadKey = sociedadActiva) => {
    setSociedadActiva(sociedad)
    setVista(nuevaVista)
    setEditandoManual(null)
    limpiarSeleccionTabla()
  }

  const guardarOEditarFacturaManual = async (factura: ManualFactura) => {
    try {
      await guardarFacturaManualDb(factura)
      setEditandoManual(null)
      setToastExito(editandoManual ? 'Factura actualizada ✓' : 'Factura manual guardada ✓')
      setVista('todos')
    } catch {
      setErrorCarga('No se pudo guardar la factura. Intentá de nuevo.')
    }
  }

  const marcarCobradaManual = async (factura: ManualFactura) => {
    if (!confirm(`¿Marcar la factura ${factura.comprobante} como cobrada?`)) return
    try {
      await marcarCobradaManualDb(factura)
      setToastExito('Factura movida al historial ✓')
    } catch {
      setErrorCarga('No se pudo marcar como cobrada. Intentá de nuevo.')
    }
  }

  const deshacerCobroManual = async (factura: ManualFactura) => {
    if (!confirm(`¿Deshacer el cobro de ${factura.comprobante}? Volverá a la lista de pendientes.`)) return
    try {
      await deshacerCobroManualDb(factura)
      setToastExito('Cobro deshecho ✓')
    } catch {
      setErrorCarga('No se pudo deshacer el cobro. Intentá de nuevo.')
    }
  }

  const reasignarEjecutivoManual = async (sociedad: SociedadKey, cliente: string, nuevoEjecutivo: string) => {
    try {
      await reasignarEjecutivoManualDb(sociedad, cliente, nuevoEjecutivo)
      setToastExito('Ejecutivo actualizado ✓')
    } catch {
      setErrorCarga('No se pudo actualizar el ejecutivo. Intentá de nuevo.')
    }
  }

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

  // ── da formato de tabla a una hoja (encabezado, bandas, filtro, bordes) ────
  const estilizarComoTabla = (
    ws: XLSX.WorkSheet,
    rows: object[],
    colorFn?: (header: string, val: any) => { bg?: string; fg?: string; bold?: boolean } | null
  ) => {
    if (rows.length === 0) return
    const headers = Object.keys(rows[0])
    const thinBorder = { style: 'thin', color: { rgb: 'DDE3F0' } }
    headers.forEach((_, ci) => {
      const cell = XLSX.utils.encode_cell({ r: 0, c: ci })
      if (!ws[cell]) return
      ws[cell].s = {
        fill: { patternType: 'solid', fgColor: { rgb: '1D4170' } },
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
      }
    })
    rows.forEach((row, ri) => {
      headers.forEach((h, ci) => {
        const cell = XLSX.utils.encode_cell({ r: ri + 1, c: ci })
        if (!ws[cell]) return
        const custom = colorFn ? colorFn(h, (row as any)[h]) : null
        ws[cell].s = {
          fill: { patternType: 'solid', fgColor: { rgb: custom?.bg || (ri % 2 ? 'F8FAFF' : 'FFFFFF') } },
          font: { color: { rgb: custom?.fg || '0F172A' }, bold: !!custom?.bold, sz: 10 },
          border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
        }
      })
    })
    ws['!cols'] = headers.map(h => ({
      wch: Math.min(40, Math.max(10, h.length, ...rows.map(r => String((r as any)[h] ?? '').length)) + 2),
    }))
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } }) }
  }

  const moraEstadoColores: Record<string, { bg: string; fg: string; bold?: boolean }> = {
    'Sin vencer':        { bg: 'D1FAE5', fg: '065F46' },
    'Reciente vencida':  { bg: 'FEF9C3', fg: '854D0E' },
    'Atención':          { bg: 'FFEDD5', fg: '9A3412' },
    'Crítica':           { bg: 'FEE2E2', fg: '7F1D1D' },
    'Urgente':           { bg: 'DC2626', fg: 'FFFFFF', bold: true },
  }
  const estadoMora = (dias: number) =>
    dias <= 0 ? 'Sin vencer' : dias <= 7 ? 'Reciente vencida' : dias <= 15 ? 'Atención' : dias <= 30 ? 'Crítica' : 'Urgente'
  const colorMoraFn = (header: string, val: any) => {
    if (header === 'Estado' && moraEstadoColores[val]) return moraEstadoColores[val]
    if (header === 'Mora (días)' && typeof val === 'number') return moraEstadoColores[estadoMora(val)] || null
    if (header === 'Monto') return { bold: true }
    return null
  }

  // ── exportar xlsx (solo filas visibles) ───────────────────────────────────
  const exportar = () => {
    const hoy = new Date().toISOString().slice(0, 10)
    let rows: object[]
    let sheet: string
    let file: string

    if (vista === 'historial') {
      rows  = historialFiltrado.map(r => ({
        'Comprobante':   r.comprobante_numero,
        'Cliente':       r.cliente,
        'Ejecutivo':     r.ejecutivo || 'Sin asignar',
        'Monto cobrado': r.monto,
        'Fecha cobro':   r.fecha_cobro ? r.fecha_cobro.slice(0, 10) : '',
        'Cobrado por':   r.cobrado_por || '',
        'Estado':        'Completo',
      }))
      sheet = 'Historial'; file = `historial_${hoy}.xlsx`
    } else if (vista === 'clientes') {
      rows  = clientesFiltrados.map(c => ({
        'Cliente':        c.cliente,
        'Ejecutivo':      localEjecutivos[c.cliente] || c.ejecutivo,
        'Condición':      c.condiciones.join(', '),
        'Cartera total':  c.monto,
        'Total vencido':  c.vencido,
        'Facturas':       c.facturas,
      }))
      sheet = 'Clientes'; file = `clientes_${hoy}.xlsx`
    } else {
      rows  = filtrados.map(r => {
        const ex = extras.get(r.comprobante)
        return {
          'Comprobante':                  r.comprobante,
          'Cliente':                      r.nombre_cliente,
          'Ejecutivo':                    r.ejecutivo || 'Sin asignar',
          'Emisión':                      fmtFecha(r.fecha_emision),
          'Condición':                    ex?.condicion_override || r.condicion || '',
          'Vencimiento':                  fmtFecha(r.fecha_vencimiento),
          'Monto':                        r.monto,
          'Mora (días)':                  r.dias_mora,
          'Estado':                       estadoMora(r.dias_mora),
          'Descripción':                  ex?.descripcion || '',
          'Centro de costo':              ex?.centro_costo || '',
          'Tipo de servicio':             ex?.tipo_servicio || '',
          'OC / HES / N° Pedido':         ex?.oc_hes_pedido || '',
          'Período':                      ex?.periodo || '',
          'Colaborador':                  ex?.colaborador || '',
          'Otros conceptos / Proyectos':  ex?.otros_conceptos || '',
          'Nota':                         ex?.nota || '',
        }
      })
      sheet = 'Comprobantes'; file = `comprobantes_${hoy}.xlsx`
    }

    const ws = XLSX.utils.json_to_sheet(rows)
    estilizarComoTabla(ws, rows, vista === 'historial' || vista === 'clientes' ? undefined : colorMoraFn)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheet)
    XLSX.writeFile(wb, file)
  }

  // ── booleanos de vista ────────────────────────────────────────────────────
  const esGlobal = vista === 'global'
  const esDashboard = vista === 'dashboard'
  const esHistorial = vista === 'historial'
  const esClientes  = vista === 'clientes'
  const esNueva     = vista === 'nueva'
  const esTabla     = !esGlobal && !esDashboard && !esHistorial && !esClientes && !esNueva
  const sociedadInfo = SOCIEDADES[sociedadActiva]
  const esSociedadManual = sociedadInfo.manual
  const manualSociedadRows = sociedadActiva === 'sa' ? [] : manualFacturas.filter(r => r.sociedad === sociedadActiva)
  const camposExtra = (ex: Extra | undefined) => ex
    ? [ex.descripcion, ex.centro_costo, ex.tipo_servicio, ex.oc_hes_pedido, ex.colaborador, ex.otros_conceptos, ex.periodo, ex.nota, ex.condicion_override]
    : []
  const camposManual = (r: ManualFactura) =>
    [r.descripcion, r.unidad, r.oc_hes_pedido, r.colaborador, r.otros_conceptos, r.periodo, r.condicion]

  const globalRowsSinFiltrar = [
    ...data.map(r => ({
      empresa: SOCIEDADES.sa.nombre,
      comprobante: r.comprobante,
      cliente: r.nombre_cliente,
      ejecutivo: r.ejecutivo || 'Sin asignar',
      fecha: r.fecha_emision,
      monto: r.monto,
      diasMora: r.dias_mora || 0,
      estado: 'Pendiente' as const,
      pdfDirecta: '',
      buscable: [r.comprobante, r.nombre_cliente, r.ejecutivo, ...camposExtra(extras.get(r.comprobante))].filter(Boolean).join(' ').toLowerCase(),
    })),
    ...historial.map(r => ({
      empresa: SOCIEDADES.sa.nombre,
      comprobante: r.comprobante_numero,
      cliente: r.cliente,
      ejecutivo: r.ejecutivo || 'Sin asignar',
      fecha: r.fecha_cobro ? r.fecha_cobro.slice(0, 10) : '',
      monto: r.monto,
      diasMora: 0,
      estado: 'Cobrada' as const,
      pdfDirecta: '',
      buscable: [r.comprobante_numero, r.cliente, r.ejecutivo, ...camposExtra(extras.get(r.comprobante_numero))].filter(Boolean).join(' ').toLowerCase(),
    })),
    ...manualFacturas.map(r => ({
      empresa: SOCIEDADES[r.sociedad].nombre,
      comprobante: r.comprobante,
      cliente: r.cliente,
      ejecutivo: r.ejecutivo || 'Sin asignar',
      fecha: r.fecha_emision,
      monto: r.monto,
      diasMora: calcularDiasMora(r.fecha_vencimiento || null),
      estado: 'Pendiente' as const,
      pdfDirecta: r.pdf_base64 || r.pdf_url || '',
      buscable: [r.comprobante, r.cliente, r.ejecutivo, ...camposManual(r)].filter(Boolean).join(' ').toLowerCase(),
    })),
    ...(['llc', 'sl'] as const).flatMap(key => manualHistorial[key].map(r => ({
      empresa: SOCIEDADES[key].nombre,
      comprobante: r.comprobante,
      cliente: r.cliente,
      ejecutivo: r.ejecutivo || 'Sin asignar',
      fecha: r.cobrado_el ? r.cobrado_el.slice(0, 10) : '',
      monto: r.monto,
      diasMora: 0,
      estado: 'Cobrada' as const,
      pdfDirecta: r.pdf_base64 || r.pdf_url || '',
      buscable: [r.comprobante, r.cliente, r.ejecutivo, ...camposManual(r)].filter(Boolean).join(' ').toLowerCase(),
    }))),
  ]

  const globalEjecutivoOpts = [...new Set(globalRowsSinFiltrar.map(r => r.ejecutivo).filter(Boolean))].sort() as string[]
  const globalClienteOpts   = [...new Set(globalRowsSinFiltrar.filter(r => !globalFiltroEjecutivo || r.ejecutivo === globalFiltroEjecutivo).map(r => r.cliente).filter(Boolean))].sort() as string[]

  const globalRows = globalRowsSinFiltrar.filter(r => {
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!r.buscable.includes(q) && !r.empresa?.toLowerCase().includes(q)) return false
    }
    if (globalFiltroEjecutivo && r.ejecutivo !== globalFiltroEjecutivo) return false
    if (globalFiltroCliente   && r.cliente   !== globalFiltroCliente)  return false
    if (globalFiltroEstado === 'pendiente' && r.estado === 'Cobrada') return false
    if (globalFiltroEstado === 'cobrado'   && r.estado !== 'Cobrada') return false
    if (globalFiltroEstado === 'vencida'   && (r.estado === 'Cobrada' || r.diasMora <= 0)) return false
    if (globalFiltroEstado === 'sinvencer' && (r.estado === 'Cobrada' || r.diasMora > 0)) return false
    return true
  })

  const exportarGlobal = () => {
    const hoy = new Date().toISOString().slice(0, 10)
    const rows = globalRows.map(r => ({
      'Empresa':    r.empresa,
      'Comprobante': r.comprobante,
      'Cliente':    r.cliente,
      'Ejecutivo':  r.ejecutivo,
      'Emisión':    fmtFecha(r.fecha),
      'Monto':      r.monto,
      'Estado':     r.estado,
      'Mora (días)': r.diasMora,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    estilizarComoTabla(ws, rows, colorMoraFn)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Consolidado')
    XLSX.writeFile(wb, `consolidado_${hoy}.xlsx`)
  }

  // ── export estilizado multi-hoja (dashboard SA) ───────────────────────────
  const exportDashboard = () => {
    const hoy = new Date().toLocaleDateString('es-AR')
    const wb = XLSX.utils.book_new()

    const headerStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: '1D4170' } },
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    }
    type ColorInfo = { bg?: string; fg?: string; bold?: boolean }
    const styleSheet = (ws: XLSX.WorkSheet, headers: string[], rows: any[][], colorFn?: (col: string, val: any) => ColorInfo | null) => {
      headers.forEach((_, ci) => {
        const cell = XLSX.utils.encode_cell({ r: 0, c: ci })
        if (ws[cell]) ws[cell].s = headerStyle
      })
      rows.forEach((row, ri) => {
        row.forEach((val, ci) => {
          const cell = XLSX.utils.encode_cell({ r: ri + 1, c: ci })
          if (!ws[cell]) return
          const custom = colorFn ? colorFn(headers[ci], val) : null
          ws[cell].s = {
            fill: { patternType: 'solid', fgColor: { rgb: custom?.bg || (ri % 2 ? 'F8FAFF' : 'FFFFFF') } },
            font: { color: { rgb: custom?.fg || '0F172A' }, bold: !!custom?.bold, sz: 10 },
          }
        })
      })
    }

    // Hoja 1 — Resumen
    const wsResumen = XLSX.utils.aoa_to_sheet([
      ['Dashboard de Cobranzas — ASAP Consulting'],
      ['Generado el', hoy],
      [],
      ['Indicador', 'Valor'],
      ['Total vencido', totalVencido],
      ['Facturas en mora', vencidasArr.length],
      ['Clientes con mora', clientDashList.length],
      ['Mora promedio (días)', moraPromedio],
      ['% cartera en mora', porcentajeMora + '%'],
      ['Total pendiente de cobro', carteraTotal],
    ])
    wsResumen['!cols'] = [{ wch: 30 }, { wch: 20 }]
    if (wsResumen['A1']) wsResumen['A1'].s = { font: { bold: true, sz: 13 } }
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

    // Hoja 2 — Por cliente
    const clienteHeaders = ['#', 'Cliente', 'Importe vencido', '% del total', 'Facturas', 'Mora promedio (días)']
    const clienteRows = clientDashList.map((c, i) => [i + 1, c.name, c.monto, c.pct + '%', c.facturas, c.moraProm])
    const wsClientes = XLSX.utils.aoa_to_sheet([clienteHeaders, ...clienteRows])
    wsClientes['!cols'] = [{ wch: 4 }, { wch: 35 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 20 }]
    styleSheet(wsClientes, clienteHeaders, clienteRows)
    XLSX.utils.book_append_sheet(wb, wsClientes, 'Por cliente')

    // Hoja 3 — Por ejecutivo
    const byExec = new Map<string, { monto: number; facturas: number; moraTotal: number }>()
    vencidasArr.forEach(r => {
      const n = r.ejecutivo || 'Sin asignar'
      const cur = byExec.get(n) || { monto: 0, facturas: 0, moraTotal: 0 }
      cur.monto += r.monto; cur.facturas += 1; cur.moraTotal += r.dias_mora
      byExec.set(n, cur)
    })
    const execHeaders = ['Ejecutivo', 'Importe vencido', '% del total', 'Facturas', 'Mora promedio (días)']
    const execRows = Array.from(byExec.entries())
      .map(([name, d]) => [name, d.monto, totalVencido > 0 ? Math.round(d.monto / totalVencido * 100) + '%' : '0%', d.facturas, Math.round(d.moraTotal / d.facturas)])
      .sort((a, b) => (b[1] as number) - (a[1] as number))
    const wsExec = XLSX.utils.aoa_to_sheet([execHeaders, ...execRows])
    wsExec['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 20 }]
    styleSheet(wsExec, execHeaders, execRows)
    XLSX.utils.book_append_sheet(wb, wsExec, 'Por ejecutivo')

    // Hoja 4 — Distribución mora
    const distHeaders = ['Rango de mora', 'Facturas', 'Monto total']
    const distRows = moraDist.map(b => [b.label, b.items.length, b.items.reduce((s, r) => s + r.monto, 0)])
    const wsDist = XLSX.utils.aoa_to_sheet([distHeaders, ...distRows])
    wsDist['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 18 }]
    styleSheet(wsDist, distHeaders, distRows)
    XLSX.utils.book_append_sheet(wb, wsDist, 'Distribución mora')

    // Hoja 5 — Detalle facturas vencidas
    const detHeaders = [
      'Comprobante', 'Cliente', 'Ejecutivo', 'Emisión', 'Condición', 'Vencimiento', 'Monto', 'Mora (días)', 'Estado',
      'Descripción', 'Centro de costo', 'Tipo de servicio', 'OC / HES / N° Pedido', 'Período', 'Colaborador', 'Otros conceptos / Proyectos', 'Nota',
    ]
    const detRows = vencidasArr.map(r => {
      const ex = extras.get(r.comprobante)
      return [
        r.comprobante, r.nombre_cliente, r.ejecutivo || 'Sin asignar', fmtFecha(r.fecha_emision),
        ex?.condicion_override || r.condicion || '', fmtFecha(r.fecha_vencimiento), r.monto, r.dias_mora, estadoMora(r.dias_mora),
        ex?.descripcion || '', ex?.centro_costo || '', ex?.tipo_servicio || '', ex?.oc_hes_pedido || '',
        ex?.periodo || '', ex?.colaborador || '', ex?.otros_conceptos || '', ex?.nota || '',
      ]
    })
    const wsDetalle = XLSX.utils.aoa_to_sheet([detHeaders, ...detRows])
    wsDetalle['!cols'] = [
      { wch: 22 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 16 },
      { wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 24 }, { wch: 24 },
    ]
    styleSheet(wsDetalle, detHeaders, detRows, (col, val) => {
      if (col === 'Estado') return moraEstadoColores[val] || null
      if (col === 'Mora (días)' && typeof val === 'number') return moraEstadoColores[estadoMora(val)] || null
      if (col === 'Monto') return { bold: true }
      return null
    })
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle facturas')

    XLSX.writeFile(wb, `Cobranzas_ASAP_${hoy.replace(/\//g, '-')}.xlsx`)
  }

  // opciones de clientes para dropdowns
  const clientesTablaOpts    = [...new Set(data.map(r => r.nombre_cliente).filter(Boolean))].sort() as string[]
  const clientesHistorialOpts = [...new Set(historial.map(r => r.cliente).filter(Boolean))].sort() as string[]

  const hayFiltrosTabla     = !!(ejecutivoSeleccionado || filtroClienteTabla || filtroEstadoTabla)
  const hayFiltrosHistorial = !!(filtroEjecutivoHistorial || filtroClienteHistorial || filtroFechaDesde || filtroFechaHasta)
  const hayFiltrosClientes  = !!(filtroEjecutivoClientes || filtroEstadoClientes)
  const esPanelEjecutivo    = esTabla && !!ejecutivoSeleccionado

  const limpiarFiltrosTabla     = () => { if (!esPanelEjecutivo) setEjecutivoSeleccionado(null); setFiltroClienteTabla(''); setFiltroEstadoTabla(''); setFiltroMoraRange(''); setSortCol(null); setSortDir('asc') }
  const limpiarFiltrosHistorial = () => { setFiltroEjecutivoHistorial(''); setFiltroClienteHistorial(''); setFiltroFechaDesde(''); setFiltroFechaHasta('') }
  const limpiarFiltrosClientes  = () => { setFiltroEjecutivoClientes(''); setFiltroEstadoClientes('') }

  const handleSort = (col: string) => {
    if (sortCol === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc') }
    else { setSortCol(col); setSortDir('asc') }
  }

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
              <iframe src={modalComprobante._pdfUrl} style={{ width: '100%', height: '380px', border: 'none', borderRadius: '8px', background: '#fff' }} title="PDF" />
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
                <a href={modalComprobante._pdfUrl} download style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#2554a0', color: '#fff', padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>⬇ Descargar</a>
                <button onClick={copiarLink} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: linkCopiado ? '#d1fae5' : '#f0f4ff', color: linkCopiado ? '#059669' : '#2554a0', padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, border: linkCopiado ? '1px solid #6ee7b7' : '1px solid transparent', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                  {linkCopiado ? '✅ Copiado!' : '🔗 Copiar link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN PASSWORD MODAL ─────────────────────────────────────────── */}
      {showAdminPrompt && (
        <div onClick={() => setShowAdminPrompt(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', width: '340px', padding: '32px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#0d1b38' }}>Acceso Admin</h2>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#7a8fbb' }}>Ingresá la contraseña para activar el modo administrador.</p>
            <input
              type="password"
              value={adminPwInput}
              onChange={e => setAdminPwInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (adminPwInput === 'asap2026') { setAdminMode(true); setShowAdminPrompt(false) }
                  else setAdminPwInput('')
                }
                if (e.key === 'Escape') setShowAdminPrompt(false)
              }}
              placeholder="Contraseña"
              autoFocus
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #dde3f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { if (adminPwInput === 'asap2026') { setAdminMode(true); setShowAdminPrompt(false) } else setAdminPwInput('') }}
                style={{ flex: 1, background: '#2554a0', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
              >
                Ingresar
              </button>
              <button
                onClick={() => setShowAdminPrompt(false)}
                style={{ flex: 1, background: '#f1f5f9', color: '#374151', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ÉXITO ───────────────────────────────────────────────────── */}
      {toastExito && (
        <div style={{ position: 'fixed', bottom: '28px', right: '28px', zIndex: 1002, background: '#0d1b38', color: '#fff', padding: '14px 22px', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#4ade80', fontSize: '16px' }}>✓</span>
          {toastExito}
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

        {/* usuario logueado */}
        <div style={{ padding: '0 16px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#2554a0', border: '2px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {(session.user.user_metadata?.full_name || session.user.email || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuario'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
              Activo
            </div>
          </div>
        </div>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 20px 14px' }} />

        <div className="scroll-sin-barra" style={{ padding: '0 12px 10px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div
            onClick={() => irAVista('global', 'sa')}
            style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 10px', borderRadius: '9px', cursor: 'pointer', background: vista === 'global' ? 'rgba(37,84,160,0.45)' : 'transparent', border: vista === 'global' ? '1px solid rgba(107,151,232,0.3)' : '1px solid transparent', marginBottom: '8px' }}
          >
            <span style={{ color: '#fff', fontSize: '15px' }}>⊕</span>
            <span style={{ color: vista === 'global' ? '#fff' : 'rgba(255,255,255,0.65)', fontSize: '13px', fontWeight: 600, flex: 1 }}>Todos los comprobantes</span>
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />

          {(Object.entries(SOCIEDADES) as [SociedadKey, typeof SOCIEDADES[SociedadKey]][]).map(([key, sociedad]) => {
            const abierta = sociedadesAbiertas[key]
            const activa = sociedadActiva === key && vista !== 'global'
            const pendienteCount = key === 'sa' ? data.length : manualFacturas.filter(r => r.sociedad === key).length
            const historialCount = key === 'sa' ? historial.length : manualHistorial[key].length
            const clientesCount  = key === 'sa' ? clientesMap.size : new Set(manualFacturas.filter(r => r.sociedad === key).map(r => r.cliente)).size
            return (
              <div key={key} style={{ marginBottom: '8px' }}>
                <button
                  onClick={() => { setSociedadActiva(key); setSociedadesAbiertas(prev => ({ sa: false, llc: false, sl: false, [key]: !prev[key] })); if (vista === 'global') setVista('dashboard') }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '9px', border: activa ? '1px solid #3b6bc9' : '1px solid rgba(255,255,255,0.12)', background: activa ? '#2554a0' : 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span className={`fi fi-${sociedad.flagCode}`} style={{ borderRadius: '2px', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sociedad.nombre}</span>
                  </span>
                  <span>{abierta ? '▼' : '▶'}</span>
                </button>
                {abierta && (
                  <div style={{ padding: '6px 0 0 10px' }}>
                    {[
                      { vista: 'dashboard' as Vista, label: 'Dashboard', count: pendienteCount },
                      { vista: 'todos' as Vista, label: 'Comprobantes por cobrar', count: pendienteCount },
                      ...(sociedad.manual ? [{ vista: 'nueva' as Vista, label: 'Agregar factura', count: 0 }] : []),
                      { vista: 'historial' as Vista, label: 'Historial cobranzas', count: historialCount },
                      { vista: 'clientes' as Vista, label: 'Listado de clientes', count: clientesCount },
                    ].map(item => {
                      const itemActivo = sociedadActiva === key && vista === item.vista
                      return (
                        <div
                          key={`${key}-${item.vista}`}
                          onClick={() => item.vista === 'nueva' && !adminMode ? setShowAdminPrompt(true) : irAVista(item.vista, key)}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer', background: itemActivo ? 'rgba(37,84,160,0.4)' : 'transparent', color: itemActivo ? '#fff' : 'rgba(255,255,255,0.52)', fontSize: '12px', marginBottom: '1px' }}
                        >
                          <span>{item.vista === 'nueva' ? '+' : item.vista === 'historial' ? '○' : item.vista === 'clientes' ? '♧' : '▥'}</span>
                          <span style={{ flex: 1 }}>{item.label}</span>
                          {(item.vista === 'todos' || item.vista === 'historial') && <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '20px', background: item.vista === 'historial' ? 'rgba(5,150,105,0.25)' : 'rgba(220,38,38,0.3)', color: item.vista === 'historial' ? '#6ee7b7' : '#fca5a5', fontWeight: 700 }}>{item.count}</span>}
                        </div>
                      )
                    })}
                    {key === 'sa' && (
                      <div style={{ padding: '10px 0 0' }}>
                        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', padding: '0 8px', marginBottom: '6px' }}>Por ejecutivo</div>
                        {[...ejecutivos, ...(data.some(r => esSinAsignar(r.ejecutivo)) ? ['Sin asignar'] : [])].map(exec => {
                          const sinAsignar = exec === 'Sin asignar'
                          const ec = sinAsignar ? { bg: '#f8fafc', color: '#475569', initials: 'Sa' } : getExecColor(exec)
                          const count     = data.filter(r => sinAsignar ? esSinAsignar(r.ejecutivo) : r.ejecutivo === exec).length
                          const moraCount = data.filter(r => (sinAsignar ? esSinAsignar(r.ejecutivo) : r.ejecutivo === exec) && r.dias_mora > 0).length
                          const isActive  = sociedadActiva === 'sa' && ejecutivoSeleccionado === exec
                          return (
                            <div key={`sa-exec-${exec}`} onClick={() => { setSociedadActiva('sa'); setEjecutivoSeleccionado(exec); setVista('todos'); setFiltroClienteTabla(''); setFiltroEstadoTabla(''); setFiltroMoraRange(''); setSortCol(null); setSortDir('asc'); setExpandedRows(new Set()) }} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 10px', borderRadius: '9px', cursor: 'pointer', background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent', marginBottom: '2px', transition: 'background 0.15s' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: ec.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: ec.color, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>{ec.initials}</div>
                              <span style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.55)', fontSize: '12px', flex: 1, fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{exec}</span>
                              {moraCount > 0 && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f87171', flexShrink: 0 }} />}
                              <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}>{count}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* vistas */}
        <div style={{ display: 'none', padding: '0 12px 8px' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', padding: '0 8px', marginBottom: '6px' }}>Vistas</div>
          {([
            { key: 'dashboard', label: 'Dashboard',              count: data.length,       badgeStyle: 'blue'  },
            { key: 'todos',     label: 'Todos los comprobantes', count: data.length,       badgeStyle: 'blue'  },
            { key: 'historial', label: 'Historial cobrado',      count: historial.length,  badgeStyle: 'green' },
            { key: 'clientes',  label: 'Listado de clientes',    count: clientesMap.size,  badgeStyle: 'gray'  },
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
                  setFiltroClienteTabla(''); setFiltroEstadoTabla(''); setFiltroMoraRange('')
                  setFiltroEjecutivoHistorial(''); setFiltroClienteHistorial('')
                  setFiltroEjecutivoClientes(''); setFiltroEstadoClientes('')
                  setSortCol(null); setSortDir('asc'); setExpandedRows(new Set())
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

        {/* footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399' }} />
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>{fmtUltimaActualizacion(fechaUltimoReporte)}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={onCambiarModulo}
              title="Cambiar de app"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '11px', color: 'rgba(255,255,255,0.4)', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}
            >
              ⇄
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '11px', color: 'rgba(255,255,255,0.4)', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}
            >
              Salir
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ──────────────────────────────────────────────────────────── */}
      <main ref={mainRef} style={{ flex: 1, minWidth: 0, padding: '28px 32px', overflowY: 'auto', background: '#eef2f8' }}>

        {(errorCarga || errorComprobantes || errorHistorial || errorFacturasManuales) && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 16px', marginBottom: '14px', fontSize: '13px', color: '#dc2626', fontWeight: 500 }}>
            ⚠ {String(errorCarga || errorComprobantes || errorHistorial || errorFacturasManuales)}
          </div>
        )}

        {pdfNoEncontrado && (
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1002, background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '10px', padding: '16px 44px 16px 24px', fontSize: '14px', color: '#92400e', fontWeight: 500, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
            ⚠ Factura <strong>{pdfNoEncontrado}</strong> no subida a la base de datos.
            <button
              onClick={() => setPdfNoEncontrado('')}
              aria-label="Cerrar"
              style={{ position: 'absolute', top: '8px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontSize: '18px', lineHeight: 1, padding: '2px' }}
            >
              ×
            </button>
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
                {esDashboard ? 'Dashboard'
                  : esHistorial ? 'Historial cobrado'
                  : esClientes  ? 'Listado de clientes'
                  : ejecutivoSeleccionado || 'Todos los comprobantes'}
              </h1>
              <p style={{ color: '#7a8fbb', fontSize: '13px', margin: '2px 0 0' }}>· Al {new Date().toLocaleDateString('es-AR')}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {(esTabla || esGlobal) && (
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#7a8fbb', fontSize: '13px' }}>🔍</span>
                <input type="text" placeholder="Buscar cliente o factura..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid #dde3f0', fontSize: '13px', width: '220px', outline: 'none', color: '#0d1b38', background: '#fff' }} />
              </div>
            )}
            {(esClientes || esHistorial) && (
              <button onClick={exportar} style={{ background: '#2554a0', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                ↗ Exportar .xlsx
              </button>
            )}
            <button
              onClick={() => {
                if (adminMode) { setAdminMode(false) }
                else { setShowAdminPrompt(true); setAdminPwInput('') }
              }}
              style={{ background: adminMode ? '#0a1628' : '#fff', color: adminMode ? '#fff' : '#0d1b38', border: '1px solid #dde3f0', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              ⚙ {adminMode ? 'Admin ✓' : 'Admin'}
            </button>
          </div>
        </div>

        {adminMode && sociedadActiva === 'sa' && !esDashboard && !esGlobal && <SubirReporte batchUpsert={batchUpsert} />}

        {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
        {esGlobal ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', padding: '16px 20px', boxShadow: '0 2px 12px rgba(38,63,101,0.06)' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select style={SEL} value={globalFiltroEjecutivo} onChange={e => setGlobalFiltroEjecutivo(e.target.value)}>
                  <option value="">Todos los ejecutivos</option>
                  {globalEjecutivoOpts.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <select style={SEL} value={globalFiltroCliente} onChange={e => setGlobalFiltroCliente(e.target.value)}>
                  <option value="">Todos los clientes</option>
                  {globalClienteOpts.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select style={SEL} value={globalFiltroEstado} onChange={e => setGlobalFiltroEstado(e.target.value)}>
                  <option value="">Todos los estados</option>
                  <option value="pendiente">⏳ Pendientes de cobro</option>
                  <option value="cobrado">✅ Cobrados</option>
                  <option value="vencida">⚠ Vencidas</option>
                  <option value="sinvencer">🟢 Sin vencer</option>
                </select>
                {(busqueda || globalFiltroEjecutivo || globalFiltroCliente || globalFiltroEstado) && (
                  <button onClick={() => { setBusqueda(''); setGlobalFiltroEjecutivo(''); setGlobalFiltroCliente(''); setGlobalFiltroEstado('') }} style={BTN_LIMPIAR}>× Limpiar</button>
                )}
              </div>
              <div style={{ marginTop: '14px', color: '#4a6fa5', fontSize: '13px' }}>
                📊 Vista consolidada · ASAP SA · ASAP LLC · IT ASAP SL · incluye pendientes y cobrados
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(38,63,101,0.06)' }}>
              <div style={{ padding: '14px 22px', borderBottom: '1px solid #dde3f0', background: '#f8faff', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <strong style={{ fontSize: '14px', color: '#0d1b38' }}>Comprobantes</strong>
                <span style={{ color: '#7a8fbb', fontSize: '12px' }}>{globalRows.length} comprobantes</span>
                <button onClick={exportarGlobal} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#2554a0', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  ↓ .xlsx
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8faff' }}>
                      <th style={{ padding: '10px 6px', width: '32px' }} />
                      {['Empresa', 'Comprobante', 'Cliente', 'Ejecutivo', 'Emision', 'Monto', 'Estado', 'Mora', 'Factura'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Monto' ? 'right' : 'left', fontSize: '10px', color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid #dde3f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {globalRows.length === 0 ? (
                      <tr><td colSpan={10} style={{ padding: '58px', textAlign: 'center', color: '#7a8fbb' }}>Sin resultados.</td></tr>
                    ) : globalRows.map((r, idx) => {
                      const rowKey = `${r.estado}-${r.comprobante}-${idx}`
                      const isExp = expandedGlobalRows.has(rowKey)
                      const extra = extras.get(r.comprobante)
                      return (
                        <Fragment key={rowKey}>
                          <tr style={{ borderBottom: isExp ? 'none' : '1px solid #dde3f0' }}>
                            <td style={{ padding: '8px 4px 8px 6px' }}>
                              <button
                                onClick={() => setExpandedGlobalRows(prev => { const next = new Set(prev); if (next.has(rowKey)) next.delete(rowKey); else next.add(rowKey); return next })}
                                style={{ width: '22px', height: '22px', border: '1px solid #dde3f0', borderRadius: '4px', background: isExp ? '#2554a0' : '#f1f5f9', color: isExp ? '#fff' : '#374151', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
                              >
                                {isExp ? '−' : '+'}
                              </button>
                            </td>
                            <td style={{ padding: '11px 16px', fontSize: '12px', color: '#3d5278', whiteSpace: 'nowrap' }}>{r.empresa}</td>
                            <td style={{ padding: '11px 16px', fontSize: '12px', fontFamily: 'monospace', color: '#3d5278', whiteSpace: 'nowrap' }}>{r.comprobante}</td>
                            <td style={{ padding: '11px 16px', fontSize: '13px', fontWeight: 600, color: '#0d1b38' }}>{r.cliente}</td>
                            <td style={{ padding: '11px 16px', fontSize: '12px', color: '#7a8fbb' }}>{r.ejecutivo}</td>
                            <td style={{ padding: '11px 16px', fontSize: '12px', color: '#7a8fbb', whiteSpace: 'nowrap' }}>{fmtFecha(r.fecha)}</td>
                            <td style={{ padding: '11px 16px', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', textAlign: 'right' }}>{fmt(r.monto)}</td>
                            <td style={{ padding: '11px 16px' }}>
                              <span style={{ background: r.estado === 'Cobrada' ? '#d1fae5' : '#fef3c7', color: r.estado === 'Cobrada' ? '#065f46' : '#92400e', padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>{r.estado}</span>
                            </td>
                            <td style={{ padding: '11px 16px' }}>
                              {r.estado === 'Cobrada' ? (
                                <span style={{ color: '#94a3b8', fontSize: '11px' }}>—</span>
                              ) : (() => {
                                const badge = moraBadge(r.diasMora)
                                return <span style={{ background: badge.bg, color: badge.color, padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>{badge.label}</span>
                              })()}
                            </td>
                            <td style={{ padding: '11px 16px' }}>
                              <button onClick={() => abrirPdf({ comprobante: r.comprobante, nombre_cliente: r.cliente, ejecutivo: r.ejecutivo, fecha_emision: null, fecha_vencimiento: null, monto: r.monto, dias_mora: r.diasMora }, r.pdfDirecta)} style={{ background: '#f0f4ff', color: '#2554a0', border: 'none', borderRadius: '8px', padding: '5px 12px', fontWeight: 700, cursor: 'pointer' }}>Abrir PDF</button>
                            </td>
                          </tr>
                          {isExp && (
                            <tr style={{ borderBottom: '1px solid #dde3f0' }}>
                              <td colSpan={10} style={{ padding: 0 }}>
                                <DescPanel comprobante={r.comprobante} extra={extra} adminMode={adminMode} onUpdate={handleUpdateExtra} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '10px 18px', borderTop: '1px solid #dde3f0', background: '#f8faff', color: '#6b7fb3', fontSize: '11px', textAlign: 'right' }}>📁 PDFs en SharePoint · Microsoft 365</div>
            </div>
          </div>
        ) : esSociedadManual ? (
          <ManualSociedadView
            vista={vista}
            sociedad={sociedadActiva as Exclude<SociedadKey, 'sa'>}
            nombreSociedad={sociedadInfo.nombre}
            monedas={sociedadInfo.monedas}
            condicionOpts={CONDICION_OPTS}
            adminMode={adminMode}
            facturas={manualSociedadRows}
            historial={manualHistorial[sociedadActiva]}
            execsConocidos={manualExecs[sociedadActiva]}
            clientesConocidos={manualClients[sociedadActiva]}
            busqueda={busqueda}
            editando={editandoManual}
            fmtFecha={fmtFecha}
            calcularVencimientoPorCondicion={calcularVencimientoPorCondicion}
            calcularDiasMora={calcularDiasMora}
            onShowAdminPrompt={() => setShowAdminPrompt(true)}
            onIrANueva={() => irAVista('nueva', sociedadActiva)}
            onEditar={f => { setEditandoManual(f); setVista('nueva') }}
            onGuardarFactura={guardarOEditarFacturaManual}
            onCancelarFactura={() => { setEditandoManual(null); setVista('todos') }}
            onMarcarCobrada={marcarCobradaManual}
            onDeshacerCobro={deshacerCobroManual}
            onReasignarEjecutivo={(cliente, nuevo) => reasignarEjecutivoManual(sociedadActiva, cliente, nuevo)}
            onAbrirPdf={f => abrirPdf({ comprobante: f.comprobante, nombre_cliente: f.cliente, ejecutivo: f.ejecutivo, fecha_emision: f.fecha_emision, fecha_vencimiento: f.fecha_vencimiento, monto: f.monto, dias_mora: calcularDiasMora(f.fecha_vencimiento) }, f.pdf_base64 || f.pdf_url || undefined)}
            onVerFacturasCliente={cliente => { setBusqueda(cliente); setVista('todos') }}
          />
        ) : esDashboard ? (
          <>
            <SubirReporte batchUpsert={batchUpsert} onExport={exportDashboard} />
            {loading && data.length === 0 ? (
              <div style={{ padding: '80px 20px', textAlign: 'center', color: '#7a8fbb', fontSize: '16px' }}>
                <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #dde3f0', borderTopColor: '#2554a0', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '16px' }} />
                <div>Cargando datos...</div>
              </div>
            ) : (
              <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '24px' }}>

              {/* KPI CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', padding: '22px 24px', boxShadow: '0 2px 8px rgba(10,22,40,0.08)', borderLeft: '5px solid #dc2626', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: '-10px', top: '-10px', width: '70px', height: '70px', background: '#fee2e2', borderRadius: '50%', opacity: 0.4 }} />
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>💸 Total vencido</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace', lineHeight: 1, marginBottom: '6px' }}>{fmt(totalVencido)}</div>
                  <div style={{ fontSize: '12px', color: '#7a8fbb' }}>{vencidasArr.length} facturas · {clientDashList.length} clientes</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', padding: '22px 24px', boxShadow: '0 2px 8px rgba(10,22,40,0.08)', borderLeft: '5px solid #d97706', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: '-10px', top: '-10px', width: '70px', height: '70px', background: '#fef3c7', borderRadius: '50%', opacity: 0.4 }} />
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>⏳ Vence en 7 días</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#d97706', fontFamily: 'monospace', lineHeight: 1, marginBottom: '6px' }}>{fmt(totalProxAVencer)}</div>
                  <div style={{ fontSize: '12px', color: '#7a8fbb' }}>{proxAVencer.length} facturas próximas a vencer</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', padding: '22px 24px', boxShadow: '0 2px 8px rgba(10,22,40,0.08)', borderLeft: '5px solid #059669', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: '-10px', top: '-10px', width: '70px', height: '70px', background: '#d1fae5', borderRadius: '50%', opacity: 0.4 }} />
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>✅ Sin vencer</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#059669', fontFamily: 'monospace', lineHeight: 1, marginBottom: '6px' }}>{fmt(totalSinVencer)}</div>
                  <div style={{ fontSize: '12px', color: '#7a8fbb' }}>{sinVencerArr.length} facturas al día</div>
                </div>
              </div>

              {/* SLIM METRICS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', padding: '14px 18px', boxShadow: '0 1px 4px rgba(10,22,40,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>💹</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Cartera en mora</div>
                    <div style={{ height: '4px', background: '#eef2fa', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${porcentajeMora}%`, height: '100%', background: '#7c3aed', borderRadius: '3px', transition: 'width 0.5s' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#7c3aed', flexShrink: 0 }}>{porcentajeMora}%</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', padding: '14px 18px', boxShadow: '0 1px 4px rgba(10,22,40,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>⏱</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Mora promedio</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{vencidasArr.length} facturas vencidas</div>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#d97706', flexShrink: 0 }}>{moraPromedio}d</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', padding: '14px 18px', boxShadow: '0 1px 4px rgba(10,22,40,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>📊</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Promedio de cobro</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>sin cobros aún</div>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#94a3b8', flexShrink: 0 }}>—</div>
                </div>
              </div>

              {/* CLIENTS + PIE */}
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '14px' }}>
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(10,22,40,0.07)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef2fa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d1b38' }}>Deuda por cliente</span>
                    <span style={{ fontSize: '11px', color: '#7a8fbb' }}>clic para ver facturas</span>
                  </div>
                  <div style={{ padding: '12px 20px' }}>
                    {(mostrarTodosClientesDash ? clientDashList : clientDashList.slice(0, 10)).map((c, i) => {
                      const bc = DASH_BAR_COLORS[i % DASH_BAR_COLORS.length]
                      return (
                        <div key={c.name} style={{ marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '8px' }}>
                            <span onClick={() => { setFiltroClienteTabla(c.name); setBusqueda(''); setFiltroEstadoTabla(''); setFiltroMoraRange(''); setEjecutivoSeleccionado(null); setVista('todos') }} style={{ fontSize: '13px', fontWeight: 600, color: '#1d4170', textDecoration: 'underline', textDecorationColor: '#a8c4f5', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '45%' }}>{c.name}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              <span title="Monto total vencido de este cliente" style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#0d1b38', minWidth: '110px', textAlign: 'right' }}>{fmt(c.monto)}</span>
                              <span title="% que representa este cliente sobre el total de la deuda vencida" style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '20px', background: bc + '18', border: '1px solid ' + bc + '35', color: bc }}>{c.pct}%</span>
                              <span title="Días de mora promedio de las facturas vencidas de este cliente" style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '20px', background: '#fef3c7', color: '#92400e' }}>{c.moraProm}d</span>
                            </span>
                          </div>
                          <div style={{ height: '4px', background: '#eef2fa', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: c.pct + '%', height: '100%', background: bc, borderRadius: '3px', transition: 'width 0.5s' }} />
                          </div>
                        </div>
                      )
                    })}
                    {clientDashList.length === 0 && <div style={{ color: '#7a8fbb', fontSize: '13px', padding: '20px 0', textAlign: 'center' }}>Sin clientes con mora</div>}
                    {clientDashList.length > 10 && (
                      <button
                        onClick={() => setMostrarTodosClientesDash(v => !v)}
                        style={{ width: '100%', marginTop: '4px', padding: '8px', fontSize: '12px', fontWeight: 700, color: '#1d4170', background: '#f8faff', border: '1px dashed #c7d3ea', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        {mostrarTodosClientesDash
                          ? '▲ Ver menos'
                          : `▼ Ver ${clientDashList.length - 10} clientes más (${fmt(clientDashList.slice(10).reduce((s, c) => s + c.monto, 0))})`}
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(10,22,40,0.07)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef2fa' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d1b38' }}>Deuda por ejecutivo</span>
                  </div>
                  <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    {execPieList.length > 0
                      ? svgPie(execPieList.map(e => ({ value: e.monto, color: e.color })), 150)
                      : <div style={{ color: '#7a8fbb', fontSize: '13px', padding: '30px' }}>Sin datos</div>
                    }
                    <div style={{ width: '100%' }}>
                      {execPieList.map(e => (
                        <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid #f8faff' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: e.color, flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', color: '#3d5278', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#0d1b38' }}>{fmt(e.monto)}</span>
                          <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '20px', background: '#e0e7ff', color: '#4338ca' }}>{e.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* MORA DIST + CLIENTES AL DIA */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(10,22,40,0.07)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef2fa' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d1b38' }}>Distribución por mora</span>
                  </div>
                  <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {moraDist.map(b => (
                      <div key={b.label} style={{ background: b.bg, border: '1px solid ' + b.color + '30', borderRadius: '10px', padding: '14px', borderLeft: '4px solid ' + b.color }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: b.color, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>{b.label}</div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: b.color, fontFamily: 'monospace', lineHeight: 1, marginBottom: '4px' }}>{b.items.length}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>facturas</div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginTop: '4px' }}>{fmt(b.items.reduce((s, r) => s + r.monto, 0))}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(10,22,40,0.07)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef2fa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d1b38' }}>Clientes al día</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: '#d1fae5', color: '#065f46' }}>{clientesAlDia.length}</span>
                  </div>
                  <div style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                    {clientesAlDia.length === 0
                      ? <div style={{ color: '#7a8fbb', fontSize: '13px' }}>Sin clientes al día</div>
                      : clientesAlDia.map(n => (
                          <span key={n} onClick={() => { setBusqueda(n); setVista('todos') }} style={{ fontSize: '12px', fontWeight: 500, padding: '4px 10px', borderRadius: '20px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#065f46', cursor: 'pointer', whiteSpace: 'nowrap' }}>{n}</span>
                        ))
                    }
                  </div>
                </div>
              </div>

            </div>
              </>
            )}
          </>

        /* ── HISTORIAL ──────────────────────────────────────────────────── */
        ) : esHistorial ? (
          <>
            {/* ── Filtros ── */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={filtroEjecutivoHistorial} onChange={e => setFiltroEjecutivoHistorial(e.target.value)} style={SEL}>
                <option value="">Todos los ejecutivos</option>
                {EJECUTIVOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select value={filtroClienteHistorial} onChange={e => setFiltroClienteHistorial(e.target.value)} style={SEL}>
                <option value="">Todos los clientes</option>
                {clientesHistorialOpts.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="date" value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)}
                style={{ ...SEL, padding: '6px 10px' }} title="Desde" />
              <input type="date" value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)}
                style={{ ...SEL, padding: '6px 10px' }} title="Hasta" />
              {hayFiltrosHistorial && <button onClick={limpiarFiltrosHistorial} style={BTN_LIMPIAR}>✕ Limpiar</button>}
            </div>

            {/* ── Tabla ── */}
            <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #dde3f0', display: 'flex', alignItems: 'center', gap: '8px', background: '#f8faff' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0d1b38' }}>Historial de cobros</span>
                <span style={{ fontSize: '12px', color: '#7a8fbb' }}>{historialFiltrado.length} registros</span>
                {loadingHistorial && <span style={{ fontSize: '11px', color: '#d97706' }}>Actualizando...</span>}
                <button onClick={exportar} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#2554a0', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  ↓ .xlsx
                </button>
              </div>
              {loadingHistorial && historial.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#7a8fbb' }}>Cargando...</div>
              ) : historialFiltrado.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#7a8fbb' }}>No hay registros para los filtros aplicados.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8faff', borderBottom: '1px solid #dde3f0' }}>
                        {['', ...['Comprobante', 'Cliente', 'Ejecutivo', 'Fecha cobro', 'Monto', 'Estado', 'PDF'], ...(adminMode ? [''] : [])].map((h, i) => (
                          <th key={h || `acc-${i}`} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 600, color: '#7a8fbb', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historialFiltrado.map((r) => {
                        const ec = getExecColor(r.ejecutivo)
                        const fecha = r.fecha_cobro ? r.fecha_cobro.slice(0, 10) : '-'
                        const rowKey = `hist-${r.comprobante_id || r.comprobante_numero}`
                        const isExp = expandedRows.has(rowKey)
                        const extra = extras.get(r.comprobante_numero)
                        return (
                          <Fragment key={rowKey}>
                          <tr
                            style={{ borderBottom: isExp ? 'none' : '1px solid #dde3f0' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}>
                            <td style={{ padding: '8px 4px 8px 12px', width: '32px' }}>
                              <button
                                onClick={() => setExpandedRows(prev => { const next = new Set(prev); if (next.has(rowKey)) next.delete(rowKey); else next.add(rowKey); return next })}
                                style={{ width: '22px', height: '22px', border: '1px solid #dde3f0', borderRadius: '4px', background: isExp ? '#2554a0' : '#f1f5f9', color: isExp ? '#fff' : '#374151', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
                              >
                                {isExp ? '−' : '+'}
                              </button>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '12px', fontFamily: 'monospace', color: '#3d5278', whiteSpace: 'nowrap' }}>{r.comprobante_numero}</td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#0d1b38', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cliente}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: '20px', background: ec.bg + '20', color: ec.bg, whiteSpace: 'nowrap' }}>
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: ec.bg, flexShrink: 0 }} />
                                {r.ejecutivo || 'Sin asignar'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '12px', color: '#3d5278', whiteSpace: 'nowrap' }}>{fecha}</td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', color: '#059669', whiteSpace: 'nowrap' }}>{fmt(r.monto)}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ display: 'inline-block', background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0', borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: 600 }}>Cobrado</span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <button onClick={() => abrirPdf({ ...r, comprobante: r.comprobante_numero, nombre_cliente: r.cliente, fecha_emision: null, fecha_vencimiento: null })} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f0f4ff', color: '#2554a0', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                                📄 Ver PDF
                              </button>
                            </td>
                            {adminMode && (
                              <td style={{ padding: '12px 16px' }}>
                                <button onClick={() => handleDeshacerCobro(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#fff5f5', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                  ↩ Deshacer
                                </button>
                              </td>
                            )}
                          </tr>
                          {isExp && (
                            <tr style={{ borderBottom: '1px solid #dde3f0' }}>
                              <td colSpan={adminMode ? 9 : 8} style={{ padding: 0 }}>
                                <DescPanel comprobante={r.comprobante_numero} extra={extra} adminMode={adminMode} onUpdate={handleUpdateExtra} />
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
            </div>
          </>

        /* ── LISTADO DE CLIENTES ──────────────────────────────────────── */
        ) : esClientes ? (
          <>
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
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0d1b38' }}>Listado de clientes y ejecutivos</span>
                <span style={{ fontSize: '12px', color: '#7a8fbb' }}>Clientes con deuda activa: {clientesFiltrados.filter(c => c.vencido > 0).length}</span>
                <button onClick={exportar} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#2554a0', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>↓ .xlsx</button>
              </div>
              {clientesFiltrados.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#7a8fbb' }}>No hay clientes para los filtros aplicados.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8faff', borderBottom: '1px solid #dde3f0' }}>
                        {['Cliente', 'Ejecutivo asignado', 'Condición habitual', 'Cambiar ejecutivo'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {clientesFiltrados.map(c => {
                        const execEfectivo = localEjecutivos[c.cliente] || c.ejecutivo
                        const ec = getExecColor(execEfectivo)
                        return (
                          <tr key={c.cliente} style={{ borderBottom: '1px solid #dde3f0' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}>
                            <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, color: '#0d1b38', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cliente}</td>
                            <td style={{ padding: '14px 16px' }}>
                              {execEfectivo === 'Sin asignar' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', border: '1px solid #fcd34d' }}>⚠ Sin asignar</span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: ec.bg, color: ec.color, padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, flexShrink: 0 }}>{ec.initials}</span>
                                  {execEfectivo}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {c.condiciones.length > 0
                                  ? c.condiciones.map(cond => (
                                      <span key={cond} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap' }}>{cond}</span>
                                    ))
                                  : <span style={{ color: '#94a3b8', fontSize: '12px' }}>---</span>}
                              </div>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <select
                                value=""
                                onChange={e => {
                                  const nuevo = e.target.value
                                  if (!nuevo) return
                                  const viejo = execEfectivo
                                  setLocalEjecutivos(prev => ({ ...prev, [c.cliente]: nuevo }))
                                  updateEjecutivoLocal(c.cliente, nuevo)
                                  handleAsignarEjecutivo(c.cliente, nuevo, viejo)
                                }}
                                style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #dde3f0', fontSize: '12px', color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none' }}
                              >
                                <option value="">— cambiar —</option>
                                {EJECUTIVOS.map(e => <option key={e} value={e}>{e}</option>)}
                              </select>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>

        /* ── TABLA ────────────────────────────────────────────────────── */
        ) : (
          <>
            {esPanelEjecutivo && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px', marginBottom: '24px' }}>
                {[
                  { label: 'Tu cartera total', value: fmt(carteraTotal), sub: `${dataSel.length} comprobantes`, color: '#2554a0' },
                  { label: 'Revisión urgente', value: fmt(totalVencido), sub: `${vencidasArr.length} facturas en mora`, color: '#dc2626' },
                  { label: 'Próximas a vencer', value: String(proxAVencer.length), sub: 'vencen en 7 días', color: '#d97706' },
                  { label: 'Al día', value: String(sinVencerArr.length), sub: 'comprobantes sin vencer', color: '#059669' },
                ].map(card => (
                  <div
                    key={card.label}
                    style={{ background: '#fff', border: '1px solid #dde3f0', borderTop: `3px solid ${card.color}`, borderRadius: '10px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(10,22,40,0.08)', position: 'relative', overflow: 'hidden' }}
                  >
                    <div style={{ position: 'absolute', top: 0, right: 0, width: '70px', height: '70px', borderRadius: '0 10px 0 70px', background: card.color, opacity: 0.06 }} />
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: '8px' }}>{card.label}</div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: card.color, fontFamily: 'monospace', lineHeight: 1, marginBottom: '6px' }}>{card.value}</div>
                    <div style={{ fontSize: '11px', color: '#7a8fbb' }}>{card.sub}</div>
                  </div>
                ))}
              </div>
            )}
            {/* barra de filtros */}
            {!esPanelEjecutivo && <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={ejecutivoSeleccionado || ''} onChange={e => setEjecutivoSeleccionado(e.target.value || null)} style={SEL}>
                <option value="">Todos los ejecutivos</option>
                {EJECUTIVOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select value={filtroClienteTabla} onChange={e => setFiltroClienteTabla(e.target.value)} style={SEL}>
                <option value="">Todos los clientes</option>
                {clientesTablaOpts.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filtroEstadoTabla} onChange={e => { setFiltroEstadoTabla(e.target.value); setFiltroMoraRange('') }} style={SEL}>
                <option value="">Todos los estados</option>
                <option value="sinvencer">Al día (sin vencer)</option>
                <option value="proximas">Próximas a vencer (7d)</option>
                <option value="mora">En mora</option>
                <option value="1-30">Mora 1–30 días</option>
                <option value="31-60">Mora 31–60 días</option>
                <option value="60+">Mora +60 días</option>
              </select>
              {hayFiltrosTabla && <button onClick={limpiarFiltrosTabla} style={BTN_LIMPIAR}>✕ Limpiar</button>}
            </div>}
            {!esPanelEjecutivo && filtroEstadoTabla === 'mora' && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                {([
                  { v: '',         label: 'Todos',            ac: '#374151', ia: '#f1f5f9', tc: '#374151', bc: '#9ca3af' },
                  { v: 'recien',   label: '⚡ Recién 1–7d',   ac: '#d97706', ia: '#fef3c7', tc: '#92400e', bc: '#d97706' },
                  { v: 'atencion', label: '⚠ Atención 8–15d', ac: '#ea580c', ia: '#ffedd5', tc: '#c2410c', bc: '#ea580c' },
                  { v: 'critica',  label: '🔴 Crítica 16–30d', ac: '#dc2626', ia: '#fee2e2', tc: '#dc2626', bc: '#dc2626' },
                  { v: 'urgente',  label: '🚨 Urgente +30d',  ac: '#7c3aed', ia: '#ede9fe', tc: '#7c3aed', bc: '#7c3aed' },
                ] as { v: string; label: string; ac: string; ia: string; tc: string; bc: string }[]).map(opt => {
                  const active = filtroMoraRange === opt.v
                  return (
                    <button key={opt.v} onClick={() => setFiltroMoraRange(opt.v)}
                      style={{ padding: '5px 14px', borderRadius: '20px', border: `1px solid ${opt.bc}40`, background: active ? opt.bc : opt.ia, color: active ? '#fff' : opt.tc, fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            )}


            {(() => {
              const base   = aplicarFiltroEstado(filtrados)
              const ranged = filtroMoraRange === 'recien'   ? base.filter(r => r.dias_mora >= 1 && r.dias_mora <= 7)
                           : filtroMoraRange === 'atencion' ? base.filter(r => r.dias_mora > 7 && r.dias_mora <= 15)
                           : filtroMoraRange === 'critica'  ? base.filter(r => r.dias_mora > 15 && r.dias_mora <= 30)
                           : filtroMoraRange === 'urgente'  ? base.filter(r => r.dias_mora > 30)
                           : base

              const vencidas  = !sortCol ? ranged.filter(r => r.dias_mora > 0)  : []
              const proximasTabla = !sortCol && esPanelEjecutivo ? ranged.filter(esProximaAVencer) : []
              const proximasTablaSet = new Set(proximasTabla.map(rowKey))
              const sinVencer = !sortCol
                ? ranged.filter(r => r.dias_mora <= 0 && (!esPanelEjecutivo || !proximasTablaSet.has(rowKey(r))))
                : []
              const ordenados = sortCol
                ? [...ranged].sort((a: any, b: any) => {
                    const av = a[sortCol]; const bv = b[sortCol]
                    const cmp = typeof av === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''))
                    return sortDir === 'asc' ? cmp : -cmp
                  })
                : [...vencidas, ...proximasTabla, ...sinVencer]

              const COLS = [
                { key: '',                  label: '',            sortable: false },
                { key: 'comprobante',       label: 'Comprobante', sortable: true  },
                { key: 'nombre_cliente',    label: 'Cliente',     sortable: true  },
                { key: 'fecha_emision',     label: 'Emisión',     sortable: true  },
                { key: 'condicion',         label: 'Condición',   sortable: true  },
                { key: 'fecha_vencimiento', label: 'Vencimiento', sortable: true  },
                { key: 'monto',             label: 'Monto',       sortable: true  },
                { key: 'dias_mora',         label: 'Mora',        sortable: true  },
                { key: '',                  label: 'Factura',     sortable: false },
              ]

              return (
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #dde3f0', display: 'flex', alignItems: 'center', gap: '8px', background: '#f8faff' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#0d1b38' }}>Comprobantes</span>
                    <span style={{ fontSize: '12px', color: '#7a8fbb' }}>{ordenados.length} comprobantes</span>
                    {loading && <span style={{ fontSize: '11px', color: '#d97706' }}>Actualizando...</span>}
                    {adminMode && (
                      <button
                        onClick={handleMarcarCobradas}
                        disabled={seleccionCobro.size === 0 || marcandoCobro}
                        style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', background: seleccionCobro.size === 0 || marcandoCobro ? '#94a3b8' : '#059669', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: seleccionCobro.size === 0 || marcandoCobro ? 'not-allowed' : 'pointer' }}
                      >
                        {marcandoCobro ? 'Marcando...' : `✓ Marcar cobradas${seleccionCobro.size > 0 ? ` (${seleccionCobro.size})` : ''}`}
                      </button>
                    )}
                    <button onClick={exportar} style={{ marginLeft: adminMode ? 0 : 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#2554a0', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      ↓ .xlsx
                    </button>
                  </div>
                  {loading && data.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#7a8fbb' }}>Cargando...</div>
                  ) : filtrados.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#7a8fbb' }}>No hay comprobantes para mostrar</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table key={tableKey} style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f8faff', borderBottom: '1px solid #dde3f0' }}>
                            {adminMode && (
                              <th style={{ padding: '10px 6px', width: '32px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={ordenados.length > 0 && ordenados.every(r => seleccionCobro.has(String(r.id)))}
                                  onChange={e => setSeleccionCobro(e.target.checked ? new Set(ordenados.map(r => String(r.id))) : new Set())}
                                  style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                                />
                              </th>
                            )}
                            {COLS.map((col, ci) => (
                              <th key={ci}
                                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                                style={{ padding: '10px 16px', textAlign: col.key === 'monto' ? 'right' : 'left', fontSize: '10px', fontWeight: 600, color: sortCol === col.key ? '#2554a0' : '#7a8fbb', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: col.sortable ? 'pointer' : 'default', userSelect: 'none' }}
                              >
                                {col.label}{col.sortable && sortCol === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ordenados.map((r, idx) => {
                            const badge = moraBadge(r.dias_mora)
                            const showSep = !esPanelEjecutivo && !sortCol && vencidas.length > 0 && sinVencer.length > 0 && idx === vencidas.length
                            const showRevision = esPanelEjecutivo && !sortCol && vencidas.length > 0 && idx === 0
                            const showProximas = esPanelEjecutivo && !sortCol && proximasTabla.length > 0 && idx === vencidas.length
                            const showSinVencer = esPanelEjecutivo && !sortCol && sinVencer.length > 0 && idx === vencidas.length + proximasTabla.length
                            const rowKey = r.id ? String(r.id) : r.comprobante
                            const isExp  = expandedRows.has(rowKey)
                            const extra  = extras.get(r.comprobante)
                            const condDisplay = extra?.condicion_override || r.condicion || '-'
                            return (
                              <Fragment key={rowKey}>
                                {/* separator — always in DOM, hidden via display to avoid insertBefore */}
                                <tr style={{ display: showSep ? '' : 'none', background: '#d1fae5' }}>
                                  <td colSpan={adminMode ? 10 : 9} style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700, color: '#065f46' }}>
                                    Al día — {sinVencer.length} {sinVencer.length === 1 ? 'factura' : 'facturas'}
                                  </td>
                                </tr>
                                <tr id={showRevision ? 'section-revision' : undefined} style={{ display: showRevision ? '' : 'none', background: '#fee2e2' }}>
                                  <td colSpan={adminMode ? 10 : 9} style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 700, color: '#991b1b', borderBottom: '2px solid #fca5a5' }}>
                                    ⚠ Vencidas — {vencidas.length} {vencidas.length === 1 ? 'factura' : 'facturas'}
                                  </td>
                                </tr>
                                <tr id={showProximas ? 'section-proximas' : undefined} style={{ display: showProximas ? '' : 'none', background: '#fef3c7' }}>
                                  <td colSpan={adminMode ? 10 : 9} style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 700, color: '#92400e', borderBottom: '2px solid #fde68a' }}>
                                    Próximas a vencer — {proximasTabla.length} {proximasTabla.length === 1 ? 'factura' : 'facturas'}
                                  </td>
                                </tr>
                                <tr id={showSinVencer ? 'section-sinvencer' : undefined} style={{ display: showSinVencer ? '' : 'none', background: '#d1fae5' }}>
                                  <td colSpan={adminMode ? 10 : 9} style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 700, color: '#065f46', borderBottom: '2px solid #6ee7b7' }}>
                                    Al día — {sinVencer.length} {sinVencer.length === 1 ? 'factura' : 'facturas'}
                                  </td>
                                </tr>
                                <tr
                                  style={{ borderBottom: isExp ? 'none' : '1px solid #dde3f0', background: r.dias_mora > 0 ? 'rgba(254,226,226,0.25)' : '' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                                  onMouseLeave={e => (e.currentTarget.style.background = r.dias_mora > 0 ? 'rgba(254,226,226,0.25)' : '')}
                                >
                                  {adminMode && (
                                    <td style={{ padding: '11px 6px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        checked={seleccionCobro.has(String(r.id))}
                                        onChange={e => setSeleccionCobro(prev => { const next = new Set(prev); const key = String(r.id); if (e.target.checked) next.add(key); else next.delete(key); return next })}
                                        style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                                      />
                                    </td>
                                  )}
                                  <td style={{ padding: '8px 4px 8px 12px', width: '32px' }}>
                                    <button
                                      onClick={() => setExpandedRows(prev => { const next = new Set(prev); if (next.has(rowKey)) next.delete(rowKey); else next.add(rowKey); return next })}
                                      style={{ width: '22px', height: '22px', border: '1px solid #dde3f0', borderRadius: '4px', background: isExp ? '#2554a0' : '#f1f5f9', color: isExp ? '#fff' : '#374151', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
                                    >
                                      {isExp ? '−' : '+'}
                                    </button>
                                  </td>
                                  <td style={{ padding: '11px 16px', fontSize: '12px', fontFamily: 'monospace', color: '#3d5278', whiteSpace: 'nowrap' }}>{r.comprobante}</td>
                                  <td style={{ padding: '11px 16px', fontSize: '13px', fontWeight: 600, color: '#0d1b38', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre_cliente}</td>
                                  <td style={{ padding: '11px 16px', fontSize: '12px', color: '#7a8fbb', whiteSpace: 'nowrap' }}>{fmtFecha(r.fecha_emision)}</td>
                                  <td style={{ padding: '11px 16px', fontSize: '12px', color: '#7a8fbb', whiteSpace: 'nowrap' }}>{condDisplay}</td>
                                  <td style={{ padding: '11px 16px', fontSize: '12px', color: '#3d5278', whiteSpace: 'nowrap' }}>{fmtFecha(r.fecha_vencimiento)}</td>
                                  <td style={{ padding: '11px 16px', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(r.monto)}</td>
                                  <td style={{ padding: '11px 16px' }}>
                                    <span style={{ background: badge.bg, color: badge.color, padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>{badge.label}</span>
                                  </td>
                                  <td style={{ padding: '11px 16px' }}>
                                    <button onClick={() => abrirPdf(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f0f4ff', color: '#2554a0', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                      📄 Abrir PDF
                                    </button>
                                  </td>
                                </tr>
                                {/* expanded row — always in DOM, hidden via display to avoid insertBefore */}
                                <tr style={{ display: isExp ? '' : 'none', borderBottom: '1px solid #dde3f0' }}>
                                  <td colSpan={adminMode ? 10 : 9} style={{ padding: 0 }}>
                                    {isExp && <DescPanel comprobante={r.comprobante} extra={extra} adminMode={adminMode} condicionActual={r.condicion || ''} onUpdate={handleUpdateExtra} />}
                                  </td>
                                </tr>
                              </Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })()}
          </>
        )}
      </main>
    </div>
  )
}

export default App
