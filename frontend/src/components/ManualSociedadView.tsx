import { useState, Fragment } from 'react'
import type { ManualFactura, SociedadKey } from '../types/sociedades'
import { ManualFacturaForm } from './ManualFacturaForm'
import { DASH_BAR_COLORS, EXEC_PIE_COLORS, svgPie } from '../lib/dashboardUtils'

type Vista = 'global' | 'dashboard' | 'todos' | 'historial' | 'clientes' | 'nueva'

type Props = {
  vista: Vista
  sociedad: Exclude<SociedadKey, 'sa'>
  nombreSociedad: string
  monedas: string[]
  condicionOpts: string[]
  adminMode: boolean
  facturas: ManualFactura[]
  historial: ManualFactura[]
  execsConocidos: string[]
  clientesConocidos: string[]
  busqueda: string
  editando: ManualFactura | null
  fmtFecha: (fecha: string) => string
  calcularVencimientoPorCondicion: (fechaEmision: string | null | undefined, condicion: string) => string | null
  calcularDiasMora: (fechaVencimiento: string | null) => number
  onIrANueva: () => void
  onEditar: (factura: ManualFactura) => void
  onGuardarFactura: (factura: ManualFactura) => void
  onCancelarFactura: () => void
  onMarcarCobrada: (factura: ManualFactura) => void
  onDeshacerCobro: (factura: ManualFactura) => void
  onReasignarEjecutivo: (cliente: string, nuevoEjecutivo: string) => void
  onAbrirPdf: (factura: ManualFactura) => void
  onVerFacturasCliente: (cliente: string) => void
}

const fmtMonto = (moneda: string, n: number) => {
  const simbolo = moneda === 'EUR' ? '€' : moneda === 'USD' ? 'US$' : '$'
  return `${simbolo} ${Math.round(n).toLocaleString('es-AR')}`
}

export function ManualSociedadView({
  vista, sociedad, nombreSociedad, monedas, condicionOpts, adminMode, facturas, historial,
  execsConocidos, clientesConocidos, busqueda, editando, fmtFecha,
  calcularVencimientoPorCondicion, calcularDiasMora,
  onIrANueva, onEditar, onGuardarFactura, onCancelarFactura,
  onMarcarCobrada, onDeshacerCobro, onReasignarEjecutivo, onAbrirPdf, onVerFacturasCliente,
}: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [mostrarTodosClientes, setMostrarTodosClientes] = useState(false)

  const q = busqueda.toLowerCase()
  const facturasFiltradas = facturas.filter(r => {
    const items = r.items || []
    return !q || [r.comprobante, r.cliente, r.ejecutivo, ...items.map(it => it.descripcion), ...items.map(it => it.unidad), r.oc_hes_pedido, r.colaborador, r.otros_conceptos, r.periodo, r.condicion]
      .some(v => v?.toLowerCase().includes(q))
  })

  if (vista === 'nueva') {
    if (!adminMode) {
      return (
        <div style={{ background: '#fff', border: '1px solid #bcd0f7', borderRadius: '12px', padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ color: '#7a8fbb', fontSize: '14px' }}>Solo el administrador puede agregar facturas.</div>
        </div>
      )
    }
    return (
      <ManualFacturaForm
        sociedad={sociedad}
        nombreSociedad={nombreSociedad}
        monedas={monedas}
        condicionOpts={condicionOpts}
        execsConocidos={execsConocidos}
        clientesConocidos={clientesConocidos}
        factura={editando}
        calcularVencimientoPorCondicion={calcularVencimientoPorCondicion}
        onGuardar={onGuardarFactura}
        onCancelar={onCancelarFactura}
      />
    )
  }

  if (vista === 'historial') {
    return (
      <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #dde3f0', display: 'flex', alignItems: 'center', gap: '8px', background: '#f8faff' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0d1b38' }}>Historial de cobros</span>
          <span style={{ fontSize: '12px', color: '#7a8fbb' }}>{historial.length} registros</span>
        </div>
        {historial.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#7a8fbb' }}>Sin cobros registrados aún.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8faff', borderBottom: '1px solid #dde3f0' }}>
                  {['Comprobante', 'Cliente', 'Ejecutivo', 'Monto', 'Cobrado el', 'PDF', ...(adminMode ? [''] : [])].map((h, i) => (
                    <th key={h || `a-${i}`} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 600, color: '#7a8fbb', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historial.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #dde3f0' }}>
                    <td style={{ padding: '12px 16px', fontSize: '12px', fontFamily: 'monospace', color: '#3d5278' }}>{r.comprobante}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#0d1b38' }}>{r.cliente}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#7a8fbb' }}>{r.ejecutivo}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', color: '#059669' }}>{fmtMonto(r.moneda, r.monto)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#7a8fbb' }}>{r.cobrado_el ? fmtFecha(r.cobrado_el.slice(0, 10)) : '-'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => onAbrirPdf(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f0f4ff', color: '#2554a0', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        📄 Abrir PDF
                      </button>
                    </td>
                    {adminMode && (
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => onDeshacerCobro(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#fff5f5', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          ↩ Deshacer
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  if (vista === 'clientes') {
    const clientes = [...new Set([...facturas, ...historial].map(r => r.cliente))].sort()
    return (
      <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #dde3f0', display: 'flex', alignItems: 'center', gap: '8px', background: '#f8faff' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0d1b38' }}>Listado de clientes</span>
          <span style={{ fontSize: '12px', color: '#7a8fbb' }}>{clientes.length} clientes</span>
        </div>
        {clientes.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#7a8fbb' }}>Sin clientes aún — se registran automáticamente al cargar facturas.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8faff', borderBottom: '1px solid #dde3f0' }}>
                  {['Cliente', 'Ejecutivo asignado', 'Cambiar ejecutivo'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientes.map(cliente => {
                  const ultima = [...facturas, ...historial].filter(r => r.cliente === cliente).slice(-1)[0]
                  const ejecutivo = ultima?.ejecutivo || 'Sin asignar'
                  return (
                    <tr key={cliente} style={{ borderBottom: '1px solid #dde3f0' }}>
                      <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, color: '#0d1b38' }}>{cliente}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: '#ddeafd', color: '#1d4170', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>{ejecutivo}</span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <select
                          value=""
                          onChange={e => { if (e.target.value) onReasignarEjecutivo(cliente, e.target.value) }}
                          style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #dde3f0', fontSize: '12px', color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none' }}
                        >
                          <option value="">— cambiar —</option>
                          {execsConocidos.map(e => <option key={e} value={e}>{e}</option>)}
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
    )
  }

  if (vista === 'dashboard') {
    const moneda = monedas[0]
    const diasMora = (r: ManualFactura) => calcularDiasMora(r.fecha_vencimiento || null)
    const vencidas   = facturas.filter(r => diasMora(r) > 0)
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const en7 = new Date(hoy.getTime() + 7 * 86400000)
    const proximas = facturas.filter(r => {
      if (diasMora(r) > 0 || !r.fecha_vencimiento) return false
      const v = new Date(r.fecha_vencimiento + 'T00:00:00')
      return v >= hoy && v <= en7
    })
    const sinVencer = facturas.filter(r => !vencidas.includes(r) && !proximas.includes(r))
    const totalVencido = vencidas.reduce((s, r) => s + r.monto, 0)
    const totalProximas = proximas.reduce((s, r) => s + r.monto, 0)
    const totalSinVencer = sinVencer.reduce((s, r) => s + r.monto, 0)
    const carteraTotal = facturas.reduce((s, r) => s + r.monto, 0)
    const porcentajeMora = carteraTotal > 0 ? Math.round((totalVencido / carteraTotal) * 100) : 0
    const moraPromedio = vencidas.length > 0
      ? Math.round(vencidas.reduce((s, r) => s + diasMora(r), 0) / vencidas.length) : 0

    const clientDashMap = vencidas.reduce<Map<string, { monto: number; facturas: number; moraSum: number }>>((acc, r) => {
      const cur = acc.get(r.cliente) || { monto: 0, facturas: 0, moraSum: 0 }
      cur.monto += r.monto; cur.facturas++; cur.moraSum += diasMora(r)
      acc.set(r.cliente, cur); return acc
    }, new Map())
    const clientDashList = Array.from(clientDashMap.entries())
      .map(([name, d]) => ({
        name, monto: d.monto, facturas: d.facturas,
        moraProm: Math.round(d.moraSum / d.facturas),
        pct: totalVencido > 0 ? Math.round((d.monto / totalVencido) * 100) : 0
      })).sort((a, b) => b.monto - a.monto)

    const execPieMap = vencidas.reduce<Map<string, number>>((acc, r) => {
      const k = r.ejecutivo || 'Sin asignar'
      acc.set(k, (acc.get(k) || 0) + r.monto); return acc
    }, new Map())
    const execPieList = Array.from(execPieMap.entries())
      .map(([name, monto], i) => ({
        name, monto, color: EXEC_PIE_COLORS[i % EXEC_PIE_COLORS.length],
        pct: totalVencido > 0 ? Math.round((monto / totalVencido) * 100) : 0
      })).sort((a, b) => b.monto - a.monto)

    const clientesConMoraSet = new Set(vencidas.map(r => r.cliente))
    const clientesAlDia = [...new Set(facturas.filter(r => diasMora(r) <= 0).map(r => r.cliente))]
      .filter(n => !clientesConMoraSet.has(n)).sort()

    const moraDist = [
      { label: '1–7d',   color: '#d97706', bg: '#fef3c7', items: vencidas.filter(r => diasMora(r) >= 1 && diasMora(r) <= 7) },
      { label: '8–15d',  color: '#ea580c', bg: '#ffedd5', items: vencidas.filter(r => diasMora(r) > 7 && diasMora(r) <= 15) },
      { label: '16–30d', color: '#dc2626', bg: '#fee2e2', items: vencidas.filter(r => diasMora(r) > 15 && diasMora(r) <= 30) },
      { label: '+30d',   color: '#7c3aed', bg: '#ede9fe', items: vencidas.filter(r => diasMora(r) > 30) },
    ]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', boxShadow: '0 1px 3px rgba(10,22,40,0.07)' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0d1b38' }}>{nombreSociedad}</div>
            <div style={{ fontSize: '12px', color: '#7a8fbb', marginTop: '2px' }}>Moneda: {monedas.join(' / ')}</div>
          </div>
          {adminMode && (
            <button onClick={onIrANueva} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#2554a0', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              + Agregar factura
            </button>
          )}
        </div>

        {facturas.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center', background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px' }}>
            <div style={{ fontSize: '40px', marginBottom: '14px' }}>📋</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#0d1b38', marginBottom: '8px' }}>Sin datos aún</div>
            <div style={{ fontSize: '13px', color: '#7a8fbb', maxWidth: '340px' }}>Los indicadores aparecen automáticamente a medida que cargues facturas. Comenzá agregando la primera.</div>
          </div>
        ) : (
          <>
            {/* KPI CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
              <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', padding: '22px 24px', boxShadow: '0 2px 8px rgba(10,22,40,0.08)', borderLeft: '5px solid #dc2626', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: '-10px', top: '-10px', width: '70px', height: '70px', background: '#fee2e2', borderRadius: '50%', opacity: 0.4 }} />
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>💸 Total vencido</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace', lineHeight: 1, marginBottom: '6px' }}>{fmtMonto(moneda, totalVencido)}</div>
                <div style={{ fontSize: '12px', color: '#7a8fbb' }}>{vencidas.length} facturas · {clientDashList.length} clientes</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', padding: '22px 24px', boxShadow: '0 2px 8px rgba(10,22,40,0.08)', borderLeft: '5px solid #d97706', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: '-10px', top: '-10px', width: '70px', height: '70px', background: '#fef3c7', borderRadius: '50%', opacity: 0.4 }} />
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>⏳ Vence en 7 días</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#d97706', fontFamily: 'monospace', lineHeight: 1, marginBottom: '6px' }}>{fmtMonto(moneda, totalProximas)}</div>
                <div style={{ fontSize: '12px', color: '#7a8fbb' }}>{proximas.length} factura{proximas.length !== 1 ? 's' : ''} próximas a vencer</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', padding: '22px 24px', boxShadow: '0 2px 8px rgba(10,22,40,0.08)', borderLeft: '5px solid #059669', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: '-10px', top: '-10px', width: '70px', height: '70px', background: '#d1fae5', borderRadius: '50%', opacity: 0.4 }} />
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>✅ Sin vencer</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#059669', fontFamily: 'monospace', lineHeight: 1, marginBottom: '6px' }}>{fmtMonto(moneda, totalSinVencer)}</div>
                <div style={{ fontSize: '12px', color: '#7a8fbb' }}>{sinVencer.length} facturas al día</div>
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
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>{vencidas.length} facturas vencidas</div>
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
                  {(mostrarTodosClientes ? clientDashList : clientDashList.slice(0, 10)).map((c, i) => {
                    const bc = DASH_BAR_COLORS[i % DASH_BAR_COLORS.length]
                    return (
                      <div key={c.name} style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '8px' }}>
                          <span onClick={() => onVerFacturasCliente(c.name)} style={{ fontSize: '13px', fontWeight: 600, color: '#1d4170', textDecoration: 'underline', textDecorationColor: '#a8c4f5', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '45%' }}>{c.name}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <span title="Monto total vencido de este cliente" style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#0d1b38', minWidth: '110px', textAlign: 'right' }}>{fmtMonto(moneda, c.monto)}</span>
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
                      onClick={() => setMostrarTodosClientes(v => !v)}
                      style={{ width: '100%', marginTop: '4px', padding: '8px', fontSize: '12px', fontWeight: 700, color: '#1d4170', background: '#f8faff', border: '1px dashed #c7d3ea', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      {mostrarTodosClientes
                        ? '▲ Ver menos'
                        : `▼ Ver ${clientDashList.length - 10} clientes más (${fmtMonto(moneda, clientDashList.slice(10).reduce((s, c) => s + c.monto, 0))})`}
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
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#0d1b38' }}>{fmtMonto(moneda, e.monto)}</span>
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
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginTop: '4px' }}>{fmtMonto(moneda, b.items.reduce((s, r) => s + r.monto, 0))}</div>
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
                        <span key={n} onClick={() => onVerFacturasCliente(n)} style={{ fontSize: '12px', fontWeight: 500, padding: '4px 10px', borderRadius: '20px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#065f46', cursor: 'pointer', whiteSpace: 'nowrap' }}>{n}</span>
                      ))
                  }
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // vista === 'todos'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {facturasFiltradas.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #bcd0f7', borderRadius: '12px', padding: '90px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '42px', marginBottom: '12px' }}>📋</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0d1b38', marginBottom: '8px' }}>Sin datos aún</div>
          <div style={{ color: '#6b7fb3', fontSize: '14px', maxWidth: '420px', margin: '0 auto' }}>
            Los indicadores aparecen automáticamente a medida que cargues facturas para {nombreSociedad}.
          </div>
          {adminMode && (
            <button onClick={onIrANueva} style={{ marginTop: '18px', background: '#2554a0', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              + Agregar factura
            </button>
          )}
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', background: '#f8faff', borderBottom: '1px solid #dde3f0', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <strong>Comprobantes por cobrar</strong>
            <span style={{ color: '#7a8fbb' }}>{facturasFiltradas.length} comprobantes</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ width: '32px' }} />
                {['Comprobante', 'Cliente', 'Ejecutivo', 'Emisión', 'Vencimiento', 'Monto', 'PDF', ...(adminMode ? ['Acciones'] : [])].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Monto' ? 'right' : 'left', fontSize: '10px', color: '#7a8fbb', textTransform: 'uppercase', borderBottom: '1px solid #dde3f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facturasFiltradas.map(r => {
                const isExp = expandedRows.has(r.id)
                return (
                  <Fragment key={r.id}>
                    <tr style={{ borderBottom: isExp ? 'none' : '1px solid #dde3f0' }}>
                      <td style={{ padding: '8px 4px 8px 12px' }}>
                        <button
                          onClick={() => setExpandedRows(prev => { const next = new Set(prev); if (next.has(r.id)) next.delete(r.id); else next.add(r.id); return next })}
                          style={{ width: '22px', height: '22px', border: '1px solid #dde3f0', borderRadius: '4px', background: isExp ? '#2554a0' : '#f1f5f9', color: isExp ? '#fff' : '#374151', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
                        >
                          {isExp ? '−' : '+'}
                        </button>
                      </td>
                      <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: '12px' }}>{r.comprobante}</td>
                      <td style={{ padding: '11px 16px', fontWeight: 700 }}>{r.cliente}</td>
                      <td style={{ padding: '11px 16px', color: '#7a8fbb' }}>{r.ejecutivo}</td>
                      <td style={{ padding: '11px 16px', color: '#7a8fbb' }}>{fmtFecha(r.fecha_emision)}</td>
                      <td style={{ padding: '11px 16px', color: '#7a8fbb' }}>{fmtFecha(r.fecha_vencimiento)}</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtMonto(r.moneda, r.monto)}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <button onClick={() => onAbrirPdf(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f0f4ff', color: '#2554a0', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          📄 Abrir PDF
                        </button>
                      </td>
                      {adminMode && (
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => onEditar(r)} style={{ background: '#f0f4ff', color: '#2554a0', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Editar</button>
                            <button onClick={() => onMarcarCobrada(r)} style={{ background: '#f0fdf4', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>✓ Cobrada</button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {isExp && (
                      <tr style={{ borderBottom: '1px solid #dde3f0' }}>
                        <td colSpan={adminMode ? 9 : 8} style={{ padding: 0 }}>
                          <div style={{ padding: '14px 20px', background: '#f8faff', borderLeft: '3px solid #a8c4f5' }}>
                            {(r.items || []).length > 0 && (
                              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', fontSize: '12px' }}>
                                <thead>
                                  <tr>
                                    {['Descripción', 'Unidad', 'Cant.', 'Valor unit.', 'Subtotal'].map(h => (
                                      <th key={h} style={{ textAlign: h === 'Descripción' || h === 'Unidad' ? 'left' : 'right', padding: '4px 8px', fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(r.items || []).map((it, i) => (
                                    <tr key={i} style={{ borderTop: '1px solid #e2e8f0' }}>
                                      <td style={{ padding: '5px 8px', color: '#0d1b38' }}>{it.descripcion || '—'}</td>
                                      <td style={{ padding: '5px 8px', color: '#0d1b38' }}>{it.unidad || '—'}</td>
                                      <td style={{ padding: '5px 8px', textAlign: 'right', color: '#0d1b38' }}>{it.cantidad}</td>
                                      <td style={{ padding: '5px 8px', textAlign: 'right', color: '#0d1b38' }}>{fmtMonto(r.moneda, it.valor_unitario)}</td>
                                      <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, color: '#0d1b38' }}>{fmtMonto(r.moneda, it.cantidad * it.valor_unitario)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px' }}>
                              {[
                                ['OC/HES', r.oc_hes_pedido], ['Período', r.periodo], ['Colaborador', r.colaborador],
                                ['Otros conceptos', r.otros_conceptos], ['Condición', r.condicion],
                              ].map(([label, val]) => (
                                <div key={label}>
                                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', marginBottom: '3px' }}>{label}</div>
                                  <div style={{ color: '#0d1b38' }}>{val || '—'}</div>
                                </div>
                              ))}
                            </div>
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
    </div>
  )
}
