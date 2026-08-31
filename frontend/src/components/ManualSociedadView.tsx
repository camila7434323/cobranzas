import { useState, Fragment } from 'react'
import * as XLSX from 'xlsx-js-style'
import type { ManualFactura, SociedadKey } from '../types/sociedades'
import { ManualFacturaForm } from './ManualFacturaForm'

type Vista = 'global' | 'dashboard' | 'todos' | 'historial' | 'clientes' | 'nueva'

const normalizar = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const exportXlsx = (filename: string, rows: Record<string, string | number>[]) => {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')
  XLSX.writeFile(wb, filename)
}

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
  onEliminar: (factura: ManualFactura) => void
  onReasignarEjecutivo: (cliente: string, nuevoEjecutivo: string) => void
  onAbrirPdf: (factura: ManualFactura) => void
  onVerFacturasCliente: (cliente: string) => void
}

const fmtMonto = (moneda: string, n: number) => {
  const simbolo = moneda === 'EUR' ? '€' : moneda === 'USD' ? 'US$' : '$'
  return `${simbolo} ${Math.round(n).toLocaleString('es-AR')}`
}

const moraBadge = (dias: number) => {
  if (dias <= 0)  return { label: 'Sin vencer', color: '#059669', bg: '#d1fae5' }
  if (dias <= 7)  return { label: `${dias}d`,   color: '#854d0e', bg: '#fef9c3' }
  if (dias <= 15) return { label: `${dias}d`,   color: '#9a3412', bg: '#ffedd5' }
  if (dias <= 30) return { label: `${dias}d`,   color: '#7f1d1d', bg: '#fee2e2' }
  return           { label: `🔴 ${dias}d`,      color: '#ffffff', bg: '#dc2626' }
}

// Tarjetas por moneda: cada monto se calcula y muestra por separado por
// moneda (nunca se suman entre sí), pero comparten una sola fila de
// tarjetas / una sola lista en vez de repetir toda la sección por moneda.
function MontosPorMoneda({ monedas, rows }: { monedas: string[]; rows: ManualFactura[] }) {
  return (
    <>
      {monedas.map(m => (
        <div key={m}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#7a8fbb', marginBottom: '2px' }}>{m}</div>
          <div>{fmtMonto(m, rows.filter(r => r.moneda === m).reduce((s, r) => s + r.monto, 0))}</div>
        </div>
      ))}
    </>
  )
}

function SeccionMonedaLLC({ monedas, rows, diasMora, mostrarTodosClientes, onToggleMostrarTodos, onVerFacturasCliente }: {
  monedas: string[]
  rows: ManualFactura[]
  diasMora: (r: ManualFactura) => number
  mostrarTodosClientes: boolean
  onToggleMostrarTodos: () => void
  onVerFacturasCliente: (cliente: string) => void
}) {
  const vencidas = rows.filter(r => diasMora(r) > 0)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const en7 = new Date(hoy.getTime() + 7 * 86400000)
  const proximas = rows.filter(r => {
    if (diasMora(r) > 0 || !r.fecha_vencimiento) return false
    const v = new Date(r.fecha_vencimiento + 'T00:00:00')
    return v >= hoy && v <= en7
  })
  const sinVencer = rows.filter(r => !vencidas.includes(r) && !proximas.includes(r))

  const clientDashMap = vencidas.reduce<Map<string, { montos: Map<string, number>; facturas: number }>>((acc, r) => {
    const cur = acc.get(r.cliente) || { montos: new Map<string, number>(), facturas: 0 }
    cur.montos.set(r.moneda, (cur.montos.get(r.moneda) || 0) + r.monto)
    cur.facturas++
    acc.set(r.cliente, cur); return acc
  }, new Map())
  const clientDashList = Array.from(clientDashMap.entries())
    .map(([name, d]) => ({ name, montos: Array.from(d.montos.entries()), facturas: d.facturas }))
    .sort((a, b) => b.facturas - a.facturas || a.name.localeCompare(b.name))

  const clientesConMoraSet = new Set(vencidas.map(r => r.cliente))
  const clientesAlDia = [...new Set(rows.filter(r => diasMora(r) <= 0).map(r => r.cliente))]
    .filter(n => !clientesConMoraSet.has(n)).sort()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
        <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', padding: '22px 24px', boxShadow: '0 2px 8px rgba(10,22,40,0.08)', borderLeft: '5px solid #dc2626', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: '-10px', top: '-10px', width: '70px', height: '70px', background: '#fee2e2', borderRadius: '50%', opacity: 0.4 }} />
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>💸 Total vencido</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '22px', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace', lineHeight: 1.15, marginBottom: '6px' }}>
            <MontosPorMoneda monedas={monedas} rows={vencidas} />
          </div>
          <div style={{ fontSize: '12px', color: '#7a8fbb' }}>{vencidas.length} factura{vencidas.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', padding: '22px 24px', boxShadow: '0 2px 8px rgba(10,22,40,0.08)', borderLeft: '5px solid #d97706', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: '-10px', top: '-10px', width: '70px', height: '70px', background: '#fef3c7', borderRadius: '50%', opacity: 0.4 }} />
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>⏳ Vence en 7 días</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '22px', fontWeight: 800, color: '#d97706', fontFamily: 'monospace', lineHeight: 1.15, marginBottom: '6px' }}>
            <MontosPorMoneda monedas={monedas} rows={proximas} />
          </div>
          <div style={{ fontSize: '12px', color: '#7a8fbb' }}>{proximas.length} factura{proximas.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', padding: '22px 24px', boxShadow: '0 2px 8px rgba(10,22,40,0.08)', borderLeft: '5px solid #059669', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: '-10px', top: '-10px', width: '70px', height: '70px', background: '#d1fae5', borderRadius: '50%', opacity: 0.4 }} />
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>✅ Sin vencer</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '22px', fontWeight: 800, color: '#059669', fontFamily: 'monospace', lineHeight: 1.15, marginBottom: '6px' }}>
            <MontosPorMoneda monedas={monedas} rows={sinVencer} />
          </div>
          <div style={{ fontSize: '12px', color: '#7a8fbb' }}>{sinVencer.length} factura{sinVencer.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* DEUDA POR CLIENTE */}
      <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(10,22,40,0.07)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef2fa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d1b38' }}>Deuda por cliente</span>
          <span style={{ fontSize: '11px', color: '#7a8fbb' }}>clic para ver el detalle</span>
        </div>
        <div style={{ padding: '8px 20px' }}>
          {(mostrarTodosClientes ? clientDashList : clientDashList.slice(0, 10)).map(c => (
            <div key={c.name} onClick={() => onVerFacturasCliente(c.name)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0d1b38' }}>{c.name}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{c.facturas} factura{c.facturas !== 1 ? 's' : ''} vencida{c.facturas !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {c.montos.map(([m, v]) => <div key={m} style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#dc2626' }}>{fmtMonto(m, v)}</div>)}
              </div>
            </div>
          ))}
          {clientDashList.length === 0 && <div style={{ color: '#7a8fbb', fontSize: '13px', padding: '20px 0', textAlign: 'center' }}>Sin clientes con mora</div>}
          {clientDashList.length > 10 && (
            <button
              onClick={onToggleMostrarTodos}
              style={{ width: '100%', margin: '8px 0', padding: '8px', fontSize: '12px', fontWeight: 700, color: '#1d4170', background: '#f8faff', border: '1px dashed #c7d3ea', borderRadius: '8px', cursor: 'pointer' }}
            >
              {mostrarTodosClientes ? '▲ Ver menos' : `▼ Ver ${clientDashList.length - 10} clientes más`}
            </button>
          )}
        </div>
      </div>

      {/* CLIENTES AL DIA */}
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
  )
}

export function ManualSociedadView({
  vista, sociedad, nombreSociedad, monedas, condicionOpts, adminMode, facturas, historial,
  execsConocidos, clientesConocidos, busqueda, editando, fmtFecha,
  calcularVencimientoPorCondicion, calcularDiasMora,
  onIrANueva, onEditar, onGuardarFactura, onCancelarFactura,
  onMarcarCobrada, onDeshacerCobro, onEliminar, onReasignarEjecutivo, onAbrirPdf, onVerFacturasCliente,
}: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [mostrarTodosClientes, setMostrarTodosClientes] = useState(false)
  const [busquedaHistorial, setBusquedaHistorial] = useState('')
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [sortColHist, setSortColHist] = useState<string | null>(null)
  const [sortDirHist, setSortDirHist] = useState<'asc' | 'desc'>('asc')

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  const handleSortHist = (col: string) => {
    if (sortColHist === col) setSortDirHist(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortColHist(col); setSortDirHist('asc') }
  }
  const ordenarPor = <T,>(rows: T[], col: string | null, dir: 'asc' | 'desc', valorDe: (r: T, col: string) => unknown) => {
    if (!col) return rows
    return [...rows].sort((a, b) => {
      const av = valorDe(a, col); const bv = valorDe(b, col)
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''))
      return dir === 'asc' ? cmp : -cmp
    })
  }

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
    const qHist = normalizar(busquedaHistorial.trim())
    const historialFiltrado = ordenarPor(
      historial.filter(r => !qHist || [r.comprobante, r.cliente, r.ejecutivo].some(v => normalizar(v || '').includes(qHist))),
      sortColHist, sortDirHist,
      (r, col) => col === 'cobrado_el' ? (r.cobrado_el || '') : (r as any)[col]
    )
    const COLS_HIST = [
      { key: 'comprobante', label: 'Comprobante', sortable: true },
      { key: 'cliente', label: 'Cliente', sortable: true },
      { key: 'ejecutivo', label: 'Ejecutivo', sortable: true },
      { key: 'monto', label: 'Monto', sortable: true },
      { key: 'cobrado_el', label: 'Cobrado el', sortable: true },
      { key: '', label: 'PDF', sortable: false },
      ...(adminMode ? [{ key: '', label: '', sortable: false }] : []),
    ]
    return (
      <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #dde3f0', display: 'flex', alignItems: 'center', gap: '10px', background: '#f8faff', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0d1b38' }}>Historial de cobros</span>
          <span style={{ fontSize: '12px', color: '#7a8fbb' }}>{historialFiltrado.length} registros</span>
          <button
            onClick={() => exportXlsx(`historial_${nombreSociedad}_${new Date().toISOString().slice(0, 10)}.xlsx`, historialFiltrado.map(r => ({
              'Comprobante': r.comprobante, 'Cliente': r.cliente, 'Ejecutivo': r.ejecutivo || 'Sin asignar',
              'Monto': r.monto, 'Moneda': r.moneda, 'Cobrado el': r.cobrado_el ? r.cobrado_el.slice(0, 10) : '',
            })))}
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#2554a0', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            ↓ .xlsx
          </button>
          <input
            type="text" placeholder="Buscar comprobante, cliente, ejecutivo..." value={busquedaHistorial}
            onChange={e => setBusquedaHistorial(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #dde3f0', fontSize: '12px', minWidth: '220px', outline: 'none', color: '#0d1b38', background: '#fff' }}
          />
        </div>
        {historial.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#7a8fbb' }}>Sin cobros registrados aún.</div>
        ) : historialFiltrado.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#7a8fbb' }}>Sin resultados para esa búsqueda.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8faff', borderBottom: '1px solid #dde3f0' }}>
                  <th style={{ width: '32px' }} />
                  {COLS_HIST.map((col, i) => (
                    <th key={col.key || `a-${i}`}
                      onClick={col.sortable ? () => handleSortHist(col.key) : undefined}
                      style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 600, color: sortColHist === col.key ? '#2554a0' : '#7a8fbb', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: col.sortable ? 'pointer' : 'default', userSelect: 'none' }}
                    >
                      {col.label}{col.sortable && sortColHist === col.key ? (sortDirHist === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historialFiltrado.map(r => {
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
                      {isExp && (
                        <tr style={{ borderBottom: '1px solid #dde3f0' }}>
                          <td colSpan={adminMode ? 7 : 6} style={{ padding: 0 }}>
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
                              {!!r.iva && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '18px', marginBottom: '12px', fontSize: '12px' }}>
                                  <span style={{ color: '#7a8fbb' }}>Base imponible: <strong style={{ color: '#0d1b38' }}>{fmtMonto(r.moneda, (r.items || []).reduce((s, it) => s + it.cantidad * it.valor_unitario, 0))}</strong></span>
                                  <span style={{ color: '#7a8fbb' }}>IVA: <strong style={{ color: '#0d1b38' }}>{fmtMonto(r.moneda, r.iva)}</strong></span>
                                  <span style={{ color: '#7a8fbb' }}>Total factura: <strong style={{ color: '#2554a0' }}>{fmtMonto(r.moneda, r.monto)}</strong></span>
                                </div>
                              )}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px' }}>
                                {[
                                  ['OC/HES', r.oc_hes_pedido], ['Período', r.periodo], ['Colaborador', r.colaborador],
                                  ['Otros conceptos', r.otros_conceptos], ['Condición', r.condicion],
                                  ['Emisión', r.fecha_emision ? fmtFecha(r.fecha_emision) : null], ['Vencimiento', r.fecha_vencimiento ? fmtFecha(r.fecha_vencimiento) : null],
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
                  {['Cliente', 'Ejecutivo asignado', ...(adminMode ? ['Cambiar ejecutivo'] : [])].map(h => (
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
                      {adminMode && (
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
                      )}
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
    const diasMora = (r: ManualFactura) => calcularDiasMora(r.fecha_vencimiento || null)
    const monedasPresentes = Array.from(new Set(facturas.map(r => r.moneda))).filter(Boolean).sort()
    const carteraPorMoneda = monedasPresentes.map(m => ({
      moneda: m,
      total: facturas.filter(r => r.moneda === m).reduce((s, r) => s + r.monto, 0),
    }))

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
            {/* TOTAL DE CARTERA — separado por moneda, nunca se suman entre sí */}
            <div style={{ background: 'linear-gradient(135deg, #0a1e3d 0%, #1d4170 100%)', borderRadius: '14px', padding: '26px 30px', color: '#fff', position: 'relative', overflow: 'hidden', boxShadow: '0 10px 28px rgba(10,22,40,0.28)' }}>
              <div style={{ position: 'absolute', right: '-40px', top: '-40px', width: '180px', height: '180px', background: 'rgba(255,255,255,0.06)', borderRadius: '50%' }} />
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', marginBottom: '10px', position: 'relative' }}>💼 Total de cartera{sociedad === 'sl' ? ' (impuestos incluidos)' : ''}</div>
              <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', position: 'relative' }}>
                {carteraPorMoneda.map(c => (
                  <div key={c.moneda}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginBottom: '2px' }}>{c.moneda}</div>
                    <div style={{ fontSize: '30px', fontWeight: 800, fontFamily: 'monospace', lineHeight: 1 }}>{fmtMonto(c.moneda, c.total)}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.62)', marginTop: '10px', position: 'relative' }}>{facturas.length} facturas pendientes de cobro — vencidas y vigentes</div>
            </div>

            <SeccionMonedaLLC
              monedas={monedasPresentes}
              rows={facturas}
              diasMora={diasMora}
              mostrarTodosClientes={mostrarTodosClientes}
              onToggleMostrarTodos={() => setMostrarTodosClientes(v => !v)}
              onVerFacturasCliente={onVerFacturasCliente}
            />
          </>
        )}
      </div>
    )
  }

  // vista === 'todos'
  const COLS_TODOS = [
    { key: 'comprobante', label: 'Comprobante', sortable: true },
    { key: 'cliente', label: 'Cliente', sortable: true },
    { key: 'ejecutivo', label: 'Ejecutivo', sortable: true },
    { key: 'fecha_emision', label: 'Emisión', sortable: true },
    { key: 'fecha_vencimiento', label: 'Vencimiento', sortable: true },
    { key: 'monto', label: 'Monto', sortable: true },
    { key: 'mora', label: 'Mora', sortable: true },
    { key: '', label: 'PDF', sortable: false },
    ...(adminMode ? [{ key: '', label: 'Acciones', sortable: false }] : []),
  ]
  const facturasOrdenadas = ordenarPor(
    facturasFiltradas, sortCol, sortDir,
    (r, col) => col === 'mora' ? calcularDiasMora(r.fecha_vencimiento) : (r as any)[col]
  )
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
            <button
              onClick={() => exportXlsx(`comprobantes_${nombreSociedad}_${new Date().toISOString().slice(0, 10)}.xlsx`, facturasOrdenadas.map(r => ({
                'Comprobante': r.comprobante, 'Cliente': r.cliente, 'Ejecutivo': r.ejecutivo || 'Sin asignar',
                'Emisión': fmtFecha(r.fecha_emision), 'Vencimiento': fmtFecha(r.fecha_vencimiento),
                'Monto': r.monto, 'Moneda': r.moneda, 'Mora (días)': calcularDiasMora(r.fecha_vencimiento),
                'OC/HES': r.oc_hes_pedido || '', 'Período': r.periodo || '', 'Colaborador': r.colaborador || '', 'Condición': r.condicion || '',
              })))}
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#2554a0', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              ↓ .xlsx
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ width: '32px' }} />
                {COLS_TODOS.map((col, i) => (
                  <th key={col.key || `c-${i}`}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    style={{ padding: '10px 16px', textAlign: col.key === 'monto' ? 'right' : 'left', fontSize: '10px', fontWeight: 600, color: sortCol === col.key ? '#2554a0' : '#7a8fbb', textTransform: 'uppercase', borderBottom: '1px solid #dde3f0', cursor: col.sortable ? 'pointer' : 'default', userSelect: 'none' }}
                  >
                    {col.label}{col.sortable && sortCol === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facturasOrdenadas.map(r => {
                const isExp = expandedRows.has(r.id)
                const diasMora = calcularDiasMora(r.fecha_vencimiento)
                const badge = moraBadge(diasMora)
                return (
                  <Fragment key={r.id}>
                    <tr
                      style={{ borderBottom: isExp ? 'none' : '1px solid #dde3f0', background: diasMora > 0 ? 'rgba(254,226,226,0.25)' : '' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                      onMouseLeave={e => (e.currentTarget.style.background = diasMora > 0 ? 'rgba(254,226,226,0.25)' : '')}
                    >
                      <td style={{ padding: '8px 4px 8px 12px' }}>
                        <button
                          onClick={() => setExpandedRows(prev => { const next = new Set(prev); if (next.has(r.id)) next.delete(r.id); else next.add(r.id); return next })}
                          style={{ width: '22px', height: '22px', border: '1px solid #dde3f0', borderRadius: '4px', background: isExp ? '#2554a0' : '#f1f5f9', color: isExp ? '#fff' : '#374151', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
                        >
                          {isExp ? '−' : '+'}
                        </button>
                      </td>
                      <td style={{ padding: '11px 16px', fontFamily: 'monospace', color: '#3d5278' }}>{r.comprobante}</td>
                      <td style={{ padding: '11px 16px', fontSize: '13px', fontWeight: 600, color: '#0d1b38' }}>{r.cliente}</td>
                      <td style={{ padding: '11px 16px', color: '#7a8fbb' }}>{r.ejecutivo}</td>
                      <td style={{ padding: '11px 16px', color: '#7a8fbb' }}>{fmtFecha(r.fecha_emision)}</td>
                      <td style={{ padding: '11px 16px', color: '#7a8fbb' }}>{fmtFecha(r.fecha_vencimiento)}</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtMonto(r.moneda, r.monto)}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ background: badge.bg, color: badge.color, padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>{badge.label}</span>
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <button onClick={() => onAbrirPdf(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f0f4ff', color: '#2554a0', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          📄 Abrir PDF
                        </button>
                      </td>
                      {adminMode && (
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => onEditar(r)} style={{ background: '#f0f4ff', color: '#2554a0', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Editar</button>
                            <button onClick={() => onMarcarCobrada(r)} style={{ background: '#f0fdf4', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>✓ Marcar cobrada</button>
                            <button onClick={() => onEliminar(r)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>✕ Eliminar</button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {isExp && (
                      <tr style={{ borderBottom: '1px solid #dde3f0' }}>
                        <td colSpan={adminMode ? 10 : 9} style={{ padding: 0 }}>
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
                            {!!r.iva && (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '18px', marginBottom: '12px', fontSize: '12px' }}>
                                <span style={{ color: '#7a8fbb' }}>Base imponible: <strong style={{ color: '#0d1b38' }}>{fmtMonto(r.moneda, (r.items || []).reduce((s, it) => s + it.cantidad * it.valor_unitario, 0))}</strong></span>
                                <span style={{ color: '#7a8fbb' }}>IVA: <strong style={{ color: '#0d1b38' }}>{fmtMonto(r.moneda, r.iva)}</strong></span>
                                <span style={{ color: '#7a8fbb' }}>Total factura: <strong style={{ color: '#2554a0' }}>{fmtMonto(r.moneda, r.monto)}</strong></span>
                              </div>
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
