import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
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
      setError('Email o contraseña incorrectos.')
      setCargando(false)
    }
  }

  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#eef2f8', fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '40px 44px',
        width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(10,22,40,0.12)',
        border: '1px solid #dde3f0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{ width: '40px', height: '40px', background: '#2554a0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: '18px', fontWeight: 800 }}>C</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '17px', color: '#0d1b38' }}>Cobranzas</div>
            <div style={{ fontSize: '11px', color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '1px' }}>ASAP Consulting</div>
          </div>
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0d1b38', margin: '0 0 6px' }}>Iniciar sesión</h2>
        <p style={{ fontSize: '13px', color: '#7a8fbb', margin: '0 0 28px' }}>Ingresá con tu cuenta de acceso</p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#3d5278', marginBottom: '6px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="usuario@asap.com"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 14px',
                borderRadius: '8px', border: '1px solid #dde3f0', fontSize: '14px',
                outline: 'none', color: '#0d1b38', background: '#f8faff',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#3d5278', marginBottom: '6px' }}>
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
                borderRadius: '8px', border: '1px solid #dde3f0', fontSize: '14px',
                outline: 'none', color: '#0d1b38', background: '#f8faff',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#fee2e2', color: '#dc2626', padding: '10px 14px',
              borderRadius: '8px', fontSize: '13px', marginBottom: '16px',
              border: '1px solid #fca5a5',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={cargando}
            style={{
              width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
              background: cargando ? '#7a8fbb' : '#2554a0', color: '#fff',
              fontSize: '14px', fontWeight: 700, cursor: cargando ? 'wait' : 'pointer',
              boxShadow: cargando ? 'none' : '0 8px 20px rgba(37,84,160,0.25)',
            }}
          >
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
