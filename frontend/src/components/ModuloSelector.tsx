import { OPCIONES, type Modulo } from './modulos'

const CSS = `
.msel { flex:1; min-height:100vh; position:relative; overflow:hidden; display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:48px 16px; font-family:'Inter',system-ui,sans-serif; color:#fff;
  background:
    radial-gradient(900px 500px at 15% 10%, rgba(37,84,160,.45), transparent 60%),
    radial-gradient(700px 500px at 90% 90%, rgba(79,70,229,.30), transparent 60%),
    radial-gradient(600px 400px at 70% 20%, rgba(14,116,144,.25), transparent 60%),
    linear-gradient(180deg,#0e2549 0%,#091a35 55%,#06122a 100%); }
.msel::before { content:''; position:absolute; inset:0; pointer-events:none; opacity:.5;
  background-image:linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
  background-size:44px 44px; mask-image:radial-gradient(ellipse at center, #000 30%, transparent 75%); }
.msel-head { position:relative; text-align:center; margin-bottom:44px; animation:msel-in .5s ease both; }
.msel-logo { height:52px; max-width:220px; object-fit:contain; display:block; margin:0 auto 22px; }
.msel-marca { display:none; font-size:15px; font-weight:800; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,.7); margin-bottom:18px; }
.msel-titulo { font-size:30px; font-weight:800; letter-spacing:-.6px; margin:0; }
.msel-bajada { font-size:14.5px; color:rgba(255,255,255,.55); margin-top:8px; }
.msel-grid { position:relative; display:grid; grid-template-columns:repeat(3, 280px); gap:20px; }
@media (max-width: 940px) { .msel-grid { grid-template-columns:minmax(0, 420px); width:100%; justify-content:center; } }
.msel-card { position:relative; text-align:left; cursor:pointer; font:inherit; color:inherit; display:flex; flex-direction:column;
  padding:26px 24px 22px; border-radius:18px; min-height:230px;
  background:linear-gradient(180deg, rgba(255,255,255,.075), rgba(255,255,255,.03));
  border:1px solid rgba(255,255,255,.1); backdrop-filter:blur(8px);
  box-shadow:0 20px 40px -20px rgba(0,0,0,.6);
  transition:transform .2s ease, border-color .2s ease, box-shadow .2s ease, background .2s ease;
  animation:msel-in .5s ease both; }
.msel-card::after { content:''; position:absolute; inset:0; border-radius:inherit; pointer-events:none; opacity:0; transition:opacity .2s;
  background:radial-gradient(400px 200px at 0% 0%, var(--c-glow), transparent 70%); }
.msel-card:hover, .msel-card:focus-visible { transform:translateY(-4px); border-color:var(--c-borde);
  box-shadow:0 28px 50px -20px rgba(0,0,0,.7), 0 0 0 1px var(--c-borde); outline:none; }
.msel-card:hover::after, .msel-card:focus-visible::after { opacity:1; }
.msel-tile { width:50px; height:50px; border-radius:14px; display:grid; place-items:center; font-size:21px; font-weight:800; color:#fff; margin-bottom:20px;
  box-shadow:0 10px 24px -8px var(--c-glow), inset 0 1px 0 rgba(255,255,255,.25); }
.msel-nombre { font-size:17px; font-weight:700; letter-spacing:-.2px; margin-bottom:8px; }
.msel-desc { font-size:13px; line-height:1.55; color:rgba(255,255,255,.55); flex:1; }
.msel-entrar { margin-top:18px; display:flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.45); transition:color .2s; }
.msel-entrar svg { transition:transform .2s; }
.msel-card:hover .msel-entrar, .msel-card:focus-visible .msel-entrar { color:#fff; }
.msel-card:hover .msel-entrar svg, .msel-card:focus-visible .msel-entrar svg { transform:translateX(4px); }
.msel-pie { position:relative; margin-top:48px; font-size:11.5px; color:rgba(255,255,255,.3); letter-spacing:.3px; }
@keyframes msel-in { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce) { .msel-card, .msel-head { animation:none; } .msel-card { transition:none; } }
`

export function ModuloSelector({ onSelect }: { onSelect: (modulo: Modulo) => void }) {
  return (
    <div className="msel">
      <style>{CSS}</style>

      <div className="msel-head">
        <img
          className="msel-logo"
          src="/asap-logo.png"
          alt="ASAP Consulting"
          onError={e => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextSibling as HTMLElement).style.display = 'block' }}
        />
        <div className="msel-marca">ASAP Consulting</div>
        <h1 className="msel-titulo">¿Con qué querés trabajar hoy?</h1>
        <div className="msel-bajada">Elegí una app para empezar. Podés cambiar en cualquier momento desde el menú.</div>
      </div>

      <div className="msel-grid">
        {OPCIONES.map((o, i) => (
          <button
            key={o.key}
            className="msel-card"
            onClick={() => onSelect(o.key)}
            style={{
              '--c-glow': `color-mix(in srgb, ${o.color} 55%, transparent)`,
              '--c-borde': `color-mix(in srgb, ${o.color} 70%, #fff 10%)`,
              animationDelay: `${0.08 + i * 0.07}s`,
            } as React.CSSProperties}
          >
            <div className="msel-tile" style={{ background: `linear-gradient(135deg, ${o.color}, color-mix(in srgb, ${o.color} 60%, #000))` }}>{o.inicial}</div>
            <div className="msel-nombre">{o.nombre}</div>
            <div className="msel-desc">{o.desc}</div>
            <div className="msel-entrar">
              Entrar
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </button>
        ))}
      </div>

      <div className="msel-pie">ASAP Consulting · Herramientas internas</div>
    </div>
  )
}
