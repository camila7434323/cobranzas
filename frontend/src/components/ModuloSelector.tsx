import { supabase } from '../lib/supabase'
import { OPCIONES, type Modulo } from './modulos'
import { LogoAsap, NAVY } from './Marca'

// Mismo esquema que el inicio de WiSoft: panel celeste a la izquierda y "Secciones Disponibles" a la derecha.
const CSS = `
.msel { flex:1; min-height:100vh; display:flex; font-family:'Poppins',system-ui,sans-serif; color:#1f2a44; background:#fff; }
.msel-lat { width:260px; flex-shrink:0; background:#b9dcf0; display:flex; flex-direction:column; }
.msel-lat-top { background:#45a3d6; padding:12px 12px 10px; color:#fff; }
.msel-user { display:flex; align-items:center; gap:8px; font-size:13px; margin-bottom:12px; min-width:0; }
.msel-user span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.msel-avatar { width:24px; height:24px; border-radius:50%; background:#fff; color:#45a3d6; display:grid; place-items:center; flex-shrink:0; }
.msel-btn { width:100%; padding:7px 10px; border:none; border-radius:2px; background:#1a8fd0; color:#fff; font:inherit; font-size:12px; font-weight:500; cursor:pointer; }
.msel-btn:hover { background:#1477b0; }
.msel-grupos { padding:14px 12px; flex:1; }
.msel-grupos h3 { font-size:13px; font-weight:600; margin:0 0 10px; color:#1f2a44; }
.msel-lista { background:#fff; border-radius:4px; padding:10px 8px; }
.msel-item { display:flex; align-items:center; gap:12px; width:100%; padding:16px 10px; border:none; border-radius:4px; background:transparent;
  font:inherit; font-size:12.5px; color:#1f2a44; cursor:default; text-align:left; }
.msel-item.activo { background:#e8e8e8; }
.msel-main { flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; padding:24px 24px 40px; background:#f4f8fd; }
.msel-panel { width:100%; max-width:1100px; background:#fff; border-radius:4px; padding:26px 22px; margin-top:28px; box-shadow:0 1px 3px rgba(31,42,68,.08); min-height:60vh; }
.msel-panel h2 { font-size:15px; font-weight:600; margin:0 0 10px; color:#1f2a44; }
.msel-grid { display:flex; flex-wrap:wrap; gap:14px; }
.msel-card { width:250px; height:118px; border:none; border-radius:3px; background:#45a3d6; color:#fff; font:inherit; cursor:pointer;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:12px; text-align:center;
  box-shadow:0 1px 3px rgba(31,42,68,.15); transition:background .15s, transform .15s, box-shadow .15s; }
.msel-card:hover, .msel-card:focus-visible { background:#1a8fd0; transform:translateY(-2px); box-shadow:0 6px 14px rgba(26,143,208,.3); outline:none; }
.msel-card-nombre { font-size:13px; font-weight:500; }
.msel-card-desc { font-size:11px; opacity:.85; line-height:1.35; max-width:210px; }
@media (max-width: 800px) {
  .msel { flex-direction:column; }
  .msel-lat { width:100%; }
  .msel-grupos { display:none; }
  .msel-card { width:100%; }
}
`

const ICONOS: Record<Modulo, React.ReactNode> = {
  cobranzas: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M6 10h.01M6 14h.01M10 10h8M10 14h8" /></>,
  facturacion: <><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6M9 13h8M9 17h5" /></>,
  pendientes: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
}

export function ModuloSelector({ onSelect, email }: { onSelect: (modulo: Modulo) => void; email?: string }) {
  return (
    <div className="msel">
      <style>{CSS}</style>

      <aside className="msel-lat">
        <div className="msel-lat-top">
          <div style={{ marginBottom: 12 }}><LogoAsap alto={26} /></div>
          {email && (<>
            <div className="msel-user">
              <span className="msel-avatar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4.5" /><path d="M3 21c0-5 4-8 9-8s9 3 9 8Z" /></svg>
              </span>
              <span>{email}</span>
            </div>
            <button className="msel-btn" onClick={() => supabase.auth.signOut()}>Cerrar Sesión</button>
          </>)}
        </div>
        <div className="msel-grupos">
          <h3>Grupos Disponibles</h3>
          <div className="msel-lista">
            <div className="msel-item activo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
              Finanzas
            </div>
          </div>
        </div>
      </aside>

      <main className="msel-main">
        <LogoAsap alto={60} color={NAVY} />
        <section className="msel-panel">
          <h2>Secciones Disponibles</h2>
          <div className="msel-grid">
            {OPCIONES.map(o => (
              <button key={o.key} className="msel-card" onClick={() => onSelect(o.key)} title={o.desc}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONOS[o.key]}</svg>
                <span className="msel-card-nombre">{o.nombre}</span>
                <span className="msel-card-desc">{o.desc}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
