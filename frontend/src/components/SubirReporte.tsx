import { useRef, useState } from 'react'
import axios from 'axios'
import type { Extra } from '../hooks/useExtras'
import { supabase } from '../lib/supabase'

const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']

function mergeText(actual: string, nuevo: string) {
  const limpio = nuevo.trim()
  if (!limpio) return actual
  const partes = actual.split(' | ').map(p => p.trim()).filter(Boolean)
  return partes.includes(limpio) ? actual : [...partes, limpio].join(' | ')
}

async function leerXmlConEncoding(archivo: File) {
  const buffer = await archivo.arrayBuffer()
  const cabecera = new TextDecoder('windows-1252').decode(buffer.slice(0, 300))
  const encoding = /encoding=['"]([^'"]+)['"]/i.exec(cabecera)?.[1]?.toLowerCase()
  const decoder = encoding === 'iso-8859-1' || encoding === 'windows-1252'
    ? new TextDecoder('windows-1252')
    : new TextDecoder('utf-8')
  return decoder.decode(buffer)
}

function parseDescXML(xmlText: string): Extra[] {
  const xmlSeguro = xmlText.replace(/<CC%>/g, '<CCPct>').replace(/<\/CC%>/g, '</CCPct>')
  const doc = new DOMParser().parseFromString(xmlSeguro, 'text/xml')
  const rows = new Map<string, Extra>()
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
    const existente = rows.get(comp)
    if (existente) {
      rows.set(comp, {
        ...existente,
        descripcion: mergeText(existente.descripcion, item),
        centro_costo: mergeText(existente.centro_costo, cc),
        tipo_servicio: mergeText(existente.tipo_servicio, tipo),
        oc_hes_pedido: mergeText(existente.oc_hes_pedido, oc),
        periodo: mergeText(existente.periodo, per),
      })
      return
    }
    rows.set(comp, {
      comprobante: comp, descripcion: item, centro_costo: cc, tipo_servicio: tipo,
      oc_hes_pedido: oc, colaborador: '', otros_conceptos: '',
      condicion_override: '', periodo: per, nota: '',
    })
  })
  return Array.from(rows.values())
}

async function buscarComprobantesExistentes(nums: string[]) {
  const existentes = new Set<string>()
  const unicos = Array.from(new Set(nums))
  for (let i = 0; i < unicos.length; i += 300) {
    const { data, error } = await supabase
      .from('comprobantes')
      .select('comprobante')
      .in('comprobante', unicos.slice(i, i + 300))
    if (error) throw new Error(error.message)
    for (const row of data ?? []) existentes.add(row.comprobante)
  }
  return existentes
}

type OverlayState =
  | { kind: 'loading'; title: string; sub: string }
  | { kind: 'success'; nuevos: number; actualizados: number; cobradas: number; total: number }
  | { kind: 'success-xml'; cantidad: number; omitidos?: number }
  | { kind: 'warning-xml'; missing: number; found: number; total: number }
  | { kind: 'error'; message: string }
  | null

function Overlay({ state, onClose, onContinue }: {
  state: OverlayState
  onClose: () => void
  onContinue?: () => void
}) {
  if (!state) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '50px 40px', textAlign: 'center', maxWidth: '460px', width: '90%', boxShadow: '0 25px 80px rgba(0,0,0,0.6)' }}>

        {state.kind === 'loading' && (
          <>
            <div style={{ width: '56px', height: '56px', border: '5px solid #dde3f0', borderTopColor: '#2554a0', borderRadius: '50%', margin: '0 auto 24px', animation: 'spin 0.8s linear infinite' }} />
            <h2 style={{ color: '#0d1b38', margin: '0 0 10px', fontSize: '20px', fontWeight: 700 }}>{state.title}</h2>
            <p style={{ color: '#7a8fbb', margin: 0, fontSize: '14px' }}>{state.sub}</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </>
        )}

        {state.kind === 'success' && (
          <>
            <div style={{ fontSize: '54px', marginBottom: '18px' }}>✅</div>
            <h2 style={{ color: '#059669', margin: '0 0 20px', fontSize: '22px', fontWeight: 700 }}>¡Carga completada!</h2>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '18px', marginBottom: '16px', textAlign: 'left', color: '#14532d', fontSize: '14px', lineHeight: 2 }}>
              <div>✓ <strong>{state.nuevos}</strong> facturas nuevas</div>
              <div>✓ <strong>{state.actualizados}</strong> ya existían → cobradas</div>
              <div>✓ <strong>{state.cobradas}</strong> detectadas como cobradas</div>
              <div>✓ <strong>{state.total}</strong> comprobantes procesados</div>
            </div>
            <p style={{ color: '#7a8fbb', margin: 0, fontSize: '12px', fontStyle: 'italic' }}>Recargando página...</p>
          </>
        )}

        {state.kind === 'success-xml' && (
          <>
            <div style={{ fontSize: '54px', marginBottom: '18px' }}>✅</div>
            <h2 style={{ color: '#059669', margin: '0 0 14px', fontSize: '22px', fontWeight: 700 }}>XML cargado</h2>
            <p style={{ color: '#7a8fbb', margin: 0, fontSize: '14px' }}>
              <strong>{state.cantidad}</strong> descripciones guardadas correctamente.
              {!!state.omitidos && (
                <span><br /><strong>{state.omitidos}</strong> no se cargaron porque todavÃ­a no existe ese comprobante.</span>
              )}
            </p>
            <button onClick={onClose} style={{ marginTop: '24px', background: '#2554a0', color: '#fff', border: 'none', padding: '10px 28px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>Cerrar</button>
          </>
        )}

        {state.kind === 'warning-xml' && (
          <>
            <div style={{ fontSize: '54px', marginBottom: '18px' }}>⚠️</div>
            <h2 style={{ color: '#d97706', margin: '0 0 14px', fontSize: '20px', fontWeight: 700 }}>Comprobantes no encontrados</h2>
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '16px 18px', marginBottom: '20px', textAlign: 'left', color: '#92400e', fontSize: '14px', lineHeight: 1.7 }}>
              <strong>{state.missing}</strong> de los <strong>{state.total}</strong> comprobantes del XML no existen en la base de datos.
              <br />
              Primero cargá el <strong>XML de cobranzas</strong> correspondiente para registrar esas facturas.
              {state.found > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #fcd34d', color: '#78350f' }}>
                  Los <strong>{state.found}</strong> comprobantes encontrados sí se pueden guardar.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {state.found > 0 && onContinue && (
                <button
                  onClick={onContinue}
                  style={{ background: '#d97706', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Guardar los {state.found} encontrados
                </button>
              )}
              <button
                onClick={onClose}
                style={{ background: state.found > 0 ? '#fff' : '#2554a0', color: state.found > 0 ? '#374151' : '#fff', border: state.found > 0 ? '1px solid #dde3f0' : 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                {state.found > 0 ? 'Cancelar' : 'Entendido'}
              </button>
            </div>
          </>
        )}

        {state.kind === 'error' && (
          <>
            <div style={{ fontSize: '54px', marginBottom: '18px' }}>❌</div>
            <h2 style={{ color: '#dc2626', margin: '0 0 14px', fontSize: '20px', fontWeight: 700 }}>Error al procesar</h2>
            <p style={{ color: '#7a8fbb', margin: '0 0 20px', fontSize: '14px' }}>{state.message}</p>
            <button onClick={onClose} style={{ background: '#2554a0', color: '#fff', border: 'none', padding: '10px 28px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>Cerrar</button>
          </>
        )}

      </div>
    </div>
  )
}

interface Props {
  batchUpsert?: (rows: Extra[]) => Promise<void>
  onExport?: () => void
}

export function SubirReporte({ batchUpsert, onExport }: Props) {
  const inputRef        = useRef<HTMLInputElement | null>(null)
  const xmlRef          = useRef<HTMLInputElement | null>(null)
  const pendingRowsRef  = useRef<Extra[]>([])
  const [cargando,    setCargando]    = useState(false)
  const [cargandoXml, setCargandoXml] = useState(false)
  const [dragOver,    setDragOver]    = useState(false)
  const [overlay,     setOverlay]     = useState<OverlayState>(null)
  const [error, setError] = useState('')

  const processExcelFile = async (archivo: File) => {
    const extensionValida = /\.(xls|xlsx|csv|xml)$/i.test(archivo.name)
    if (!extensionValida) { setError('El archivo debe ser .xls, .xlsx, .csv o .xml.'); return }
    setCargando(true)
    setError('')
    setOverlay({ kind: 'loading', title: 'Procesando XML...', sub: 'Actualizando comprobantes en la base de datos' })
    const formData = new FormData()
    formData.append('archivo', archivo)
    formData.append('usuario', 'usuario@asap.com')
    try {
      const { data } = await axios.post('/api/reportes/subir', formData, { timeout: 600000 })
      if (data.extrasGuardados !== undefined && data.total === 0) {
        setOverlay({ kind: 'success-xml', cantidad: data.extrasGuardados, omitidos: data.extrasOmitidos || 0 })
      } else {
        setOverlay({ kind: 'success', nuevos: data.nuevos, actualizados: data.actualizados, cobradas: data.cobradas, total: data.total })
        setTimeout(() => { window.location.reload() }, 2500)
      }
    } catch (err: any) {
      const raw = err?.response?.data?.error
      const msg = (typeof raw === 'string' ? raw : raw?.message) || err?.message || 'Error al procesar el archivo.'
      setOverlay({ kind: 'error', message: msg })
      setError(msg)
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

  const doSaveRows = async (rows: Extra[]) => {
    if (!batchUpsert) return
    setCargandoXml(true)
    setOverlay({ kind: 'loading', title: 'Guardando descripciones...', sub: 'Actualizando base de datos' })
    try {
      await batchUpsert(rows)
      setOverlay({ kind: 'success-xml', cantidad: rows.length })
    } catch (err: any) {
      const msg = err?.message || 'Error al guardar.'
      setOverlay({ kind: 'error', message: msg })
      setError(msg)
    } finally {
      setCargandoXml(false)
      pendingRowsRef.current = []
    }
  }

  const handleXml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (!archivo || !batchUpsert) return
    setCargandoXml(true)
    setError('')
    setOverlay({ kind: 'loading', title: 'Procesando XML...', sub: 'Leyendo descripciones de comprobantes' })
    try {
      const text = await leerXmlConEncoding(archivo)
      const rows = parseDescXML(text)
      if (rows.length === 0) {
        setOverlay({ kind: 'error', message: 'No se encontraron registros DATO en el XML.' })
        setError('No se encontraron registros en el XML.')
        return
      }

      // Verificar cuáles comprobantes existen en la BD
      const nums = rows.map(r => r.comprobante)
      const existingSet = await buscarComprobantesExistentes(nums)
      const missingCount = nums.filter(n => !existingSet.has(n)).length
      const foundCount   = nums.length - missingCount

      const rowsEncontradas = rows.filter(r => existingSet.has(r.comprobante))
      if (rowsEncontradas.length > 0) await batchUpsert(rowsEncontradas)
      setOverlay({ kind: 'success-xml', cantidad: foundCount, omitidos: missingCount })
    } catch (err: any) {
      const msg = err?.message || 'Error al procesar el XML.'
      setOverlay({ kind: 'error', message: msg })
      setError(msg)
    } finally {
      setCargandoXml(false)
      if (xmlRef.current) xmlRef.current.value = ''
    }
  }

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <Overlay
        state={overlay}
        onClose={() => { setOverlay(null); pendingRowsRef.current = [] }}
        onContinue={pendingRowsRef.current.length > 0 ? () => doSaveRows(pendingRowsRef.current) : undefined}
      />

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          background: '#fff', border: dragOver ? '2px dashed #2554a0' : '1px solid #d9e2f1',
          borderRadius: '10px', padding: '16px 20px', marginBottom: '20px',
          boxShadow: '0 2px 12px rgba(38,63,101,0.06)', transition: 'border-color 0.15s',
          ...(dragOver ? { background: '#f0f4ff' } : {}),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', border: '1px solid #dde3f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#f8faff' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2554a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0d1b38', marginBottom: '2px' }}>Actualizar datos</div>
            <div style={{ fontSize: '12px', color: '#7a8fbb' }}>Arrastrá el XML acá o hacé clic — detecta cobros automáticamente</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: cargando ? '#7a8fbb' : '#2554a0', color: '#fff', padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: cargando ? 'not-allowed' : 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
              {/* always render both icon and spinner — toggle display to avoid insertBefore */}
              <span style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', display: cargando ? 'inline-block' : 'none', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
              <svg style={{ display: cargando ? 'none' : '' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {cargando ? 'Procesando...' : 'Cargar XML cobranzas'}
              <input ref={inputRef} type="file" accept=".xls,.xlsx,.csv,.xml" onChange={handleArchivo} disabled={cargando} style={{ display: 'none' }} />
            </label>

            {batchUpsert && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: cargandoXml ? '#7a8fbb' : '#0f766e', color: '#fff', padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: cargandoXml ? 'not-allowed' : 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
              <span style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', display: cargandoXml ? 'inline-block' : 'none', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
              <svg style={{ display: cargandoXml ? 'none' : '' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
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
    </>
  )
}
