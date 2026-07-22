import { useEffect, useState } from 'react'
import type { ManualFactura, SociedadKey } from '../types/sociedades'

const parseNumeroES = (str: string): number => {
  const sinMiles = str.trim().replace(/\./g, '')
  const conPunto = sinMiles.replace(',', '.')
  const n = parseFloat(conPunto)
  return isNaN(n) ? 0 : n
}

const formatNumeroES = (n: number): string => n ? n.toLocaleString('es-AR') : ''

const LBL: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', marginBottom: '4px' }
const INPUT: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #dde3f0', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit' }

type Props = {
  sociedad: Exclude<SociedadKey, 'sa'>
  nombreSociedad: string
  monedas: string[]
  condicionOpts: string[]
  execsConocidos: string[]
  clientesConocidos: string[]
  factura?: ManualFactura | null
  calcularVencimientoPorCondicion: (fechaEmision: string | null | undefined, condicion: string) => string | null
  onGuardar: (factura: ManualFactura) => void
  onCancelar: () => void
}

const vacio = (sociedad: Exclude<SociedadKey, 'sa'>, moneda: string): ManualFactura => ({
  id: '', sociedad, comprobante: '', cliente: '', ejecutivo: '', fecha_emision: '', fecha_vencimiento: '',
  condicion: '', moneda, descripcion: '', unidad: '', cantidad: 0, valor_unitario: 0, monto: 0,
  oc_hes_pedido: '', periodo: '', colaborador: '', otros_conceptos: '',
  pdf_url: '', pdf_base64: '', pdf_nombre: '', creado_el: '',
})

export function ManualFacturaForm({
  sociedad, nombreSociedad, monedas, condicionOpts, execsConocidos, clientesConocidos,
  factura, calcularVencimientoPorCondicion, onGuardar, onCancelar,
}: Props) {
  const [form, setForm] = useState<ManualFactura>(() => factura ?? vacio(sociedad, monedas[0]))
  const set = (fields: Partial<ManualFactura>) => setForm(prev => ({ ...prev, ...fields }))

  const [valorUnitarioStr, setValorUnitarioStr] = useState(() => formatNumeroES(form.valor_unitario))
  const [montoStr, setMontoStr] = useState(() => formatNumeroES(form.monto))
  useEffect(() => {
    setValorUnitarioStr(formatNumeroES(factura?.valor_unitario ?? 0))
    setMontoStr(formatNumeroES(factura?.monto ?? 0))
  }, [factura?.id])

  const totalCalculado = form.cantidad > 0 && form.valor_unitario > 0 ? form.cantidad * form.valor_unitario : null

  const handlePdf = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => set({ pdf_base64: String(e.target?.result || ''), pdf_nombre: file.name })
    reader.readAsDataURL(file)
  }

  const puedeGuardar = form.comprobante.trim() && form.cliente.trim() && form.fecha_emision && (form.monto > 0 || totalCalculado)

  const guardar = () => {
    if (!puedeGuardar) return
    const monto = totalCalculado ?? form.monto
    const fecha_vencimiento = calcularVencimientoPorCondicion(form.fecha_emision, form.condicion) || form.fecha_vencimiento
    onGuardar({
      ...form,
      id: form.id || `${sociedad}-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      comprobante: form.comprobante.trim(),
      cliente: form.cliente.trim(),
      ejecutivo: form.ejecutivo.trim() || 'Sin asignar',
      monto,
      fecha_vencimiento,
      creado_el: form.creado_el || new Date().toISOString(),
    })
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', padding: '18px 22px', boxShadow: '0 2px 12px rgba(38,63,101,0.06)' }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0d1b38', marginBottom: '6px' }}>
        {factura ? '✏️ Editar factura' : '+ Nueva factura'}
      </div>
      <div style={{ color: '#7a8fbb', fontSize: '13px', marginBottom: '14px' }}>{nombreSociedad} · Moneda: {monedas.join(' / ')}</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
        <div>
          <div style={LBL}>Comprobante</div>
          <input type="text" value={form.comprobante} onChange={e => set({ comprobante: e.target.value })} style={INPUT} />
        </div>
        <div>
          <div style={LBL}>Cliente</div>
          <input type="text" list="ml-clientes" value={form.cliente} onChange={e => set({ cliente: e.target.value })} style={INPUT} />
          <datalist id="ml-clientes">{clientesConocidos.map(c => <option key={c} value={c} />)}</datalist>
        </div>
        <div>
          <div style={LBL}>Ejecutivo</div>
          <input type="text" list="ml-execs" value={form.ejecutivo} onChange={e => set({ ejecutivo: e.target.value })} style={INPUT} />
          <datalist id="ml-execs">{execsConocidos.map(e => <option key={e} value={e} />)}</datalist>
        </div>
        <div>
          <div style={LBL}>Moneda</div>
          <select value={form.moneda} onChange={e => set({ moneda: e.target.value })} style={INPUT}>
            {monedas.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <div style={LBL}>Fecha emisión</div>
          <input type="date" value={form.fecha_emision} onChange={e => set({ fecha_emision: e.target.value })} style={INPUT} />
        </div>
        <div>
          <div style={LBL}>Condición de pago</div>
          <select value={form.condicion} onChange={e => set({ condicion: e.target.value })} style={INPUT}>
            <option value="">— Seleccionar —</option>
            {condicionOpts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <div style={LBL}>Vencimiento</div>
          <input type="date" value={form.fecha_vencimiento} onChange={e => set({ fecha_vencimiento: e.target.value })} style={INPUT} />
        </div>
        <div>
          <div style={LBL}>OC / HES / Nº pedido</div>
          <input type="text" value={form.oc_hes_pedido} onChange={e => set({ oc_hes_pedido: e.target.value })} style={INPUT} />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <div style={LBL}>Desglose del ítem</div>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr', gap: '10px', alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Descripción</div>
              <input type="text" value={form.descripcion} onChange={e => set({ descripcion: e.target.value })} style={INPUT} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Unidad</div>
              <input type="text" value={form.unidad} onChange={e => set({ unidad: e.target.value })} style={INPUT} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Cantidad</div>
              <input type="number" min={0} value={form.cantidad || ''} onChange={e => set({ cantidad: Number(e.target.value) || 0 })} style={INPUT} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Valor unitario</div>
              <input
                type="text" inputMode="decimal" placeholder="0,00"
                value={valorUnitarioStr}
                onChange={e => { setValorUnitarioStr(e.target.value); set({ valor_unitario: parseNumeroES(e.target.value) }) }}
                onBlur={() => setValorUnitarioStr(formatNumeroES(form.valor_unitario))}
                style={INPUT}
              />
            </div>
          </div>
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#7a8fbb' }}>Total {totalCalculado ? 'calculado' : '(manual)'}:</span>
            {totalCalculado ? (
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#2554a0', fontFamily: 'monospace' }}>{form.moneda} {totalCalculado.toLocaleString('es-AR')}</span>
            ) : (
              <input
                type="text" inputMode="decimal" placeholder="Monto"
                value={montoStr}
                onChange={e => { setMontoStr(e.target.value); set({ monto: parseNumeroES(e.target.value) }) }}
                onBlur={() => setMontoStr(formatNumeroES(form.monto))}
                style={{ ...INPUT, width: '160px' }}
              />
            )}
          </div>
        </div>

        <div>
          <div style={LBL}>Período</div>
          <input type="text" placeholder="Ej: Mayo 2026" value={form.periodo} onChange={e => set({ periodo: e.target.value })} style={INPUT} />
        </div>
        <div>
          <div style={LBL}>Colaborador</div>
          <input type="text" value={form.colaborador} onChange={e => set({ colaborador: e.target.value })} style={INPUT} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={LBL}>Otros conceptos / Proyectos</div>
          <input type="text" value={form.otros_conceptos} onChange={e => set({ otros_conceptos: e.target.value })} style={INPUT} />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <div style={LBL}>📎 Adjuntar PDF de factura</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 16px', borderRadius: '7px', border: '1px dashed #c4d0ea', background: '#f8faff', color: '#2554a0', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              Seleccionar PDF
              <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => handlePdf(e.target.files?.[0] || null)} />
            </label>
            <span style={{ fontSize: '12px', color: '#7a8fbb', fontStyle: 'italic' }}>{form.pdf_nombre || 'Sin archivo seleccionado'}</span>
          </div>
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>...o pegar URL (SharePoint, etc.)</div>
            <input type="text" placeholder="https://..." value={form.pdf_url} onChange={e => set({ pdf_url: e.target.value })} style={INPUT} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: '14px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button onClick={onCancelar} style={{ background: 'transparent', border: '1px solid #dde3f0', color: '#7a8fbb', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          Cancelar
        </button>
        <button onClick={guardar} disabled={!puedeGuardar} style={{ background: puedeGuardar ? '#2554a0' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: puedeGuardar ? 'pointer' : 'not-allowed' }}>
          Guardar factura
        </button>
      </div>
    </div>
  )
}
