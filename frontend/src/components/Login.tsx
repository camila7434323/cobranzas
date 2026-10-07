import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { OPCIONES, type Modulo } from './modulos'

// Mismo fondo que el selector de apps.
const FONDO = [
  'radial-gradient(900px 500px at 15% 10%, rgba(37,84,160,.45), transparent 60%)',
  'radial-gradient(700px 500px at 90% 90%, rgba(79,70,229,.30), transparent 60%)',
  'radial-gradient(600px 400px at 70% 20%, rgba(14,116,144,.25), transparent 60%)',
  'linear-gradient(180deg,#0e2549 0%,#091a35 55%,#06122a 100%)',
].join(', ')

export function Login({ modulo = 'cobranzas', onVolver }: { modulo?: Modulo; onVolver?: () => void }) {
  const info = OPCIONES.find(o => o.key === modulo)!
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    <div style={{
      flex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '24px 16px',
      justifyContent: 'center', background: FONDO, fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,.075), rgba(255,255,255,.03))', borderRadius: '18px', padding: '40px 44px',
        width: '100%', maxWidth: '400px', boxShadow: '0 24px 60px -20px rgba(0,0,0,0.7)',
        border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{ width: '42px', height: '42px', background: `linear-gradient(135deg, ${info.color}, color-mix(in srgb, ${info.color} 60%, #000))`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px -6px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.25)' }}>
            <span style={{ color: '#fff', fontSize: '18px', fontWeight: 800 }}>{info.inicial}</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '17px', color: '#e7eefb' }}>{info.nombre}</div>
            <div style={{ fontSize: '11px', color: '#8ea0c4', textTransform: 'uppercase', letterSpacing: '1px' }}>ASAP Consulting</div>
          </div>
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#e7eefb', margin: '0 0 6px' }}>Iniciar sesión</h2>
        <p style={{ fontSize: '13px', color: '#8ea0c4', margin: '0 0 28px' }}>Ingresá con tu cuenta de acceso</p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#b6c4de', marginBottom: '6px' }}>
              Usuario
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="usuario@asap.com"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 14px',
                borderRadius: '8px', border: '1px solid rgba(255,255,255,0.14)', fontSize: '14px',
                outline: 'none', color: '#e7eefb', background: 'rgba(6,18,42,0.55)',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#b6c4de', marginBottom: '6px' }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 14px',
                borderRadius: '8px', border: '1px solid rgba(255,255,255,0.14)', fontSize: '14px',
                outline: 'none', color: '#e7eefb', background: 'rgba(6,18,42,0.55)',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.14)', color: '#eb8484', padding: '10px 14px',
              borderRadius: '8px', fontSize: '13px', marginBottom: '16px',
              border: '1px solid rgba(230,76,76,0.4)',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={cargando}
            style={{
              width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
              background: cargando ? '#7a8fbb' : '#3b6fd9', color: '#fff',
              fontSize: '14px', fontWeight: 700, cursor: cargando ? 'wait' : 'pointer',
              boxShadow: cargando ? 'none' : '0 10px 24px -8px rgba(59,111,217,0.7)',
            }}
          >
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {onVolver && (
          <div
            onClick={onVolver}
            style={{ marginTop: '18px', textAlign: 'center', fontSize: '12px', color: '#8ea0c4', cursor: 'pointer', fontWeight: 600 }}
          >
            ← Cambiar de app
          </div>
        )}
      </div>
    </div>
  )
}
