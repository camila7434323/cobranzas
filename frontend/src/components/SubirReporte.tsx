import { useRef, useState } from 'react'
import axios from 'axios'
import type { Extra } from '../hooks/useExtras'

const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']

function parseDescXML(xmlText: string): Extra[] {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml')
  const rows: Extra[] = []
  doc.querySelectorAll('DATO').forEach(dato => {
    const comp = dato.querySelector('Comp')?.textContent?.trim() ?? ''
    const item = dato.querySelector('Item_Desc')?.textContent?.trim() ?? ''
    const cc   = dato.querySelector('CCDescripcion')?.textContent?.trim() ?? ''
    const tipo = dato.querySelector('CoditemDesc')?.textContent?.trim() ?? ''
    if (!comp) return
    const ocM  = item.match(/(?:OC|HES|PEDIDO)[^\w]*([\w/-]+)/i)
    const oc   = ocM ? ocM[0].trim() : ''
    const perM = item.match(new RegExp(`(${MESES.join('|')})\\s+\\d{4}`, 'i'))
    const per  = perM ? perM[0].toUpperCase() : ''
    rows.push({
      comprobante: comp, descripcion: item, centro_costo: cc, tipo_servicio: tipo,
      oc_hes_pedido: oc, colaborador: '', otros_conceptos: '',
      condicion_override: '', periodo: per, nota: '',
    })
  })
  return rows
}

function mostrarOverlay(mensaje: string, submensaje: string) {
  eliminarOverlay()
  const overlay = document.createElement('div')
  overlay.id = '__overlay_carga__'
  overlay.innerHTML = `
    <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:99999;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;">
      <div style="background:#fff;border-radius:16px;padding:50px 40px;text-align:center;max-width:440px;width:90%;box-shadow:0 25px 80px rgba(0,0,0,0.6);">
        <div id="__overlay_spinner__" style="width:56px;height:56px;border:5px solid #dde3f0;border-top-color:#2554a0;border-radius:50%;margin:0 auto 24px;animation:__spin__ 0.8s linear infinite;"></div>
        <h2 style="color:#0d1b38;margin:0 0 10px;font-size:20px;font-weight:700;">${mensaje}</h2>
        <p style="color:#7a8fbb;margin:0;font-size:14px;">${submensaje}</p>
        <style>@keyframes __spin__{ to{ transform:rotate(360deg) } }</style>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
}

function mostrarOverlayExito(nuevos: number, actualizados: number, cobradas: number, total: number) {
  eliminarOverlay()
  const overlay = document.createElement('div')
  overlay.id = '__overlay_carga__'
  overlay.innerHTML = `
    <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:99999;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;">
      <div style="background:#fff;border-radius:16px;padding:50px 40px;text-align:center;max-width:440px;width:90%;box-shadow:0 25px 80px rgba(0,0,0,0.6);">
        <div style="font-size:54px;margin-bottom:18px;">✅</div>
        <h2 style="color:#059669;margin:0 0 20px;font-size:22px;font-weight:700;">¡Carga completada!</h2>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px;margin-bottom:16px;text-align:left;color:#14532d;font-size:14px;line-height:2;">
          <div>✓ <strong>${nuevos}</strong> facturas nuevas</div>
          <div>✓ <strong>${actualizados}</strong> ya existían → cobradas</div>
          <div>✓ <strong>${cobradas}</strong> detectadas como cobradas</div>
          <div>✓ <strong>${total}</strong> comprobantes procesados</div>
        </div>
        <p style="color:#7a8fbb;margin:0;font-size:12px;font-style:italic;">Recargando página...</p>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
}

function mostrarOverlayExitoXml(cantidad: number) {
  eliminarOverlay()
  const overlay = document.createElement('div')
  overlay.id = '__overlay_carga__'
  overlay.innerHTML = `
    <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:99999;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;">
      <div style="background:#fff;border-radius:16px;padding:50px 40px;text-align:center;max-width:440px;width:90%;box-shadow:0 25px 80px rgba(0,0,0,0.6);">
        <div style="font-size:54px;margin-bottom:18px;">✅</div>
        <h2 style="color:#059669;margin:0 0 14px;font-size:22px;font-weight:700;">XML cargado</h2>
        <p style="color:#7a8fbb;margin:0;font-size:14px;"><strong>${cantidad}</strong> descripciones guardadas correctamente.</p>
        <button onclick="document.getElementById('__overlay_carga__').remove()" style="margin-top:24px;background:#2554a0;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">Cerrar</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
}

function mostrarOverlayError(mensaje: string) {
  eliminarOverlay()
  const overlay = document.createElement('div')
  overlay.id = '__overlay_carga__'
  overlay.innerHTML = `
    <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:99999;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;">
      <div style="background:#fff;border-radius:16px;padding:50px 40px;text-align:center;max-width:440px;width:90%;box-shadow:0 25px 80px rgba(0,0,0,0.6);">
        <div style="font-size:54px;margin-bottom:18px;">❌</div>
        <h2 style="color:#dc2626;margin:0 0 14px;font-size:20px;font-weight:700;">Error al procesar</h2>
        <p style="color:#7a8fbb;margin:0 0 20px;font-size:14px;">${mensaje}</p>
        <button onclick="document.getElementById('__overlay_carga__').remove()" style="background:#2554a0;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">Cerrar</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
}

function eliminarOverlay() {
  document.getElementById('__overlay_carga__')?.remove()
}

interface Props {
  batchUpsert?: (rows: Extra[]) => Promise<void>
  onExport?: () => void
}

export function SubirReporte({ batchUpsert, onExport }: Props) {
  const inputRef      = useRef<HTMLInputElement | null>(null)
  const xmlRef        = useRef<HTMLInputElement | null>(null)
  const [cargando,    setCargando]    = useState(false)
  const [cargandoXml, setCargandoXml] = useState(false)
  const [dragOver,    setDragOver]    = useState(false)
  const [error, setError] = useState('')

  const processExcelFile = async (archivo: File) => {
    const extensionValida = /\.(xls|xlsx|csv|xml)$/i.test(archivo.name)
    if (!extensionValida) { setError('El archivo debe ser .xls, .xlsx, .csv o .xml.'); return }
    setCargando(true)
    setError('')
    mostrarOverlay('Procesando XML...', 'Actualizando comprobantes en la base de datos')
    const formData = new FormData()
    formData.append('archivo', archivo)
    formData.append('usuario', 'usuario@asap.com')
    try {
      const { data } = await axios.post('/api/reportes/subir', formData, { timeout: 600000 })
      mostrarOverlayExito(data.nuevos, data.actualizados, data.cobradas, data.total)
      setTimeout(() => { window.location.reload() }, 2500)
    } catch (err: any) {
      const raw = err?.response?.data?.error
      const errorMsg = (typeof raw === 'string' ? raw : raw?.message) || err?.message || 'Error al procesar el archivo.'
      mostrarOverlayError(errorMsg)
      setError(errorMsg)
      setCargando(false)
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (archivo) processExcelFile(archivo)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const archivo = e.dataTransfer.files[0]
    if (archivo) processExcelFile(archivo)
  }

  const handleXml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (!archivo || !batchUpsert) return
    setCargandoXml(true)
    setError('')
    mostrarOverlay('Procesando XML...', 'Leyendo descripciones de comprobantes')
    try {
      const text = await archivo.text()
      const rows = parseDescXML(text)
      if (rows.length === 0) { mostrarOverlayError('No se encontraron registros DATO en el XML.'); setError('No se encontraron registros en el XML.'); return }
      await batchUpsert(rows)
      mostrarOverlayExitoXml(rows.length)
    } catch (err: any) {
      const errorMsg = err?.message || 'Error al procesar el XML.'
      mostrarOverlayError(errorMsg)
      setError(errorMsg)
    } finally {
      setCargandoXml(false)
      if (xmlRef.current) xmlRef.current.value = ''
    }
  }

  const spinnerEl = (
    <span style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: '__spin__ 0.8s linear infinite', flexShrink: 0 }} />
  )

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        background: '#fff',
        border: dragOver ? '2px dashed #2554a0' : '1px solid #d9e2f1',
        borderRadius: '10px',
        padding: '16px 20px',
        marginBottom: '20px',
        boxShadow: '0 2px 12px rgba(38,63,101,0.06)',
        transition: 'border-color 0.15s, background 0.15s',
        ...(dragOver ? { background: '#f0f4ff' } : {}),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* icon */}
        <div style={{ width: '42px', height: '42px', border: '1px solid #dde3f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#f8faff' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2554a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>

        {/* text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0d1b38', marginBottom: '2px' }}>Actualizar datos</div>
          <div style={{ fontSize: '12px', color: '#7a8fbb' }}>Arrastrá el XML acá o hacé clic — detecta cobros automáticamente</div>
        </div>

        {/* buttons */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: cargando ? '#7a8fbb' : '#2554a0', color: '#fff', padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: cargando ? 'not-allowed' : 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
            {cargando ? spinnerEl : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
            {cargando ? 'Procesando...' : 'Cargar XML cobranzas'}
            <input ref={inputRef} type="file" accept=".xls,.xlsx,.csv,.xml" onChange={handleArchivo} disabled={cargando} style={{ display: 'none' }} />
          </label>

          {batchUpsert && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: cargandoXml ? '#7a8fbb' : '#0f766e', color: '#fff', padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: cargandoXml ? 'not-allowed' : 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
              {cargandoXml ? spinnerEl : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
              {cargandoXml ? 'Procesando...' : 'Cargar XML descripciones'}
              <input ref={xmlRef} type="file" accept=".xml" onChange={handleXml} disabled={cargandoXml} style={{ display: 'none' }} />
            </label>
          )}

          {onExport && (
            <button onClick={onExport} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: '#065f46', color: '#fff', padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Exportar Excel
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ color: '#dc2626', marginTop: '10px', fontSize: '13px', fontWeight: 500 }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}
