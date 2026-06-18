import { useRef, useState } from 'react'
import axios from 'axios'

interface Resultado {
  nuevos: number
  actualizados: number
  cobradas: number
  total: number
}

const API_URL = import.meta.env.VITE_API_URL || ''

export function SubirReporte({ onActualizado }: { onActualizado: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState('')
  const [mostrarModal, setMostrarModal] = useState(false)

  const handleArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (!archivo) return

    const extensionValida = /\.(xls|xlsx|csv|xml)$/i.test(archivo.name)
    if (!extensionValida) {
      setError('El archivo debe ser .xls, .xlsx, .csv o .xml.')
      e.target.value = ''
      return
    }

    setCargando(true)
    setMostrarModal(true)
    setError('')
    setResultado(null)

    const formData = new FormData()
    formData.append('archivo', archivo)
    formData.append('usuario', 'usuario@asap.com')

    try {
      const { data } = await axios.post(`${API_URL}/api/reportes/subir`, formData, {
        timeout: 600000
      })
      setResultado(data)

      // Esperar un poco para mostrar resultado, luego recargar limpiamente
      setTimeout(() => {
        setCargando(false)
        onActualizado()
        setTimeout(() => {
          setMostrarModal(false)
          setResultado(null)
        }, 1500)
      }, 1000)
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Error al procesar el archivo.'
      setError(errorMsg)
      console.error('Error subiendo archivo:', err)
      setCargando(false)
      setMostrarModal(false)
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      {mostrarModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
            maxWidth: '400px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            {cargando ? (
              <>
                <div style={{
                  width: '50px',
                  height: '50px',
                  border: '4px solid #dde3f0',
                  borderTopColor: '#2554a0',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 20px'
                }} />
                <h2 style={{ color: '#0d1b38', margin: '0 0 8px' }}>Procesando Excel...</h2>
                <p style={{ color: '#7a8fbb', margin: '0', fontSize: '14px' }}>
                  Actualizando comprobantes en la base de datos
                </p>
              </>
            ) : resultado ? (
              <>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <h2 style={{ color: '#059669', margin: '0 0 16px' }}>¡Carga completada!</h2>
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px',
                  textAlign: 'left',
                  color: '#14532d',
                  fontSize: '13px'
                }}>
                  <div style={{ marginBottom: '8px' }}><strong>{resultado.nuevos}</strong> facturas nuevas</div>
                  <div style={{ marginBottom: '8px' }}><strong>{resultado.actualizados}</strong> ya existían → cobradas</div>
                  <div style={{ marginBottom: '8px' }}><strong>{resultado.cobradas}</strong> detectadas como cobradas</div>
                  <div><strong>{resultado.total}</strong> comprobantes procesados</div>
                </div>
                <p style={{ color: '#7a8fbb', margin: '0', fontSize: '12px' }}>
                  Recargando datos...
                </p>
              </>
            ) : null}
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      )}

      <div style={{
        background: '#fff',
        border: '1px solid #d9e2f1',
        borderRadius: '8px',
        padding: '18px 20px',
        marginBottom: '24px',
        boxShadow: '0 10px 28px rgba(38, 63, 101, 0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ color: '#6478a8', fontSize: '14px', fontWeight: 500 }}>
            Carga el reporte de cuentas corrientes para actualizar la base.
          </span>
          <label style={{
            background: cargando ? '#7a8fbb' : '#2554a0',
            color: '#fff',
            padding: '11px 20px',
            borderRadius: '8px',
            cursor: cargando ? 'wait' : 'pointer',
            fontSize: '14px',
            fontWeight: 700,
            boxShadow: cargando ? 'none' : '0 10px 22px rgba(37,84,160,0.22)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            {cargando && (
              <span style={{
                width: '14px',
                height: '14px',
                border: '2px solid rgba(255,255,255,0.35)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'subirSpin 0.7s linear infinite'
              }} />
            )}
            {cargando ? 'Procesando archivo...' : 'Cargar Excel'}
            <input
              ref={inputRef}
              type="file"
              accept=".xls,.xlsx,.csv,.xml"
              onChange={handleArchivo}
              disabled={cargando}
              style={{ display: 'none' }}
            />
          </label>
          <style>{`@keyframes subirSpin { to { transform: rotate(360deg) } }`}</style>
        </div>

        {error && (
          <div style={{ color: '#dc2626', marginTop: '10px', fontSize: '13px' }}>
            {error}
          </div>
        )}
      </div>
    </>
  )
}
