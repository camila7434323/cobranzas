import { useEffect, useState } from 'react'
import type { ManualFactura, ManualFacturaItem, SociedadKey } from '../types/sociedades'
import { extraerTextoPdf, parsearFacturaTexto } from '../lib/extraerFactura'

const parseNumeroES = (str: string): number => {
  const sinMiles = str.trim().replace(/\./g, '')
  const conPunto = sinMiles.replace(',', '.')
  const n = parseFloat(conPunto)
  return isNaN(n) ? 0 : n
}

const formatNumeroES = (n: number): string => n ? n.toLocaleString('es-AR') : ''

const LBL: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', marginBottom: '4px' }
const INPUT: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #dde3f0', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit' }
const INPUT_SM: React.CSSProperties = { ...INPUT, padding: '6px 8px', fontSize: '12px' }

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

const itemVacio = (): ManualFacturaItem => ({ descripcion: '', unidad: '', cantidad: 0, valor_unitario: 0 })

const vacio = (sociedad: Exclude<SociedadKey, 'sa'>, moneda: string): ManualFactura => ({
  id: '', sociedad, comprobante: '', cliente: '', ejecutivo: '', fecha_emision: '', fecha_vencimiento: '',
  condicion: '', moneda, items: [itemVacio()], iva: 0, monto: 0,
  oc_hes_pedido: '', periodo: '', colaborador: '', otros_conceptos: '',
  pdf_url: '', pdf_base64: '', pdf_nombre: '', creado_el: '',
})

export function ManualFacturaForm({
  sociedad, nombreSociedad, monedas, condicionOpts, execsConocidos, clientesConocidos,
  factura, calcularVencimientoPorCondicion, onGuardar, onCancelar,
}: Props) {
  const [form, setForm] = useState<ManualFactura>(() => factura
    ? { ...factura, items: factura.items?.length ? factura.items : [itemVacio()], iva: factura.iva || 0 }
    : vacio(sociedad, monedas[0]))
  const set = (fields: Partial<ManualFactura>) => setForm(prev => ({ ...prev, ...fields }))

  const [montoStr, setMontoStr] = useState(() => formatNumeroES(form.monto))
  const [ivaStr, setIvaStr] = useState(() => formatNumeroES(form.iva))
  useEffect(() => {
    setMontoStr(formatNumeroES(factura?.monto ?? 0))
    setIvaStr(formatNumeroES(factura?.iva ?? 0))
  }, [factura?.id])

  const totalCalculado = form.items.some(it => it.cantidad > 0 && it.valor_unitario > 0)
    ? form.items.reduce((s, it) => s + it.cantidad * it.valor_unitario, 0)
    : null

  const setItem = (idx: number, fields: Partial<ManualFacturaItem>) => {
    setForm(prev => ({ ...prev, items: prev.items.map((it, i) => i === idx ? { ...it, ...fields } : it) }))
  }
  const agregarLinea = () => setForm(prev => ({ ...prev, items: [...prev.items, itemVacio()] }))
  const quitarLinea = (idx: number) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))

  const [extrayendo, setExtrayendo] = useState(false)
  const [autocompletado, setAutocompletado] = useState(false)
  const [errorExtraccion, setErrorExtraccion] = useState('')

  const handlePdf = (file: File | null) => {
    if (!file) return
    setAutocompletado(false)
    setErrorExtraccion('')
    const reader = new FileReader()
    reader.onload = async e => {
      const dataUrl = String(e.target?.result || '')
      set({ pdf_base64: dataUrl, pdf_nombre: file.name })
      if (factura) return // no autocompletar al editar una factura existente
      setExtrayendo(true)
      try {
        const texto = await extraerTextoPdf(dataUrl)
        const datos = parsearFacturaTexto(texto, sociedad, condicionOpts)
        if (datos.moneda && !monedas.includes(datos.moneda)) delete datos.moneda
        if (Object.keys(datos).length === 0) {
          setErrorExtraccion('No se pudo reconocer ningún dato en este PDF, completá el formulario a mano.')
        } else {
          if (!datos.items?.length && datos.monto !== undefined) {
            setMontoStr(formatNumeroES(datos.monto))
          }
          if (datos.iva !== undefined) setIvaStr(formatNumeroES(datos.iva))
          set(datos)
          setAutocompletado(true)
        }
      } catch {
        setErrorExtraccion('No se pudo leer el PDF automáticamente, completá el formulario a mano.')
      } finally {
        setExtrayendo(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const puedeGuardar = form.comprobante.trim() && form.cliente.trim() && form.fecha_emision && (form.monto > 0 || totalCalculado !== null)

  const guardar = () => {
    if (!puedeGuardar) return
    const monto = totalCalculado !== null ? totalCalculado + (form.iva || 0) : form.monto
    const items = form.items.filter(it => it.descripcion.trim() || it.cantidad || it.valor_unitario)
    const fecha_vencimiento = calcularVencimientoPorCondicion(form.fecha_emision, form.condicion) || form.fecha_vencimiento
    onGuardar({
      ...form,
      id: form.id || `${sociedad}-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      comprobante: form.comprobante.trim(),
      cliente: form.cliente.trim(),
      ejecutivo: form.ejecutivo.trim() || 'Sin asignar',
      items,
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
          <input
            type="date" value={form.fecha_emision}
            onChange={e => {
              const fecha_emision = e.target.value
              const fecha_vencimiento = calcularVencimientoPorCondicion(fecha_emision, form.condicion) || form.fecha_vencimiento
              set({ fecha_emision, fecha_vencimiento })
            }}
            style={INPUT}
          />
        </div>
        <div>
          <div style={LBL}>Condición de pago</div>
          <select
            value={form.condicion}
            onChange={e => {
              const condicion = e.target.value
              const fecha_vencimiento = calcularVencimientoPorCondicion(form.fecha_emision, condicion) || form.fecha_vencimiento
              set({ condicion, fecha_vencimiento })
            }}
            style={INPUT}
          >
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={LBL}>Detalle de ítems / servicios</div>
            <button type="button" onClick={agregarLinea} style={{ background: '#eef2ff', color: '#2554a0', border: '1px solid #c7d3ea', borderRadius: '7px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
              + Agregar línea
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 0.7fr 1fr 28px', gap: '8px', marginBottom: '4px' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Descripción</div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Unidad</div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Cant.</div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Valor unit.</div>
            <div />
          </div>
          {form.items.map((item, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 0.7fr 1fr 28px', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
              <input type="text" value={item.descripcion} onChange={e => setItem(idx, { descripcion: e.target.value })} style={INPUT_SM} />
              <input type="text" value={item.unidad} onChange={e => setItem(idx, { unidad: e.target.value })} style={INPUT_SM} />
              <input type="number" min={0} value={item.cantidad || ''} onChange={e => setItem(idx, { cantidad: Number(e.target.value) || 0 })} style={INPUT_SM} />
              <input type="number" min={0} step="0.01" value={item.valor_unitario || ''} onChange={e => setItem(idx, { valor_unitario: Number(e.target.value) || 0 })} style={INPUT_SM} />
              <button type="button" onClick={() => quitarLinea(idx)} disabled={form.items.length <= 1} style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid #fecaca', background: form.items.length <= 1 ? '#f8fafc' : '#fef2f2', color: form.items.length <= 1 ? '#cbd5e1' : '#dc2626', cursor: form.items.length <= 1 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 700 }}>
                ✕
              </button>
            </div>
          ))}
          {totalCalculado !== null ? (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px', maxWidth: '280px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#7a8fbb' }}>
                <span>Base imponible</span>
                <span style={{ fontFamily: 'monospace' }}>{form.moneda} {totalCalculado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#7a8fbb' }}>
                <span>IVA</span>
                <input
                  type="text" inputMode="decimal" placeholder="0,00"
                  value={ivaStr}
                  onChange={e => { setIvaStr(e.target.value); set({ iva: parseNumeroES(e.target.value) }) }}
                  onBlur={() => setIvaStr(formatNumeroES(form.iva))}
                  style={{ ...INPUT_SM, width: '110px', textAlign: 'right' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid #dde3f0' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0d1b38' }}>Total factura</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#2554a0', fontFamily: 'monospace' }}>{form.moneda} {(totalCalculado + (form.iva || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#7a8fbb' }}>Total (manual):</span>
              <input
                type="text" inputMode="decimal" placeholder="Monto"
                value={montoStr}
                onChange={e => { setMontoStr(e.target.value); set({ monto: parseNumeroES(e.target.value) }) }}
                onBlur={() => setMontoStr(formatNumeroES(form.monto))}
                style={{ ...INPUT, width: '160px' }}
              />
            </div>
          )}
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
          {extrayendo && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#7a8fbb' }}>⏳ Leyendo el PDF para autocompletar los campos e ítems...</div>
          )}
          {!extrayendo && autocompletado && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#059669', fontWeight: 600 }}>✓ Datos autocompletados desde el PDF. Revisá antes de guardar.</div>
          )}
          {!extrayendo && errorExtraccion && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#d97706' }}>⚠ {errorExtraccion}</div>
          )}
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
