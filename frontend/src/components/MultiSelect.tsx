import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const normalizar = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// Desplegable con casillas y buscador para elegir varias opciones a la vez.
// Se usa en los filtros de Facturación y de Comprobantes por cobrar.
export function MultiSelect({ options, selected, onChange, placeholderAll, formatLabel, buttonStyle, plural = 'seleccionados', maxLabel = 16 }: {
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
  placeholderAll: string
  formatLabel?: (v: string) => string
  buttonStyle?: React.CSSProperties
  plural?: string
  maxLabel?: number
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 270 })
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const fmt = formatLabel || ((v: string) => v)

  const actualizarCoords = () => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect) setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }

  useEffect(() => {
    if (!open) return
    actualizarCoords()
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', actualizarCoords, true)
    window.addEventListener('resize', actualizarCoords)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', actualizarCoords, true)
      window.removeEventListener('resize', actualizarCoords)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  let label = placeholderAll
  if (selected.length === 1) { const l = fmt(selected[0]); label = l.length > maxLabel ? l.slice(0, maxLabel - 1) + '…' : l }
  else if (selected.length > 1) label = `${selected.length} ${plural}`

  const visible = search ? options.filter(o => normalizar(fmt(o)).includes(normalizar(search))) : options
  const toggle = (opt: string) => onChange(selected.includes(opt) ? selected.filter(v => v !== opt) : [...selected, opt])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ ...mselBtn, ...buttonStyle }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: 8, color: '#6b7a99' }}>▾</span>
      </button>
      {open && createPortal(
        <div ref={panelRef} style={{ ...mselPanel, position: 'fixed', top: coords.top, left: coords.left, width: Math.max(coords.width, 220) }}>
          {options.length > 0 && <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={mselSearch} />}
          <div style={mselActions}>
            <span onClick={() => onChange(options)}>Todos</span>
            <span onClick={() => onChange([])}>Limpiar</span>
          </div>
          {visible.length === 0 ? <div style={{ padding: 6, fontSize: 11, color: '#6b7a99' }}>Sin resultados</div> : visible.map(opt => (
            <label key={opt} style={mselOption}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmt(opt)}</span>
            </label>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

const mselBtn: React.CSSProperties = { border: '1px solid #bfe1f3', borderRadius: 6, padding: '4px 8px', fontSize: 11, background: '#f7fcff', color: '#1f2a44', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, width: '100%', minWidth: 90, justifyContent: 'space-between' }
const mselPanel: React.CSSProperties = { position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: '#fff', border: '1px solid #b7dcf0', borderRadius: 8, boxShadow: '0 6px 24px rgba(10,22,40,0.14)', zIndex: 1100, width: 270, maxWidth: 'calc(100vw - 40px)', maxHeight: 260, overflowY: 'auto', padding: 6 }
const mselSearch: React.CSSProperties = { width: '100%', border: '1px solid #dcecf8', borderRadius: 6, padding: '5px 8px', fontSize: 11.5, color: '#1f2a44', background: '#f7fcff', outline: 'none', marginBottom: 6 }
const mselActions: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '2px 6px 6px', borderBottom: '1px solid #dcecf8', marginBottom: 4, fontSize: 10.5, color: '#1a8fd0', fontWeight: 700, cursor: 'pointer' }
const mselOption: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', fontSize: 12, cursor: 'pointer', borderRadius: 5, color: '#3f4d6b' }
