import { useState, Fragment } from 'react'
import type { ManualFactura, SociedadKey } from '../types/sociedades'
import { ManualFacturaForm } from './ManualFacturaForm'

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
  onShowAdminPrompt: () => void
  onIrANueva: () => void
  onEditar: (factura: ManualFactura) => void
  onGuardarFactura: (factura: ManualFactura) => void
  onCancelarFactura: () => void
  onMarcarCobrada: (factura: ManualFactura) => void
  onDeshacerCobro: (factura: ManualFactura) => void
  onReasignarEjecutivo: (cliente: string, nuevoEjecutivo: string) => void
  onAbrirPdf: (factura: ManualFactura) => void
}

const fmtMonto = (moneda: string, n: number) => {
  const simbolo = moneda === 'EUR' ? '€' : moneda === 'USD' ? 'US$' : '$'
  return `${simbolo} ${Math.round(n).toLocaleString('es-AR')}`
}

export function ManualSociedadView({
  vista, sociedad, nombreSociedad, monedas, condicionOpts, adminMode, facturas, historial,
  execsConocidos, clientesConocidos, busqueda, editando, fmtFecha,
  calcularVencimientoPorCondicion, calcularDiasMora,
  onShowAdminPrompt, onIrANueva, onEditar, onGuardarFactura, onCancelarFactura,
  onMarcarCobrada, onDeshacerCobro, onReasignarEjecutivo, onAbrirPdf,
}: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const q = busqueda.toLowerCase()
  const facturasFiltradas = facturas.filter(r =>
    !q || r.comprobante.toLowerCase().includes(q) || r.cliente.toLowerCase().includes(q)
  )

  if (vista === 'nueva') {
    if (!adminMode) {
      return (
        <div style={{ background: '#fff', border: '1px solid #bcd0f7', borderRadius: '12px', padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ color: '#7a8fbb', fontSize: '14px' }}>Solo el administrador puede agregar facturas.</div>
          <button onClick={onShowAdminPrompt} style={{ marginTop: '18px', background: '#2554a0', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            Activar Admin
          </button>
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
    const vencidas   = facturas.filter(r => calcularDiasMora(r.fecha_vencimiento || null) > 0)
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const en7 = new Date(hoy.getTime() + 7 * 86400000)
    const proximas = facturas.filter(r => {
      if (calcularDiasMora(r.fecha_vencimiento || null) > 0 || !r.fecha_vencimiento) return false
      const v = new Date(r.fecha_vencimiento + 'T00:00:00')
      return v >= hoy && v <= en7
    })
    const sinVencer = facturas.filter(r => !vencidas.includes(r) && !proximas.includes(r))
    const totalVencido = vencidas.reduce((s, r) => s + r.monto, 0)
    const totalProximas = proximas.reduce((s, r) => s + r.monto, 0)
    const totalSinVencer = sinVencer.reduce((s, r) => s + r.monto, 0)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
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
            {!adminMode && (
              <button onClick={onShowAdminPrompt} style={{ marginTop: '18px', background: '#2554a0', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                Activar Admin
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
            <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', padding: '22px 24px', borderLeft: '5px solid #dc2626' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>💸 Total vencido</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>{fmtMonto(monedas[0], totalVencido)}</div>
              <div style={{ fontSize: '12px', color: '#7a8fbb', marginTop: '6px' }}>{vencidas.length} factura{vencidas.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', padding: '22px 24px', borderLeft: '5px solid #d97706' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>⏳ Vence en 7 días</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#d97706', fontFamily: 'monospace' }}>{fmtMonto(monedas[0], totalProximas)}</div>
              <div style={{ fontSize: '12px', color: '#7a8fbb', marginTop: '6px' }}>{proximas.length} factura{proximas.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', padding: '22px 24px', borderLeft: '5px solid #059669' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>✅ Sin vencer</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>{fmtMonto(monedas[0], totalSinVencer)}</div>
              <div style={{ fontSize: '12px', color: '#7a8fbb', marginTop: '6px' }}>{sinVencer.length} facturas al día</div>
            </div>
          </div>
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
          {adminMode ? (
            <button onClick={onIrANueva} style={{ marginTop: '18px', background: '#2554a0', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              + Agregar factura
            </button>
          ) : (
            <button onClick={onShowAdminPrompt} style={{ marginTop: '18px', background: '#2554a0', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              Activar Admin
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
                          <div style={{ padding: '14px 20px', background: '#f8faff', borderLeft: '3px solid #a8c4f5', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px' }}>
                            {[
                              ['Descripción', r.descripcion], ['Centro/Unidad', r.unidad], ['OC/HES', r.oc_hes_pedido],
                              ['Período', r.periodo], ['Colaborador', r.colaborador], ['Otros conceptos', r.otros_conceptos],
                              ['Condición', r.condicion],
                            ].map(([label, val]) => (
                              <div key={label}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', marginBottom: '3px' }}>{label}</div>
                                <div style={{ color: '#0d1b38' }}>{val || '—'}</div>
                              </div>
                            ))}
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
