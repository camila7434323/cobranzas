import { useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useFacturacionLineas, type FacturacionLinea } from './hooks/useFacturacionLineas'
import { SubirFacturacionExcel } from './components/SubirFacturacionExcel'

type Vista = 'dashboard' | 'detalle'

const PALETTE = ['#0e7490', '#059669', '#d97706', '#7c3aed', '#155e75', '#9d174d', '#3730a3']

const fmt = (n: number, moneda: string) => {
  const simbolo = moneda === 'USD' ? 'US$' : moneda === 'EUR' ? 'EUR' : '$'
  return `${simbolo} ${Math.round(n).toLocaleString('es-AR')}`
}

const fmtFecha = (v: string | null) => {
  if (!v) return '-'
  const [y, m, d] = v.split('-')
  return `${d}/${m}/${y}`
}

const mesLabel = (v: string | null) => {
  if (!v) return 'Sin periodo'
  const [y, m] = v.split('-')
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${meses[Number(m) - 1] || m} ${y}`
}

const monedaEmpresa = (filas: FacturacionLinea[]) => {
  const counts = filas.reduce<Record<string, number>>((acc, r) => {
    acc[r.moneda || 'ARS'] = (acc[r.moneda || 'ARS'] || 0) + 1
    return acc
  }, {})
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'ARS'
}

const flagCode = (moneda: string) => moneda === 'USD' ? 'us' : moneda === 'EUR' ? 'es' : 'ar'

function groupSum<T extends string>(rows: FacturacionLinea[], key: (r: FacturacionLinea) => T) {
  const map = new Map<T, number>()
  rows.forEach(r => map.set(key(r), (map.get(key(r)) || 0) + r.total_neto))
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
}

export function FacturacionApp({ session, onCambiarModulo }: { session: Session; onCambiarModulo: () => void }) {
  const { data, loading, error, insertarLote } = useFacturacionLineas()
  const [vista, setVista] = useState<Vista>('detalle')
  const [empresaActiva, setEmpresaActiva] = useState('all')
  const [busqueda, setBusqueda] = useState('')

  const empresas = useMemo(() => {
    const map = new Map<string, { nombre: string; moneda: string; count: number }>()
    data.forEach(r => {
      if (!r.empresa) return
      const actual = map.get(r.empresa)
      if (actual) actual.count++
      else map.set(r.empresa, { nombre: r.empresa, moneda: monedaEmpresa(data.filter(x => x.empresa === r.empresa)), count: 1 })
    })
    return Array.from(map.values()).sort((a, b) => {
      const pa = a.moneda === 'ARS' ? 0 : 1
      const pb = b.moneda === 'ARS' ? 0 : 1
      return pa !== pb ? pa - pb : a.nombre.localeCompare(b.nombre)
    })
  }, [data])

  const rowsEmpresa = empresaActiva === 'all' ? data : data.filter(r => r.empresa === empresaActiva)
  const filas = rowsEmpresa.filter(r => {
    if (!busqueda.trim()) return true
    const q = busqueda.toLowerCase()
    return [r.cliente, r.cuit, r.ejecutivo, r.n_factura, r.cc_descripcion, r.empresa]
      .some(v => String(v || '').toLowerCase().includes(q))
  })

  const moneda = monedaEmpresa(rowsEmpresa)
  const total = filas.reduce((s, r) => s + r.total_neto, 0)
  const clientes = new Set(filas.map(r => r.cliente).filter(Boolean)).size
  const ejecutivos = new Set(filas.map(r => r.ejecutivo).filter(Boolean)).size
  const facturas = new Set(filas.map(r => r.n_factura).filter(Boolean)).size
  const porCliente = groupSum(filas, r => r.cliente || 'Sin cliente').slice(0, 8)
  const porEjecutivo = groupSum(filas, r => r.ejecutivo || 'Sin asignar').slice(0, 8)
  const porPeriodo = groupSum(filas, r => mesLabel(r.periodo)).slice(0, 8)
  const maxCliente = porCliente[0]?.[1] || 1
  const maxEjecutivo = porEjecutivo[0]?.[1] || 1
  const maxPeriodo = porPeriodo[0]?.[1] || 1

  const irEmpresa = (empresa: string) => {
    setEmpresaActiva(empresa)
    setVista('detalle')
    window.scrollTo({ top: 0 })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: '100vh', background: '#eff8fd', color: '#0d1b38', fontFamily: 'Inter, sans-serif' }}>
      <aside style={{ background: '#0c2436', display: 'flex', flexDirection: 'column', boxShadow: '2px 0 12px rgba(10,22,40,0.18)' }}>
        <div style={{ padding: '22px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '3px' }}>
            <div style={{ width: '32px', height: '32px', background: '#0ea5e9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>F</div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Facturación</span>
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginLeft: '42px' }}>ASAP Consulting</div>
        </div>

        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', padding: '14px 20px 6px' }}>Vistas</div>
        <button onClick={() => setVista('dashboard')} style={navStyle(vista === 'dashboard')}>
          <span style={{ fontSize: '15px' }}>▥</span>
          Panel de Ventas
        </button>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '8px 20px' }} />
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', padding: '6px 20px' }}>Compañías</div>
        <button onClick={() => irEmpresa('all')} style={navStyle(vista === 'detalle' && empresaActiva === 'all')}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7dd3fc' }} />
          Todas las compañías
        </button>
        {empresas.map(e => (
          <button key={e.nombre} onClick={() => irEmpresa(e.nombre)} style={navStyle(vista === 'detalle' && empresaActiva === e.nombre)}>
            <span className={`fi fi-${flagCode(e.moneda)}`} style={{ borderRadius: '2px', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nombre}</span>
          </button>
        ))}

        <div style={{ marginTop: 'auto', padding: '14px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'grid', gap: '8px' }}>
          <button onClick={onCambiarModulo} style={sideButton}>Cambiar de app</button>
          <button onClick={() => supabase.auth.signOut()} style={sideButton}>Salir</button>
        </div>
      </aside>

      <section style={{ minWidth: 0 }}>
        <header style={{ height: '54px', background: '#fff', borderBottom: '1px solid #d8ecf7', padding: '0 26px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 1px 3px rgba(10,22,40,0.08)' }}>
          <span style={{ fontSize: '17px', fontWeight: 800, color: '#0d1b38' }}>Facturación</span>
          <span style={{ fontSize: '12px', color: '#7a8fbb' }}>· {vista === 'dashboard' ? 'Panel de Ventas' : empresaActiva === 'all' ? 'Todas las compañías' : empresaActiva}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: '12px', color: '#7a8fbb', whiteSpace: 'nowrap' }}>{session.user.email}</span>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente, CUIT, ejecutivo o factura..."
            style={{ width: '330px', background: '#f5fbfe', border: '1px solid #d8ecf7', color: '#0d1b38', fontSize: '13px', padding: '8px 12px', borderRadius: '8px', outline: 'none' }}
          />
        </header>

        <main style={{ padding: '20px 26px 30px' }}>
          <SubirFacturacionExcel insertarLote={insertarLote} />
          {error && <div style={{ color: '#dc2626', marginBottom: '14px', fontSize: '13px' }}>⚠ {error}</div>}

          {loading ? (
            <div style={emptyStyle}>Cargando facturación...</div>
          ) : data.length === 0 ? (
            <div style={emptyStyle}>Sin datos aún. Subí el Excel de facturación para empezar.</div>
          ) : vista === 'dashboard' ? (
            <Dashboard
              moneda={moneda}
              total={total}
              clientes={clientes}
              ejecutivos={ejecutivos}
              facturas={facturas}
              porCliente={porCliente}
              porEjecutivo={porEjecutivo}
              porPeriodo={porPeriodo}
              maxCliente={maxCliente}
              maxEjecutivo={maxEjecutivo}
              maxPeriodo={maxPeriodo}
            />
          ) : (
            <Detalle filas={filas} moneda={moneda} total={total} />
          )}
        </main>
      </section>
    </div>
  )
}

function Dashboard({ moneda, total, clientes, ejecutivos, facturas, porCliente, porEjecutivo, porPeriodo, maxCliente, maxEjecutivo, maxPeriodo }: {
  moneda: string
  total: number
  clientes: number
  ejecutivos: number
  facturas: number
  porCliente: [string, number][]
  porEjecutivo: [string, number][]
  porPeriodo: [string, number][]
  maxCliente: number
  maxEjecutivo: number
  maxPeriodo: number
}) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <Kpi label="Total facturado" value={fmt(total, moneda)} color="#0e7490" />
        <Kpi label="Clientes" value={String(clientes)} color="#059669" />
        <Kpi label="Facturas" value={String(facturas)} color="#d97706" />
        <Kpi label="Ejecutivos" value={String(ejecutivos)} color="#7c3aed" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)', gap: '16px', alignItems: 'start' }}>
        <RankCard title="Facturación por cliente" rows={porCliente} max={maxCliente} moneda={moneda} />
        <RankCard title="Facturación por ejecutivo" rows={porEjecutivo} max={maxEjecutivo} moneda={moneda} />
        <RankCard title="Facturación por período" rows={porPeriodo} max={maxPeriodo} moneda={moneda} wide />
      </div>
    </>
  )
}

function Detalle({ filas, moneda, total }: { filas: FacturacionLinea[]; moneda: string; total: number }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #d8ecf7', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.08)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #d8ecf7', background: '#f5fbfe', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <strong style={{ fontSize: '13px', color: '#0d1b38' }}>Detalle</strong>
        <span style={{ fontSize: '12px', color: '#7a8fbb' }}>{filas.length} línea{filas.length === 1 ? '' : 's'}</span>
        <span style={{ fontSize: '12px', color: '#7a8fbb', marginLeft: 'auto' }}>Total: <strong style={{ color: '#0d1b38' }}>{fmt(total, moneda)}</strong></span>
      </div>
      {filas.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#7a8fbb' }}>Sin datos para esta selección.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5fbfe' }}>
                {['Empresa', 'Cliente', 'Ejecutivo', 'Período', 'Fecha factura', 'N° Factura', 'CC Descripción', 'Monto'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Monto' ? 'right' : 'left', fontSize: '10px', color: '#7a8fbb', textTransform: 'uppercase', borderBottom: '1px solid #d8ecf7', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #d8ecf7' }}>
                  <td style={tdMuted}>{r.empresa || '-'}</td>
                  <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, color: '#0d1b38' }}>{r.cliente}</td>
                  <td style={tdMuted}>{r.ejecutivo || '-'}</td>
                  <td style={tdMuted}>{fmtFecha(r.periodo)}</td>
                  <td style={tdMuted}>{fmtFecha(r.fecha_factura)}</td>
                  <td style={{ ...tdMuted, fontFamily: 'monospace', color: '#3d5278' }}>{r.n_factura || '-'}</td>
                  <td style={tdMuted}>{r.cc_descripcion || '-'}</td>
                  <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 800, fontFamily: 'monospace', textAlign: 'right' }}>{fmt(r.total_neto, r.moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #d8ecf7', borderTop: `3px solid ${color}`, borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(10,22,40,0.08)' }}>
      <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>{label}</div>
      <div style={{ color, fontSize: '18px', fontWeight: 800, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  )
}

function RankCard({ title, rows, max, moneda, wide }: { title: string; rows: [string, number][]; max: number; moneda: string; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined, background: '#fff', border: '1px solid #d8ecf7', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 3px rgba(10,22,40,0.08)' }}>
      <div style={{ fontSize: '12px', color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 800, marginBottom: '12px' }}>{title}</div>
      <div style={{ display: 'grid', gap: '9px' }}>
        {rows.map(([name, value], i) => (
          <div key={name}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ flex: 1, minWidth: 0, color: '#0d1b38', fontWeight: 700, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <span style={{ color: '#0d1b38', fontWeight: 800, fontSize: '12px', fontFamily: 'monospace' }}>{fmt(value, moneda)}</span>
            </div>
            <div style={{ height: '4px', background: '#eaf6fd', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(4, (value / max) * 100)}%`, background: PALETTE[i % PALETTE.length], borderRadius: '4px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const navStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '9px',
  width: 'calc(100% - 28px)',
  margin: '0 14px 5px',
  padding: '9px 12px',
  borderRadius: '9px',
  border: 'none',
  background: active ? '#0ea5e9' : 'transparent',
  color: active ? '#fff' : 'rgba(255,255,255,0.58)',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: active ? 700 : 500,
  textAlign: 'left',
})

const sideButton: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  cursor: 'pointer',
  fontSize: '11px',
  color: 'rgba(255,255,255,0.55)',
  padding: '7px 10px',
  borderRadius: '6px',
  fontWeight: 700,
}

const emptyStyle: React.CSSProperties = {
  background: '#fff',
  border: '1.5px dashed #b7dcf0',
  borderRadius: '10px',
  padding: '80px 20px',
  textAlign: 'center',
  color: '#7a8fbb',
}

const tdMuted: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: '12px',
  color: '#7a8fbb',
  whiteSpace: 'nowrap',
}
