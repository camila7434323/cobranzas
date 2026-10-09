import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { supabase } from '../lib/supabase'
import { marcarInicioSesion } from '../lib/sesion'

// Pantalla a la que llega el usuario desde WiSoft: /ingreso?auth=<jwt>
// Lee el token, lo saca de la URL, lo valida en /api/sso y abre la sesión.
export function IngresoWisoft({ token, onListo }: { token: string; onListo: () => void }) {
  const [error, setError] = useState('')
  const iniciado = useRef(false)

  useEffect(() => {
    // React en modo desarrollo monta dos veces; el token es de un solo uso.
    if (iniciado.current) return
    iniciado.current = true

    const ingresar = async () => {
      try {
        const { data } = await axios.post('/api/sso', { token }, { timeout: 20000 })
        // Se marca antes de abrir la sesión para que el control de 10 hs
        // no use la marca de una sesión anterior.
        marcarInicioSesion()
        const { error: errorOtp } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' })
        if (errorOtp) throw errorOtp
        onListo()
      } catch (e: any) {
        setError(e?.response?.data?.error || 'No se pudo completar el ingreso desde WiSoft.')
      }
    }
    ingresar()
  }, [token, onListo])

  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#eef2f8', fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '36px 40px', width: '100%', maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(10,22,40,0.12)', border: '1px solid #dde3f0', textAlign: 'center',
      }}>
        {!error ? (
          <>
            <div style={{ fontWeight: 700, fontSize: '17px', color: '#0d1b38', marginBottom: '8px' }}>Ingresando desde WiSoft…</div>
            <div style={{ fontSize: '13px', color: '#7a8fbb' }}>Estamos validando tu usuario.</div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 700, fontSize: '17px', color: '#0d1b38', marginBottom: '10px' }}>No pudimos ingresarte</div>
            <div style={{
              background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px',
              fontSize: '13px', border: '1px solid #fca5a5', marginBottom: '18px',
            }}>
              {error}
            </div>
            <div onClick={onListo} style={{ fontSize: '12px', color: '#7a8fbb', cursor: 'pointer', fontWeight: 600 }}>
              Ingresar con usuario y contraseña
            </div>
          </>
        )}
      </div>
    </div>
  )
}
