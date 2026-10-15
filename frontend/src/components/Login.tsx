import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { OPCIONES, type Modulo } from './modulos'
import { LogoAsap, AZUL, NAVY } from './Marca'

const CSS = `
.wlog { flex:1; min-height:100vh; background:#f4f8fd; font-family:'Poppins',system-ui,sans-serif; color:#1f2a44;
  display:grid; grid-template-columns:1fr 1fr; align-items:start; padding:100px 6vw 80px; gap:40px; position:relative; }
.wlog-izq { display:flex; flex-direction:column; align-items:center; gap:36px; padding-top:120px; }
.wlog-card { justify-self:center; width:100%; max-width:500px; background:#edf1f6; border-radius:22px; padding:28px 44px 22px;
  box-shadow:0 2px 6px rgba(31,42,68,.12); }
.wlog-hola { font-size:15px; color:#555e70; }
.wlog-titulo { font-size:30px; font-weight:600; color:#2a2f3a; margin:6px 0 22px; }
.wlog-campo { position:relative; border:1px solid #c9d2de; border-radius:6px; margin-bottom:36px; padding:22px 44px 14px 12px; background:#edf1f6; }
.wlog-campo:focus-within { border-color:${AZUL}; }
.wlog-campo label { position:absolute; top:-9px; left:9px; padding:0 4px; background:#edf1f6; font-size:12.5px; color:#555e70; }
.wlog-campo:focus-within label { color:${AZUL}; }
.wlog-campo input { width:100%; border:none; outline:none; background:#e8f0fe; font:inherit; font-size:16px; color:#1f2a44; padding:4px 2px; }
.wlog-campo .ic { position:absolute; right:14px; top:50%; transform:translateY(-50%); color:#1f2a44; background:none; border:none; padding:0; cursor:pointer; display:grid; }
.wlog-btn { width:92%; padding:15px; border:none; border-radius:8px; background:${AZUL}; color:#fff; font:inherit; font-size:22px; font-weight:500;
  cursor:pointer; box-shadow:0 4px 10px rgba(26,143,208,.35); transition:background .15s; }
.wlog-btn:hover { background:#1477b0; }
.wlog-btn:disabled { background:#7fb9df; cursor:wait; }
.wlog-link { display:inline-block; margin-top:12px; font-size:16px; font-weight:500; color:${AZUL}; cursor:pointer; background:none; border:none; padding:0; font-family:inherit; }
.wlog-error { background:#fee2e2; color:#b91c1c; padding:10px 14px; border-radius:8px; font-size:13.5px; margin:-16px 0 22px; border:1px solid #fca5a5; }
.wlog-pie { position:absolute; left:16px; bottom:16px; font-size:15px; font-weight:600; color:#2a2f3a; line-height:1.6; }
@media (max-width: 900px) {
  .wlog { grid-template-columns:1fr; padding:32px 16px 90px; }
  .wlog-izq { padding-top:0; }
  .wlog-card { padding:24px 20px 18px; }
}
`

export function Login({ modulo = 'cobranzas', onVolver }: { modulo?: Modulo; onVolver?: () => void }) {
  const info = OPCIONES.find(o => o.key === modulo)!
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCargando(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Usuario o contraseña incorrectos.')
      setCargando(false)
    }
  }

  return (
    <div className="wlog">
      <style>{CSS}</style>

      <div className="wlog-izq">
        <div style={{ textAlign: 'center' }}>
          <LogoAsap alto={130} color={NAVY} />
          <div style={{ fontSize: 22, fontWeight: 500, fontStyle: 'italic', color: AZUL, marginTop: 10 }}>{info.nombre}</div>
        </div>
      </div>

      <form className="wlog-card" onSubmit={handleSubmit}>
        <div className="wlog-hola">Bienvenido de nuevo! 👋</div>
        <div className="wlog-titulo">Ingrese a su cuenta</div>

        <div className="wlog-campo">
          <label htmlFor="wlog-user">Usuario *</label>
          <input id="wlog-user" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
          <span className="ic">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm0 14a8 8 0 0 1-6.2-2.95C7 15.3 9.4 14.5 12 14.5s5 .8 6.2 2.55A8 8 0 0 1 12 20Z" /></svg>
          </span>
        </div>

        <div className="wlog-campo">
          <label htmlFor="wlog-pass">Contraseña *</label>
          <input id="wlog-pass" type={verPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          <button type="button" className="ic" onClick={() => setVerPassword(v => !v)} title={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
              {!verPassword && <path d="M3 3l18 18" />}
            </svg>
          </button>
        </div>

        {error && <div className="wlog-error">{error}</div>}

        <button type="submit" className="wlog-btn" disabled={cargando}>
          {cargando ? 'Ingresando...' : 'Iniciar Sesión'}
        </button>
        {onVolver && (
          <div><button type="button" className="wlog-link" onClick={onVolver}>← Cambiar de app</button></div>
        )}
      </form>

      <div className="wlog-pie">
        ASAP Consulting<br />{info.nombre}
      </div>
    </div>
  )
}
