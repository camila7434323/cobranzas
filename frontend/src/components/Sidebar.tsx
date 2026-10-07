import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { OPCIONES, type Modulo } from './modulos'

// Menú lateral compartido por las 3 apps (Cobranzas, Facturación, Pendientes).
// Mismo color, tipografía y estados en todas; solo cambia el ícono de la app.

const CSS = `
.asb { width:260px; flex-shrink:0; height:100vh; position:sticky; top:0; overflow:hidden; transition:width .25s ease;
  background:linear-gradient(180deg,#0e2549 0%,#091a35 50%,#06122a 100%); color:#fff;
  font-family:'Inter',system-ui,sans-serif; box-shadow:4px 0 24px rgba(5,16,31,.35); }
.asb.colapsado { width:0; }
.asb *, .asb *::before, .asb *::after { box-sizing:border-box; }
.asb-inner { width:260px; height:100%; display:flex; flex-direction:column; }

.asb-head { padding:20px 16px 16px; display:flex; align-items:center; gap:12px; }
.asb-tile { width:38px; height:38px; border-radius:11px; display:grid; place-items:center; flex-shrink:0;
  font-size:17px; font-weight:800; color:#fff; box-shadow:0 6px 16px -4px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.25); }
.asb-titulo { font-size:15px; font-weight:700; letter-spacing:-.2px; line-height:1.2; }
.asb-sub { font-size:10px; font-weight:600; letter-spacing:1.4px; text-transform:uppercase; color:rgba(255,255,255,.38); margin-top:3px; }
.asb-colapsar { margin-left:auto; width:30px; height:30px; flex-shrink:0; display:grid; place-items:center; cursor:pointer;
  border-radius:8px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.05); color:rgba(255,255,255,.55); transition:all .15s; }
.asb-colapsar:hover { background:rgba(255,255,255,.12); color:#fff; }

.asb-user { margin:0 12px 6px; padding:10px; border-radius:12px; display:flex; align-items:center; gap:10px;
  background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.06); }
.asb-avatar { width:32px; height:32px; border-radius:50%; flex-shrink:0; display:grid; place-items:center;
  font-size:11px; font-weight:700; color:#fff; background:linear-gradient(135deg,#5b8def,#3b5fc4); box-shadow:0 0 0 2px rgba(255,255,255,.12); }
.asb-user-nombre { font-size:12.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.asb-user-estado { font-size:10.5px; color:rgba(255,255,255,.45); display:flex; align-items:center; gap:5px; margin-top:1px; }
.asb-dot { width:6px; height:6px; border-radius:50%; background:#34d399; box-shadow:0 0 6px #34d399; flex-shrink:0; }

.asb-nav { flex:1; min-height:0; overflow-y:auto; padding:4px 10px 12px; scrollbar-width:none; }
.asb-nav::-webkit-scrollbar { display:none; }
.asb-seccion { font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:rgba(255,255,255,.32); padding:14px 10px 6px; }
.asb-divider { height:1px; background:rgba(255,255,255,.07); margin:10px 6px; }

.asb-item { position:relative; display:flex; align-items:center; gap:10px; width:100%; padding:8px 10px; margin-bottom:2px;
  border:none; border-radius:9px; background:transparent; color:rgba(255,255,255,.62); font:inherit; font-size:13px; font-weight:500;
  text-align:left; cursor:pointer; transition:background .15s, color .15s; }
.asb-item:hover { background:rgba(255,255,255,.06); color:#fff; }
.asb-item.activo { background:linear-gradient(90deg,rgba(91,141,239,.30),rgba(91,141,239,.10)); color:#fff; font-weight:600;
  box-shadow:inset 0 0 0 1px rgba(124,163,245,.22); }
.asb-item.activo::before { content:''; position:absolute; left:-10px; top:7px; bottom:7px; width:3px; border-radius:0 3px 3px 0;
  background:#7ca3f5; box-shadow:0 0 10px #5b8def; }
.asb-item.compacto { padding:6px 10px; font-size:12.5px; }
.asb-item.grupo { color:rgba(255,255,255,.85); font-weight:600; }
.asb-item.grupo.abierto { background:rgba(255,255,255,.05); }
.asb-icono { min-width:18px; min-height:18px; display:grid; place-items:center; flex-shrink:0; opacity:.8; }
.asb-item:hover .asb-icono, .asb-item.activo .asb-icono { opacity:1; }
.asb-item.activo .asb-icono { color:#a9c4ff; }
.asb-label { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.asb-chevron { flex-shrink:0; opacity:.5; transition:transform .2s; }
.asb-item.abierto .asb-chevron { transform:rotate(90deg); }
.asb-subitems { margin:2px 0 8px 18px; padding-left:10px; border-left:1px solid rgba(255,255,255,.09); }
.asb-badge { flex-shrink:0; font-size:10px; font-weight:700; padding:2px 7px; border-radius:20px; }
.asb-badge.red   { background:rgba(239,68,68,.22);  color:#fca5a5; }
.asb-badge.green { background:rgba(16,185,129,.2);  color:#6ee7b7; }
.asb-badge.blue  { background:rgba(91,141,239,.25); color:#b8cdff; }
.asb-badge.gray  { background:rgba(255,255,255,.08); color:rgba(255,255,255,.5); }

.asb-foot { padding:12px 14px 14px; border-top:1px solid rgba(255,255,255,.07); background:rgba(0,0,0,.14); display:flex; flex-direction:column; gap:10px; }
.asb-status { font-size:11px; color:rgba(255,255,255,.4); display:flex; align-items:center; gap:7px; }
.asb-acciones { display:flex; gap:6px; }
.asb-btn { display:flex; align-items:center; justify-content:center; gap:7px; padding:9px 12px; border-radius:8px; cursor:pointer;
  font:inherit; font-size:12px; font-weight:600; white-space:nowrap; transition:background .15s, border-color .15s, color .15s;
  background:transparent; border:1px solid rgba(255,255,255,.16); color:rgba(255,255,255,.55); }
.asb-btn.principal { flex:1; background:rgba(255,255,255,.09); color:rgba(255,255,255,.9); }
.asb-btn:hover { background:rgba(255,255,255,.16); border-color:rgba(255,255,255,.3); color:#fff; }
`

export function Sidebar({ colapsado, style, children }: { colapsado?: boolean; style?: React.CSSProperties; children: ReactNode }) {
  return (
    <aside className={`asb${colapsado ? ' colapsado' : ''}`} style={style}>
      <style>{CSS}</style>
      <div className="asb-inner">{children}</div>
    </aside>
  )
}

export function SidebarHeader({ app, onColapsar }: { app: Modulo; onColapsar?: () => void }) {
  const o = OPCIONES.find(x => x.key === app)!
  return (
    <div className="asb-head">
      <div className="asb-tile" style={{ background: `linear-gradient(135deg, ${o.color}, color-mix(in srgb, ${o.color} 60%, #000))` }}>{o.inicial}</div>
      <div style={{ minWidth: 0 }}>
        <div className="asb-titulo">{o.nombre}</div>
        <div className="asb-sub">ASAP Consulting</div>
      </div>
      {onColapsar && (
        <button className="asb-colapsar" onClick={onColapsar} title="Ocultar menú">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
    </div>
  )
}

export function SidebarUser({ nombre, estado = 'Activo' }: { nombre: string; estado?: string }) {
  const palabras = nombre.trim().split(/\s+/)
  const iniciales = (palabras.length > 1 ? palabras[0][0] + palabras[palabras.length - 1][0] : nombre.slice(0, 2)).toUpperCase()
  return (
    <div className="asb-user">
      <div className="asb-avatar">{iniciales}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="asb-user-nombre">{nombre}</div>
        <div className="asb-user-estado"><span className="asb-dot" />{estado}</div>
      </div>
    </div>
  )
}

export function SidebarNav({ children }: { children: ReactNode }) {
  return <nav className="asb-nav">{children}</nav>
}

export function SidebarSeccion({ children }: { children: ReactNode }) {
  return <div className="asb-seccion">{children}</div>
}

export function SidebarDivider() {
  return <div className="asb-divider" />
}

export type BadgeTono = 'red' | 'green' | 'blue' | 'gray'

export function SidebarItem({ label, icono, activo, onClick, badge, badgeTono = 'gray', extra, compacto, title }: {
  label: ReactNode; icono?: ReactNode; activo?: boolean; onClick: () => void
  badge?: number; badgeTono?: BadgeTono; extra?: ReactNode; compacto?: boolean; title?: string
}) {
  return (
    <button className={`asb-item${activo ? ' activo' : ''}${compacto ? ' compacto' : ''}`} onClick={onClick} title={title}>
      {icono && <span className="asb-icono">{icono}</span>}
      <span className="asb-label">{label}</span>
      {extra}
      {badge !== undefined && <span className={`asb-badge ${badgeTono}`}>{badge}</span>}
    </button>
  )
}

// Ítem desplegable (ej. una sociedad con sus vistas adentro).
export function SidebarGrupo({ label, icono, abierto, onClick, children }: {
  label: ReactNode; icono?: ReactNode; abierto: boolean; onClick: () => void; children?: ReactNode
}) {
  return (
    <div>
      <button className={`asb-item grupo${abierto ? ' abierto' : ''}`} onClick={onClick}>
        {icono && <span className="asb-icono">{icono}</span>}
        <span className="asb-label">{label}</span>
        <svg className="asb-chevron" width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {abierto && <div className="asb-subitems">{children}</div>}
    </div>
  )
}

export function SidebarFooter({ onCambiarModulo, status, children }: { onCambiarModulo: () => void; status?: ReactNode; children?: ReactNode }) {
  return (
    <div className="asb-foot">
      {children}
      {status && <div className="asb-status"><span className="asb-dot" />{status}</div>}
      <div className="asb-acciones">
        <button className="asb-btn principal" onClick={onCambiarModulo} title="Volver al selector de apps">
          <Icono nombre="apps" size={14} />
          <span>Cambiar de app</span>
        </button>
        <button className="asb-btn" onClick={() => supabase.auth.signOut()} title="Cerrar sesión">
          <Icono nombre="salir" size={13} />
          <span>Salir</span>
        </button>
      </div>
    </div>
  )
}

export function Bandera({ code }: { code: string }) {
  return <span className={`fi fi-${code}`} style={{ borderRadius: 2, width: 16, lineHeight: '12px' }} />
}

const PATHS: Record<string, ReactNode> = {
  apps: <><rect x="1.5" y="1.5" width="5" height="5" rx="1.2" /><rect x="9.5" y="1.5" width="5" height="5" rx="1.2" /><rect x="1.5" y="9.5" width="5" height="5" rx="1.2" /><rect x="9.5" y="9.5" width="5" height="5" rx="1.2" /></>,
  salir: <path d="M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6M10.5 11l3-3-3-3M13.5 8H6" />,
  capas: <><path d="M8 1.5 14.5 5 8 8.5 1.5 5 8 1.5Z" /><path d="M1.5 8 8 11.5 14.5 8M1.5 11 8 14.5 14.5 11" /></>,
  dashboard: <><rect x="1.5" y="1.5" width="5.5" height="7" rx="1.2" /><rect x="9" y="1.5" width="5.5" height="4" rx="1.2" /><rect x="9" y="7.5" width="5.5" height="7" rx="1.2" /><rect x="1.5" y="10.5" width="5.5" height="4" rx="1.2" /></>,
  lista: <path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" />,
  mas: <path d="M8 3v10M3 8h10" />,
  reloj: <><circle cx="8" cy="8" r="6.2" /><path d="M8 4.5V8l2.5 1.5" /></>,
  clientes: <><circle cx="6" cy="5.5" r="2.5" /><path d="M1.5 14c0-2.5 2-4.2 4.5-4.2s4.5 1.7 4.5 4.2" /><path d="M11 3.2a2.4 2.4 0 0 1 0 4.6M12.5 9.9c1.3.6 2 1.9 2 4.1" /></>,
  chart: <path d="M2 14h12M4 11V7M7.3 11V3.5M10.6 11V6M13.5 11V8.5" />,
  check: <><circle cx="8" cy="8" r="6.2" /><path d="m5.3 8.2 1.9 1.9 3.6-3.8" /></>,
  demora: <path d="M4 1.5h8M4 14.5h8M5 1.5v2.8L8 7.5l3-3.2V1.5M5 14.5v-2.8L8 8.5l3 3.2v2.8" />,
  edificio: <path d="M2.5 14.5h11M3.5 14.5V2.5h6v12M9.5 6.5h3v8M5.5 5h2M5.5 8h2M5.5 11h2" />,
  candado: <><rect x="3" y="7" width="10" height="7.5" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></>,
}

export function Icono({ nombre, size = 15 }: { nombre: keyof typeof PATHS; size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[nombre]}
    </svg>
  )
}
