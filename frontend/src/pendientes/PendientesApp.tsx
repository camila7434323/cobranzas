import { Fragment, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { usePendientes, type Pendiente } from './usePendientes'

type Entidad = 'sa' | 'llc' | 'sl'
type Vista = 'todos' | Entidad | 'historico' | 'resumen'
type SortKey = 'cliente' | 'motivo' | 'importe' | 'resp' | 'dias'

const ENTIDADES: Record<Entidad, { label: string; flag: string; order: number }> = {
  sa:  { label: 'ASAP Consulting SA',   flag: 'ar', order: 1 },
  llc: { label: 'ASAP Consulting LLC',  flag: 'us', order: 2 },
  sl:  { label: 'IT ASAP Solutions SL', flag: 'es', order: 3 },
}
const ORDEN_ENT: Entidad[] = ['sa', 'llc', 'sl']
const MONEDAS_ENT: Record<Entidad, string[]> = { sa: ['ARS', 'USD'], llc: ['USD'], sl: ['EUR', 'USD'] }

const EXEC_COLOR: Record<string, { color: string; bg: string }> = {
  'Joaquin Ramirez':       { color: '#065f46', bg: '#d1fae5' },
  'Leonardo Nocera':       { color: '#1e40af', bg: '#dbeafe' },
  'Maria Fernanda Dugini': { color: '#b45309', bg: '#fef3c7' },
  'Julieta Salvucci':      { color: '#4c1d95', bg: '#ede9fe' },
  'Silvina Buczer':        { color: '#744210', bg: '#fef3c7' },
  'Emiliano Angelinetta':  { color: '#1d4170', bg: '#dbeafe' },
}
const execColor = (n: string) => EXEC_COLOR[n] || { color: '#6b7280', bg: '#f3f4f6' }

const MOTIVOS = ['Falta OC', 'Falta detalle Horas', 'Falta HES/Certificación', 'Falta respuesta cliente', 'Falta aprobación interna', 'Otro']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const fmt: Record<string, (n: number) => string> = {
  ARS: n => '$ ' + n.toLocaleString('es-AR'),
  USD: n => 'USD ' + n.toLocaleString('en-US'),
  EUR: n => '€ ' + n.toLocaleString('es-AR'),
}
const fmtMoneda = (moneda: string, n: number) => (fmt[moneda] || fmt.ARS)(n)

const parseISO = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const diffDays = (iso: string | null, ref: Date) =>
  iso ? Math.round((ref.getTime() - parseISO(iso).getTime()) / 86400000) : 0
const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  const d = parseISO(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
const fmtPeriodo = (iso: string) => {
  if (!iso) return ''
  const [y, m] = iso.split('-').map(Number)
  return `${MESES[m - 1]} ${y}`
}
const fmtFechaLarga = (d: Date) => `${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`
const shortHoy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
const periodoActual = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

const CSS = `
.pfc *, .pfc *::before, .pfc *::after { box-sizing: border-box; }
.pfc {
  --navy-900:#1e1b4b;--navy-800:#272257;--navy-700:#332c6e;--navy-600:#4338ca;--navy-500:#4f46e5;
  --navy-400:#6366f1;--navy-300:#a5b4fc;--navy-200:#c7d2fe;--navy-100:#e0e7ff;--navy-50:#f5f3ff;
  --bg:#f6f5fc;--surface:#fff;--surface2:#f9f8fd;--surface3:#f1effb;--border:#e3e0f7;--border2:#cac3f2;
  --text:#0d1b38;--text2:#3d5278;--muted:#7a8fbb;--muted2:#a0b0d0;
  --green:#059669;--green-dim:#d1fae5;--green-text:#065f46;--red:#b91c1c;--red-dim:#fee2e2;--red-text:#7f1d1d;
  --radius:10px;--shadow:0 1px 3px rgba(10,22,40,0.08),0 1px 2px rgba(10,22,40,0.05);--shadow-md:0 6px 24px rgba(10,22,40,0.14);
  font-family:'Inter',system-ui,sans-serif; font-size:14px; color:var(--text);
}
.pfc .shell { display:grid; grid-template-columns:258px 1fr; grid-template-rows:auto 1fr; height:100vh; width:100vw; background:var(--bg); }
.pfc .sidebar { grid-row:1/3; background:var(--navy-900); display:flex; flex-direction:column; box-shadow:2px 0 12px rgba(10,22,40,0.18); }
.pfc .sidebar-logo { padding:24px 20px 18px; border-bottom:1px solid rgba(255,255,255,0.07); }
.pfc .logo-mark { display:flex; align-items:center; gap:10px; }
.pfc .logo-icon { width:34px; height:34px; background:var(--navy-500); border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.pfc .logo-name { font-size:15px; font-weight:600; color:#fff; letter-spacing:-0.2px; }
.pfc .logo-sub { font-size:10px; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:1px; margin-left:44px; margin-top:3px; }
.pfc .sidebar-nav { padding:16px 14px 8px; flex:1; overflow-y:auto; }
.pfc .nav-item { display:flex; align-items:center; gap:8px; padding:10px 11px; border-radius:8px; cursor:pointer; font-size:13px; color:rgba(255,255,255,0.55); transition:all .15s; margin-bottom:3px; }
.pfc .nav-item img { border-radius:2px; flex-shrink:0; }
.pfc .nav-item .nlabel { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pfc .nav-item:hover { background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.9); }
.pfc .nav-item.active { background:rgba(79,70,229,0.4); color:#fff; }
.pfc .nav-badge { flex-shrink:0; font-size:10px; font-weight:700; background:rgba(220,38,38,0.28); color:#fca5a5; padding:1px 7px; border-radius:20px; }
.pfc .nav-divider { height:1px; background:rgba(255,255,255,0.09); margin:10px 4px; }
.pfc .sidebar-footer { padding:14px 20px; border-top:1px solid rgba(255,255,255,0.07); font-size:11px; color:rgba(255,255,255,0.28); display:flex; flex-direction:column; align-items:flex-start; gap:5px; }
.pfc .status-dot { width:6px; height:6px; border-radius:50%; background:var(--green); flex-shrink:0; }
.pfc .side-link { color:rgba(255,255,255,0.4); font-size:11px; cursor:pointer; font-weight:600; }
.pfc .side-link:hover { color:#fff; }
.pfc .topbar { background:var(--surface); border-bottom:1px solid var(--border); padding:0 28px; display:flex; align-items:center; gap:14px; height:56px; box-shadow:var(--shadow); }
.pfc .topbar-title { font-size:18px; font-weight:700; letter-spacing:-0.3px; }
.pfc .topbar-spacer { flex:1; }
.pfc .search-wrap { position:relative; }
.pfc .search-wrap svg { position:absolute; left:10px; top:50%; transform:translateY(-50%); width:14px; height:14px; color:var(--muted); pointer-events:none; }
.pfc .search-input { background:var(--surface2); border:1px solid var(--border); color:var(--text); font:inherit; font-size:13px; padding:7px 12px 7px 32px; border-radius:8px; width:230px; outline:none; }
.pfc .search-input:focus { border-color:var(--navy-400); box-shadow:0 0 0 3px rgba(79,70,229,0.12); }
.pfc .topbar-btn { background:var(--navy-500); color:#fff; border:none; cursor:pointer; font:inherit; font-size:13px; font-weight:500; padding:7px 16px; border-radius:8px; display:flex; align-items:center; gap:6px; }
.pfc .topbar-btn:hover { background:var(--navy-600); }
.pfc .topbar-btn svg { width:13px; height:13px; }
.pfc .admin-btn { background:var(--surface2); color:var(--text2); border:1px solid var(--border); cursor:pointer; font:inherit; font-size:12.5px; font-weight:600; padding:7px 14px; border-radius:8px; }
.pfc .admin-btn.on { background:var(--navy-50); color:var(--navy-700); border-color:var(--navy-300); }
.pfc .main { padding:24px 28px; overflow-y:auto; }
.pfc .entity-tags { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:22px; }
.pfc .etag { background:var(--surface); border:1px solid var(--border); border-top:3px solid var(--navy-500); border-radius:var(--radius); padding:16px 18px; box-shadow:var(--shadow); }
.pfc .etag .et-head { display:flex; align-items:center; gap:7px; font-size:12px; font-weight:600; color:var(--text2); margin-bottom:10px; }
.pfc .etag .et-amount { font-size:21px; font-weight:700; color:var(--navy-800); line-height:1.2; }
.pfc .etag .et-sub { font-size:13px; font-weight:600; color:var(--text2); margin-top:3px; }
.pfc .etag .et-empty { font-size:13px; color:var(--green-text); font-weight:600; padding:4px 0; }
.pfc .ebox { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; box-shadow:var(--shadow); margin-bottom:18px; }
.pfc .ebox-head { padding:12px 18px; background:var(--surface2); border-bottom:1px solid var(--border); display:flex; align-items:center; gap:8px; }
.pfc .ebox-head .en { font-size:13.5px; font-weight:700; }
.pfc .ebox-head .ec { font-size:12px; color:var(--muted); margin-left:4px; }
.pfc table { width:100%; border-collapse:collapse; table-layout:fixed; }
.pfc thead th { padding:9px 16px; text-align:left; font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.9px; background:var(--surface2); border-bottom:1px solid var(--border); white-space:nowrap; cursor:pointer; user-select:none; }
.pfc thead th:hover { color:var(--navy-600); }
.pfc thead th .arrow { opacity:.4; font-size:9px; margin-left:3px; }
.pfc thead th.sorted .arrow { opacity:1; color:var(--navy-500); }
.pfc tbody tr.data-row { border-bottom:1px solid var(--border); cursor:pointer; }
.pfc tbody tr.data-row:hover { background:var(--navy-50); }
.pfc td { padding:12px 16px; font-size:13px; vertical-align:middle; }
.pfc .client-name { font-weight:600; font-size:13.5px; display:flex; align-items:center; gap:6px; }
.pfc .chev { display:inline-block; transition:transform .15s; color:var(--muted); font-size:10px; }
.pfc .data-row.open .chev { transform:rotate(90deg); }
.pfc .motivo-chip { display:inline-block; font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:20px; background:var(--navy-100); color:var(--navy-700); margin-bottom:4px; margin-right:5px; }
.pfc .periodo-chip { display:inline-block; font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:20px; background:var(--surface3); color:var(--text2); border:1px solid var(--border2); margin-bottom:4px; }
.pfc .concepto-txt { font-size:12.5px; color:var(--text2); }
.pfc .exec-tag { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:500; padding:3px 8px; border-radius:20px; white-space:nowrap; }
.pfc .exec-dot { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
.pfc .monto { font-size:13px; font-weight:700; white-space:nowrap; }
.pfc .pend-badge { display:inline-flex; align-items:center; font-weight:700; font-size:12px; padding:3px 10px; border-radius:20px; background:var(--red-dim); color:var(--red-text); white-space:nowrap; }
.pfc tfoot td { padding:10px 16px; font-size:12.5px; font-weight:700; color:var(--text2); background:var(--surface2); border-top:1px solid var(--border); }
.pfc .detail-row td { padding:14px 18px 18px; background:var(--surface3); }
.pfc .deber-line { font-size:12.5px; color:var(--text2); margin-bottom:10px; }
.pfc .deber-line b { color:var(--text); }
.pfc .hist-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin-bottom:6px; }
.pfc .hist-line { font-size:12.5px; color:var(--text2); padding:5px 0 5px 12px; border-left:2px solid var(--border2); margin-bottom:4px; }
.pfc .hist-line b { color:var(--text); }
.pfc .note-row { display:flex; gap:8px; margin-top:10px; }
.pfc .note-row input { flex:1; font-size:12.5px; padding:8px 11px; border:1px solid var(--border); border-radius:8px; font:inherit; }
.pfc .note-row button { font-size:12.5px; font-weight:600; padding:8px 15px; border-radius:8px; border:none; background:var(--navy-500); color:#fff; cursor:pointer; font:inherit; }
.pfc .approve-box { margin-top:14px; padding-top:14px; border-top:1px dashed var(--border2); }
.pfc .approve-box .ab-title { font-size:11.5px; font-weight:700; color:var(--green-text); margin-bottom:8px; }
.pfc .approve-grid { display:grid; grid-template-columns:1fr 1fr 1.6fr auto; gap:8px; align-items:end; }
.pfc .approve-grid label { display:block; font-size:10.5px; font-weight:600; color:var(--muted); margin-bottom:4px; }
.pfc .approve-grid input, .pfc .approve-grid select { width:100%; font-size:12.5px; padding:7px 9px; border:1px solid var(--border); border-radius:7px; font:inherit; }
.pfc .approve-grid button { background:var(--green); color:#fff; border:none; padding:8px 14px; border-radius:7px; font-size:12.5px; font-weight:700; cursor:pointer; font:inherit; white-space:nowrap; }
.pfc .admin-note { font-size:11.5px; color:var(--muted); font-style:italic; margin-top:12px; }
.pfc .admin-actions { display:flex; gap:8px; margin-top:12px; padding-top:12px; border-top:1px dashed var(--border2); }
.pfc .admin-actions button { font-size:12px; font-weight:600; padding:7px 13px; border-radius:7px; cursor:pointer; font:inherit; border:1px solid var(--border); background:var(--surface); color:var(--text2); }
.pfc .admin-actions .btn-del { color:var(--red-text); }
.pfc .admin-actions .btn-del:hover { background:var(--red-dim); border-color:#f87171; }
.pfc .edit-box { margin-top:12px; padding:14px; background:var(--navy-50); border:1px solid var(--navy-200); border-radius:9px; }
.pfc .edit-box .eb-title { font-size:11.5px; font-weight:700; color:var(--navy-700); margin-bottom:10px; }
.pfc .edit-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.pfc .edit-grid .full { grid-column:1/-1; }
.pfc .edit-grid label { display:block; font-size:10.5px; font-weight:600; color:var(--muted); margin-bottom:4px; }
.pfc .edit-grid input, .pfc .edit-grid select { width:100%; font-size:12.5px; padding:7px 9px; border:1px solid var(--border); border-radius:7px; font:inherit; background:#fff; }
.pfc .edit-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:10px; }
.pfc .edit-actions .btn-save { background:var(--navy-500); color:#fff; border:none; padding:7px 15px; border-radius:7px; font-size:12.5px; font-weight:600; cursor:pointer; font:inherit; }
.pfc .edit-actions .btn-cancel { background:none; border:1px solid var(--border); padding:7px 15px; border-radius:7px; font-size:12.5px; cursor:pointer; font:inherit; color:var(--text2); }
.pfc .hist-final { font-size:12.5px; color:var(--green-text); padding:8px 10px; background:var(--green-dim); border-radius:8px; margin-top:8px; }
.pfc .repeat-btn { font-size:11.5px; font-weight:600; padding:5px 11px; border-radius:20px; border:1px solid var(--navy-300); background:var(--navy-50); color:var(--navy-700); cursor:pointer; font:inherit; white-space:nowrap; }
.pfc .repeat-btn:hover { background:var(--navy-100); }
.pfc .undo-btn { font-size:11.5px; font-weight:600; padding:5px 11px; border-radius:20px; border:1px solid #fecaca; background:#fff5f5; color:var(--red-text); cursor:pointer; font:inherit; white-space:nowrap; margin-left:6px; }
.pfc .undo-btn:hover { background:var(--red-dim); }
.pfc .resumen-toolbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; gap:16px; }
.pfc .resumen-sub { font-size:12.5px; color:var(--muted); }
.pfc .export-btn { background:var(--green); color:#fff; border:none; cursor:pointer; font:inherit; font-size:13px; font-weight:600; padding:9px 16px; border-radius:8px; display:flex; align-items:center; gap:7px; white-space:nowrap; }
.pfc .export-btn:hover { background:#047857; }
.pfc .avg-badge { display:inline-flex; align-items:center; font-weight:700; font-size:12.5px; padding:3px 10px; border-radius:20px; }
.pfc .avg-low { background:#fef9c3; color:#854d0e; }
.pfc .avg-mid { background:#ffedd5; color:#9a3412; }
.pfc .avg-high { background:var(--red-dim); color:var(--red-text); }
.pfc .minmax-txt { font-size:12px; color:var(--muted); }
.pfc .empty { text-align:center; padding:42px; color:var(--muted); font-size:13px; }
.pfc .modal-bg { position:fixed; inset:0; background:rgba(14,10,40,0.45); display:flex; align-items:center; justify-content:center; z-index:50; }
.pfc .modal { background:#fff; border-radius:14px; width:520px; max-width:92vw; max-height:88vh; overflow:auto; padding:24px 26px; box-shadow:var(--shadow-md); }
.pfc .modal h3 { font-size:16px; margin:0 0 4px; }
.pfc .modal .mhint { font-size:12.5px; color:var(--muted); margin-bottom:18px; line-height:1.5; }
.pfc .repeat-hint { font-size:12.5px; background:var(--navy-50); color:var(--navy-700); border:1px solid var(--navy-200); border-radius:8px; padding:9px 12px; margin:-8px 0 16px; }
.pfc .field { margin-bottom:13px; }
.pfc .field label { display:block; font-size:12px; font-weight:600; margin-bottom:5px; color:var(--text2); }
.pfc .field input, .pfc .field select { width:100%; font:inherit; font-size:13px; padding:9px 11px; border:1px solid var(--border); border-radius:8px; background:var(--surface2); color:var(--text); outline:none; }
.pfc .field input:focus, .pfc .field select:focus { border-color:var(--navy-400); }
.pfc .row2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.pfc .modal-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:18px; }
.pfc .btn-ghost { background:none; border:1px solid var(--border); padding:9px 15px; border-radius:8px; font-size:13px; cursor:pointer; font:inherit; color:var(--text2); }
.pfc .btn-primary { background:var(--navy-500); color:#fff; border:none; padding:9px 16px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; font:inherit; }
.pfc .toast { position:fixed; bottom:22px; left:50%; transform:translateX(-50%); background:var(--navy-900); color:#fff; padding:11px 20px; border-radius:9px; font-size:13px; z-index:60; box-shadow:var(--shadow-md); }
`

const flagUrl = (f: string) => `https://flagcdn.com/16x12/${f}.png`

export function PendientesApp({ onCambiarModulo }: { session: Session; onCambiarModulo: () => void }) {
  const { rows, loading, error, crear, actualizar, eliminar } = usePendientes()

  const hoy = useMemo(() => new Date(), [])
  const [vista, setVista] = useState<Vista>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [modoAdmin, setModoAdmin] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'dias', dir: 'desc' })
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [openHist, setOpenHist] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const [nota, setNota] = useState('')
  const [aprob, setAprob] = useState<{ fecha: string; via: string; com: string }>({ fecha: '', via: 'Mail del cliente', com: '' })
  const [edit, setEdit] = useState<Partial<Pendiente>>({})

  const emptyForm = {
    entidad: 'sa' as Entidad, cliente: '', motivo: MOTIVOS[0], concepto: '',
    importe: '', moneda: 'ARS', periodo: '', deber: '', resp: '',
  }
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [repeatHint, setRepeatHint] = useState('')

  const aviso = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200) }

  const activos = useMemo(
    () => rows.filter(r => r.estado === 'activo').map(r => ({ ...r, dias: diffDays(r.deber, hoy) })),
    [rows, hoy],
  )
  const historico = useMemo(
    () => rows.filter(r => r.estado === 'aprobado'),
    [rows],
  )
  const clientesConocidos = useMemo(
    () => [...new Set(rows.map(r => r.cliente).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows],
  )
  const ejecutivosConocidos = useMemo(
    () => [...new Set([...Object.keys(EXEC_COLOR), ...rows.map(r => r.resp)].filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows],
  )

  const cambiarVista = (v: Vista) => {
    setVista(v)
    setOpenRow(null); setOpenHist(null); setEditId(null)
    setSort({ key: 'dias', dir: 'desc' })
  }

  const ordenar = (key: SortKey) => {
    setSort(s => s.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'dias' ? 'desc' : 'asc' })
  }
  const flecha = (key: SortKey) => sort.key !== key ? '↕' : (sort.dir === 'asc' ? '↑' : '↓')

  type ActivoConDias = Pendiente & { dias: number }
  const sortItems = (items: ActivoConDias[]) => {
    const mul = sort.dir === 'asc' ? 1 : -1
    return [...items].sort((a, b) => {
      let av: string | number, bv: string | number
      if (sort.key === 'cliente') { av = a.cliente.toLowerCase(); bv = b.cliente.toLowerCase() }
      else if (sort.key === 'motivo') { av = a.motivo.toLowerCase(); bv = b.motivo.toLowerCase() }
      else if (sort.key === 'importe') { av = a.importe; bv = b.importe }
      else if (sort.key === 'resp') { av = a.resp.toLowerCase(); bv = b.resp.toLowerCase() }
      else { av = a.dias; bv = b.dias }
      return av < bv ? -mul : av > bv ? mul : 0
    })
  }

  // ── acciones ──────────────────────────────────────────────────────────────
  const toggleRow = (id: string) => { setEditId(null); setNota(''); setAprob({ fecha: '', via: 'Mail del cliente', com: '' }); setOpenRow(o => o === id ? null : id) }

  const guardarNota = async (r: Pendiente) => {
    const t = nota.trim()
    if (!t) return
    try {
      await actualizar(r.id, { hist: [...r.hist, { f: shortHoy(hoy), t }] })
      setNota('')
      aviso('Novedad guardada')
    } catch { aviso('No se pudo guardar la novedad') }
  }

  const empezarEdicion = (r: ActivoConDias) => {
    setEditId(r.id)
    setEdit({ cliente: r.cliente, resp: r.resp, motivo: r.motivo, periodo: r.periodo, deber: r.deber, importe: r.importe, moneda: r.moneda, concepto: r.concepto })
  }
  const guardarEdicion = async (id: string) => {
    try {
      await actualizar(id, {
        cliente: (edit.cliente || '').trim(),
        resp: (edit.resp || '').trim(),
        motivo: edit.motivo,
        periodo: edit.periodo || '',
        deber: edit.deber || null,
        importe: Number(edit.importe) || 0,
        moneda: edit.moneda,
        concepto: (edit.concepto || '').trim(),
      })
      setEditId(null)
      aviso('Cambios guardados')
    } catch { aviso('No se pudo guardar') }
  }

  const borrar = async (r: Pendiente) => {
    if (!confirm(`¿Eliminar el pendiente de ${r.cliente} (${r.concepto})?\nEsta acción no se puede deshacer.`)) return
    try {
      await eliminar(r.id)
      if (openRow === r.id) setOpenRow(null)
      aviso('Pendiente eliminado')
    } catch { aviso('No se pudo eliminar') }
  }

  const aprobar = async (r: ActivoConDias) => {
    if (!aprob.fecha) { aviso('Elegí la fecha de aprobación'); return }
    try {
      await actualizar(r.id, {
        estado: 'aprobado',
        aprobado_el: aprob.fecha,
        via: aprob.via,
        comentario: aprob.com.trim() || '—',
        dias_al_aprobar: r.dias,
      })
      if (openRow === r.id) setOpenRow(null)
      setAprob({ fecha: '', via: 'Mail del cliente', com: '' })
      aviso('Pendiente movido al histórico')
    } catch { aviso('No se pudo aprobar') }
  }

  const deshacerAprobacion = async (r: Pendiente) => {
    if (!confirm(`¿Deshacer la aprobación de ${r.cliente} (${r.concepto})?\nVuelve a la lista de pendientes activos.`)) return
    try {
      await actualizar(r.id, {
        estado: 'activo',
        aprobado_el: null, via: null, comentario: null, dias_al_aprobar: null,
        hist: [...r.hist, { f: shortHoy(hoy), t: `Aprobación deshecha (estaba aprobado el ${r.aprobado_el} vía ${r.via}). Vuelve a seguimiento.` }],
      })
      if (openHist === r.id) setOpenHist(null)
      aviso('Pendiente devuelto a activos')
    } catch { aviso('No se pudo deshacer') }
  }

  // ── modal ─────────────────────────────────────────────────────────────────
  const abrirModal = () => { setForm(emptyForm); setRepeatHint(''); setModalOpen(true) }
  const repetir = (r: Pendiente) => {
    setForm({
      entidad: r.entidad, cliente: r.cliente, motivo: r.motivo, concepto: r.concepto,
      importe: '', moneda: r.moneda, resp: r.resp, deber: '', periodo: periodoActual(hoy),
    })
    setRepeatHint(`Repetido desde el pendiente de ${r.cliente} (${fmtPeriodo(r.periodo) || fmtDate(r.deber)}). Revisá el importe y la fecha en que debería facturarse este mes.`)
    setModalOpen(true)
  }
  const guardarNuevo = async () => {
    const { cliente, concepto, resp, deber } = form
    const importe = Number(form.importe)
    if (!cliente.trim() || !concepto.trim() || !importe || !resp.trim() || !deber) {
      aviso('Completá todos los campos para guardar'); return
    }
    try {
      await crear({
        entidad: form.entidad, cliente: cliente.trim(), motivo: form.motivo, concepto: concepto.trim(),
        resp: resp.trim(), importe, moneda: form.moneda as Pendiente['moneda'], deber, periodo: form.periodo,
        hist: [{ f: shortHoy(hoy), t: 'Pendiente registrado.' }],
      })
      setModalOpen(false)
      aviso('Pendiente guardado')
    } catch { aviso('No se pudo guardar el pendiente') }
  }

  const exportarCSV = () => {
    const headers = ['Cliente', 'Entidad', 'Motivo', 'Concepto', 'Período', 'Ejecutivo', 'Importe', 'Moneda', 'Debió facturarse el', 'Aprobado el', 'Vía', 'Comentario', 'Días de demora']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lineas = [headers.map(esc).join(';')]
    historico.forEach(r => {
      lineas.push([
        r.cliente, ENTIDADES[r.entidad].label, r.motivo, r.concepto, r.periodo ? fmtPeriodo(r.periodo) : '',
        r.resp, r.importe, r.moneda, fmtDate(r.deber), r.aprobado_el, r.via, r.comentario, r.dias_al_aprobar,
      ].map(esc).join(';'))
    })
    const csv = '﻿' + lineas.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `demoras_facturacion_${hoy.toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    aviso('Excel descargado')
  }

  // ── render helpers ────────────────────────────────────────────────────────
  const titulo = vista === 'todos' ? `Todos los pendientes de facturación al ${fmtFechaLarga(hoy)}`
    : vista === 'historico' ? 'Histórico de aprobados'
    : vista === 'resumen' ? 'Resumen de demoras por cliente'
    : ENTIDADES[vista as Entidad].label

  const badge = (n: number) => n > 0 ? <span className="nav-badge">{n}</span> : null
  const q = busqueda.trim().toLowerCase()
  const filtroEntidad: Entidad | null = (['sa', 'llc', 'sl'] as const).includes(vista as Entidad) ? vista as Entidad : null
  let base = filtroEntidad ? activos.filter(r => r.entidad === filtroEntidad) : activos
  if (q) base = base.filter(r => r.cliente.toLowerCase().includes(q) || r.concepto.toLowerCase().includes(q))

  const th = (key: SortKey, label: string, extra: React.CSSProperties = {}) => (
    <th className={sort.key === key ? 'sorted' : ''} style={extra} onClick={() => ordenar(key)}>
      {label} <span className="arrow">{flecha(key)}</span>
    </th>
  )

  const filaDetalle = (r: ActivoConDias) => (
    <tr className="detail-row">
      <td colSpan={5}>
        <div className="deber-line">
          {r.periodo ? <>Período <b>{fmtPeriodo(r.periodo)}</b> — </> : null}
          Debió facturarse el <b>{fmtDate(r.deber)}</b> — pendiente hace {r.dias} días.
          {modoAdmin && <button className="btn-ghost" style={{ padding: '3px 10px', fontSize: 11.5, marginLeft: 8 }} onClick={e => { e.stopPropagation(); repetir(r) }}>Repetir para otro período</button>}
        </div>
        <div className="hist-title">Seguimiento</div>
        {r.hist.map((h, i) => <div key={i} className="hist-line"><b>{h.f}</b> — {h.t}</div>)}
        <div className="note-row">
          <input value={openRow === r.id ? nota : ''} onChange={e => setNota(e.target.value)}
            onClick={e => e.stopPropagation()}
            placeholder="Agregar novedad... ej: me informaron que sigue demorado por falta de aprobación interna" />
          <button onClick={e => { e.stopPropagation(); guardarNota(r) }}>Guardar</button>
        </div>

        {editId === r.id && (
          <div className="edit-box" onClick={e => e.stopPropagation()}>
            <div className="eb-title">Editando pendiente</div>
            <div className="edit-grid">
              <div><label>Cliente</label><input list="pfc-clientes" value={edit.cliente || ''} onChange={e => setEdit(s => ({ ...s, cliente: e.target.value }))} /></div>
              <div><label>Ejecutivo</label><input list="pfc-ejecutivos" value={edit.resp || ''} onChange={e => setEdit(s => ({ ...s, resp: e.target.value }))} /></div>
              <div><label>Motivo</label><select value={edit.motivo} onChange={e => setEdit(s => ({ ...s, motivo: e.target.value }))}>{MOTIVOS.map(m => <option key={m}>{m}</option>)}</select></div>
              <div><label>Período</label><input type="month" value={edit.periodo || ''} onChange={e => setEdit(s => ({ ...s, periodo: e.target.value }))} /></div>
              <div><label>Debió facturarse el</label><input type="date" value={edit.deber || ''} onChange={e => setEdit(s => ({ ...s, deber: e.target.value }))} /></div>
              <div><label>Importe</label><input type="number" value={String(edit.importe ?? '')} onChange={e => setEdit(s => ({ ...s, importe: Number(e.target.value) }))} /></div>
              <div><label>Moneda</label><select value={edit.moneda} onChange={e => setEdit(s => ({ ...s, moneda: e.target.value as Pendiente['moneda'] }))}><option>ARS</option><option>USD</option><option>EUR</option></select></div>
              <div className="full"><label>Concepto</label><input value={edit.concepto || ''} onChange={e => setEdit(s => ({ ...s, concepto: e.target.value }))} /></div>
            </div>
            <div className="edit-actions">
              <button className="btn-cancel" onClick={() => setEditId(null)}>Cancelar</button>
              <button className="btn-save" onClick={() => guardarEdicion(r.id)}>Guardar cambios</button>
            </div>
          </div>
        )}

        {!modoAdmin ? (
          <div className="admin-note">Solo el administrador puede editar, eliminar o aprobar un pendiente.</div>
        ) : editId === r.id ? null : (
          <>
            <div className="approve-box" onClick={e => e.stopPropagation()}>
              <div className="ab-title">Marcar como facturado / aprobado</div>
              <div className="approve-grid">
                <div><label>Fecha</label><input type="date" value={openRow === r.id ? aprob.fecha : ''} onChange={e => setAprob(s => ({ ...s, fecha: e.target.value }))} /></div>
                <div><label>Vía</label><select value={aprob.via} onChange={e => setAprob(s => ({ ...s, via: e.target.value }))}><option>Mail del cliente</option><option>Teams</option><option>Llamada</option><option>Otro</option></select></div>
                <div><label>Comentario</label><input value={openRow === r.id ? aprob.com : ''} onChange={e => setAprob(s => ({ ...s, com: e.target.value }))} placeholder="Ej: llegó OC, se factura hoy" /></div>
                <button onClick={() => aprobar(r)}>Confirmar</button>
              </div>
            </div>
            <div className="admin-actions" onClick={e => e.stopPropagation()}>
              <button onClick={() => empezarEdicion(r)}>Editar</button>
              <button className="btn-del" onClick={() => borrar(r)}>Eliminar pendiente</button>
            </div>
          </>
        )}
      </td>
    </tr>
  )

  const cajaEntidad = (k: Entidad) => {
    const items = base.filter(r => r.entidad === k)
    if (!items.length) return null
    const meta = ENTIDADES[k]
    const sorted = sortItems(items)
    const totales: Record<string, number> = {}
    items.forEach(r => { totales[r.moneda] = (totales[r.moneda] || 0) + r.importe })
    return (
      <div className="ebox" key={k}>
        <div className="ebox-head">
          <img src={flagUrl(meta.flag)} width={16} height={12} alt="" />
          <span className="en">{meta.label}</span>
          <span className="ec">{items.length} pendiente{items.length === 1 ? '' : 's'}</span>
        </div>
        <table>
          <thead><tr>
            {th('cliente', 'Cliente', { width: '19%' })}
            {th('motivo', 'Motivo', { width: '33%' })}
            {th('importe', 'Importe', { width: '14%', textAlign: 'right' })}
            {th('resp', 'Ejecutivo', { width: '19%' })}
            {th('dias', 'Pendiente hace', { width: '15%', textAlign: 'center' })}
          </tr></thead>
          <tbody>
            {sorted.map(r => {
              const st = execColor(r.resp)
              const isOpen = openRow === r.id
              return (
                <Fragment key={r.id}>
                  <tr className={`data-row ${isOpen ? 'open' : ''}`} onClick={() => toggleRow(r.id)}>
                    <td><div className="client-name"><span className="chev">▸</span>{r.cliente}</div></td>
                    <td>
                      <div className="motivo-chip">{r.motivo}</div>
                      {r.periodo && <div className="periodo-chip">{fmtPeriodo(r.periodo)}</div>}
                      <div className="concepto-txt">{r.concepto}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}><span className="monto">{fmtMoneda(r.moneda, r.importe)}</span></td>
                    <td><span className="exec-tag" style={{ background: st.bg, color: st.color }}><span className="exec-dot" style={{ background: st.color }} />{r.resp}</span></td>
                    <td style={{ textAlign: 'center' }}><span className="pend-badge">{r.dias} día{r.dias === 1 ? '' : 's'}</span></td>
                  </tr>
                  {isOpen && filaDetalle(r)}
                </Fragment>
              )
            })}
          </tbody>
          <tfoot><tr><td colSpan={5}>
            {Object.entries(totales).map(([c, v]) => <span key={c} style={{ marginRight: 18 }}>Total {c}: <span className="monto">{fmtMoneda(c, v)}</span></span>)}
          </td></tr></tfoot>
        </table>
      </div>
    )
  }

  const renderTags = () => {
    if (vista !== 'todos') return null
    return (
      <div className="entity-tags">
        {ORDEN_ENT.map(k => {
          const meta = ENTIDADES[k]
          const items = activos.filter(r => r.entidad === k)
          const sums = MONEDAS_ENT[k].map(c => [c, items.filter(r => r.moneda === c).reduce((a, r) => a + r.importe, 0)] as const).filter(([, v]) => v > 0)
          return (
            <div className="etag" key={k}>
              <div className="et-head"><img src={flagUrl(meta.flag)} width={16} height={12} alt="" /> {meta.label}</div>
              {!sums.length
                ? <div className="et-empty">Sin pendientes de facturación</div>
                : sums.map(([c, v], i) => i === 0
                  ? <div className="et-amount" key={c}>{fmtMoneda(c, v)}</div>
                  : <div className="et-sub" key={c}>+ {fmtMoneda(c, v)}</div>)}
            </div>
          )
        })}
      </div>
    )
  }

  const renderHistorico = () => {
    if (!historico.length) return <div className="empty">Todavía no se aprobó ningún pendiente.</div>
    const sorted = [...historico].sort((a, b) => (b.dias_al_aprobar || 0) - (a.dias_al_aprobar || 0))
    return (
      <div className="ebox">
        <div className="ebox-head"><span className="en">Histórico de aprobados</span><span className="ec">{historico.length} resueltos</span></div>
        <table>
          <thead><tr>
            <th style={{ width: '18%' }}>Cliente</th><th style={{ width: '30%' }}>Motivo</th>
            <th style={{ width: '13%', textAlign: 'right' }}>Importe</th><th style={{ width: '17%' }}>Ejecutivo</th>
            <th style={{ width: '12%' }}>Resolución</th><th style={{ width: '10%', textAlign: 'center' }}>Acción</th>
          </tr></thead>
          <tbody>
            {sorted.map(r => {
              const st = execColor(r.resp)
              const isOpen = openHist === r.id
              return (
                <Fragment key={r.id}>
                  <tr className={`data-row ${isOpen ? 'open' : ''}`} onClick={() => setOpenHist(o => o === r.id ? null : r.id)}>
                    <td><div className="client-name"><span className="chev">▸</span>{r.cliente}</div></td>
                    <td><div className="motivo-chip">{r.motivo}</div>{r.periodo && <div className="periodo-chip">{fmtPeriodo(r.periodo)}</div>}<div className="concepto-txt">{r.concepto}</div></td>
                    <td style={{ textAlign: 'right' }}><span className="monto">{fmtMoneda(r.moneda, r.importe)}</span></td>
                    <td><span className="exec-tag" style={{ background: st.bg, color: st.color }}><span className="exec-dot" style={{ background: st.color }} />{r.resp}</span></td>
                    <td style={{ fontSize: 12 }}>Aprobado {r.aprobado_el}</td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {modoAdmin && (
                        <>
                          <button className="repeat-btn" onClick={e => { e.stopPropagation(); repetir(r) }}>Repetir</button>
                          <button className="undo-btn" onClick={e => { e.stopPropagation(); deshacerAprobacion(r) }}>Deshacer</button>
                        </>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="detail-row">
                      <td colSpan={6}>
                        <div className="deber-line">
                          {r.periodo ? <>Período <b>{fmtPeriodo(r.periodo)}</b> — </> : null}
                          Debió facturarse el <b>{fmtDate(r.deber)}</b> — estuvo pendiente {r.dias_al_aprobar} días antes de resolverse.
                        </div>
                        <div className="hist-title">Seguimiento completo</div>
                        {r.hist.map((h, i) => <div key={i} className="hist-line"><b>{h.f}</b> — {h.t}</div>)}
                        <div className="hist-final">Aprobado el {r.aprobado_el} vía {r.via}. {r.comentario}</div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const renderResumen = () => {
    const toolbar = (
      <div className="resumen-toolbar">
        <span className="resumen-sub">
          {historico.length
            ? `Días transcurridos desde "debió facturarse" hasta la aprobación — ${historico.length} casos resueltos, ordenado de mayor a menor demora promedio.`
            : ''}
        </span>
        <button className="export-btn" onClick={exportarCSV}>⬇ Exportar a Excel</button>
      </div>
    )
    if (!historico.length) {
      return <>{toolbar}<div className="empty">Todavía no hay pendientes aprobados — este resumen se arma solo a medida que vayas cerrando casos en el histórico.</div></>
    }
    const porCliente: Record<string, { entidad: Entidad; dias: number[]; motivos: string[] }> = {}
    historico.forEach(r => {
      porCliente[r.cliente] = porCliente[r.cliente] || { entidad: r.entidad, dias: [], motivos: [] }
      porCliente[r.cliente].dias.push(r.dias_al_aprobar || 0)
      porCliente[r.cliente].motivos.push(r.motivo)
    })
    const filas = Object.entries(porCliente).map(([cliente, g]) => {
      const avg = Math.round(g.dias.reduce((a, b) => a + b, 0) / g.dias.length)
      const conteo: Record<string, number> = {}
      g.motivos.forEach(m => { conteo[m] = (conteo[m] || 0) + 1 })
      const motivo = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0][0]
      return { cliente, entidad: g.entidad, casos: g.dias.length, avg, min: Math.min(...g.dias), max: Math.max(...g.dias), motivo }
    }).sort((a, b) => b.avg - a.avg)
    const avgClase = (v: number) => v <= 10 ? 'avg-low' : v <= 25 ? 'avg-mid' : 'avg-high'
    return (
      <>
        {toolbar}
        <div className="ebox">
          <table>
            <thead><tr>
              <th style={{ width: '22%' }}>Cliente</th><th style={{ width: '24%' }}>Entidad</th>
              <th style={{ width: '10%', textAlign: 'center' }}>Casos</th>
              <th style={{ width: '16%', textAlign: 'center' }}>Demora promedio</th>
              <th style={{ width: '14%', textAlign: 'center' }}>Mín – Máx</th>
              <th style={{ width: '14%' }}>Motivo más frecuente</th>
            </tr></thead>
            <tbody>
              {filas.map(r => (
                <tr key={r.cliente} className="data-row" style={{ cursor: 'default' }}>
                  <td><div className="client-name">{r.cliente}</div></td>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><img src={flagUrl(ENTIDADES[r.entidad].flag)} width={16} height={12} alt="" /> {ENTIDADES[r.entidad].label}</span></td>
                  <td style={{ textAlign: 'center' }}>{r.casos}</td>
                  <td style={{ textAlign: 'center' }}><span className={`avg-badge ${avgClase(r.avg)}`}>{r.avg} días</span></td>
                  <td style={{ textAlign: 'center' }}><span className="minmax-txt">{r.min}d – {r.max}d</span></td>
                  <td><div className="motivo-chip">{r.motivo}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  const renderContenido = () => {
    if (loading) return <div className="empty">Cargando pendientes…</div>
    if (error) return <div className="empty" style={{ color: '#b91c1c' }}>Error: {error}</div>
    if (vista === 'historico') return renderHistorico()
    if (vista === 'resumen') return renderResumen()
    if (!base.length) return <div className="empty">{q ? 'No hay pendientes que coincidan con la búsqueda.' : 'No hay pendientes registrados.'}</div>
    return <>{ORDEN_ENT.map(cajaEntidad)}</>
  }

  const navItem = (v: Vista, label: React.ReactNode, n?: number, flag?: string) => (
    <div className={`nav-item ${vista === v ? 'active' : ''}`} onClick={() => cambiarVista(v)}>
      {flag && <img src={flagUrl(flag)} width={16} height={12} alt="" />}
      <span className="nlabel">{label}</span>
      {n !== undefined && badge(n)}
    </div>
  )

  return (
    <div className="pfc">
      <style>{CSS}</style>
      <datalist id="pfc-clientes">{clientesConocidos.map(c => <option key={c} value={c} />)}</datalist>
      <datalist id="pfc-ejecutivos">{ejecutivosConocidos.map(e => <option key={e} value={e} />)}</datalist>

      <div className="shell">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-mark">
              <div className="logo-icon">
                <svg viewBox="0 0 20 20" fill="none" width={17} height={17}><path d="M10 3v14M4 10h12" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" /></svg>
              </div>
              <span className="logo-name">Pendientes de Facturación</span>
            </div>
            <div className="logo-sub">ASAP Consulting</div>
          </div>

          <div className="sidebar-nav">
            {navItem('todos', 'Todos los pendientes', activos.length)}
            <div className="nav-divider" />
            {navItem('sa', 'ASAP Consulting SA', activos.filter(r => r.entidad === 'sa').length, 'ar')}
            {navItem('llc', 'ASAP Consulting LLC', activos.filter(r => r.entidad === 'llc').length, 'us')}
            {navItem('sl', 'IT ASAP Solutions SL', activos.filter(r => r.entidad === 'sl').length, 'es')}
            <div className="nav-divider" />
            {navItem('historico', 'Histórico de aprobados')}
            {navItem('resumen', 'Resumen de demoras')}
          </div>

          <div className="sidebar-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="status-dot" />Actualizado: {fmtFechaLarga(hoy)}</div>
            <div className="side-link" onClick={onCambiarModulo}>← Cambiar de app</div>
            <div className="side-link" onClick={() => supabase.auth.signOut()}>Salir</div>
          </div>
        </aside>

        <header className="topbar">
          <span className="topbar-title">{titulo}</span>
          <div className="topbar-spacer" />
          <div className="search-wrap">
            <svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth={1.3} /><path d="M11 11l2.5 2.5" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" /></svg>
            <input className="search-input" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar cliente o concepto..." />
          </div>
          <button className={`admin-btn ${modoAdmin ? 'on' : ''}`} onClick={() => { setModoAdmin(v => !v); setEditId(null) }}>
            Modo administrador: {modoAdmin ? 'ON' : 'OFF'}
          </button>
          <button className="topbar-btn" onClick={abrirModal}>
            <svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" /></svg>
            Nuevo pendiente
          </button>
        </header>

        <main className="main">
          {renderTags()}
          {renderContenido()}
        </main>
      </div>

      {modalOpen && (
        <div className="modal-bg" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Registrar nuevo pendiente</h3>
            <div className="mhint">Cargá lo que falta para poder facturar. Esto lo completás vos o tu equipo — el sistema no lo detecta solo.</div>
            {repeatHint && <div className="repeat-hint">{repeatHint}</div>}
            <div className="row2">
              <div className="field">
                <label>Entidad</label>
                <select value={form.entidad} onChange={e => setForm(f => ({ ...f, entidad: e.target.value as Entidad }))}>
                  <option value="sa">ASAP Consulting SA</option>
                  <option value="sl">IT ASAP Solutions SL</option>
                  <option value="llc">ASAP Consulting LLC</option>
                </select>
              </div>
              <div className="field">
                <label>Cliente</label>
                <input list="pfc-clientes" value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} placeholder="Elegí uno existente o escribí uno nuevo…" autoComplete="off" />
              </div>
            </div>
            <div className="field">
              <label>Motivo</label>
              <select value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}>{MOTIVOS.map(m => <option key={m}>{m}</option>)}</select>
            </div>
            <div className="field">
              <label>Concepto</label>
              <input value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} placeholder="Ej: Faltan HES servicios de julio" />
            </div>
            <div className="row2">
              <div className="field"><label>Importe estimado</label><input type="number" value={form.importe} onChange={e => setForm(f => ({ ...f, importe: e.target.value }))} placeholder="0,00" /></div>
              <div className="field"><label>Moneda</label><select value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}><option>ARS</option><option>USD</option><option>EUR</option></select></div>
            </div>
            <div className="row2">
              <div className="field"><label>Período</label><input type="month" value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} /></div>
              <div className="field"><label>Debió facturarse el</label><input type="date" value={form.deber} onChange={e => setForm(f => ({ ...f, deber: e.target.value }))} /></div>
            </div>
            <div className="field">
              <label>Ejecutivo responsable</label>
              <input list="pfc-ejecutivos" value={form.resp} onChange={e => setForm(f => ({ ...f, resp: e.target.value }))} placeholder="Elegí uno existente o escribí uno nuevo…" autoComplete="off" />
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarNuevo}>Guardar pendiente</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
