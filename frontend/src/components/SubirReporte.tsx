import { useRef, useState } from 'react'
import axios from 'axios'

function mostrarOverlay(mensaje: string, submensaje: string) {
  eliminarOverlay()
  const overlay = document.createElement('div')
  overlay.id = '__overlay_carga__'
  overlay.innerHTML = `
    <div style="
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:#000;z-index:99999;
      display:flex;align-items:center;justify-content:center;
      font-family:Inter,sans-serif;
    ">
      <div style="
        background:#fff;border-radius:16px;padding:50px 40px;
        text-align:center;max-width:440px;width:90%;
        box-shadow:0 25px 80px rgba(0,0,0,0.6);
      ">
        <div id="__overlay_spinner__" style="
          width:56px;height:56px;
          border:5px solid #dde3f0;border-top-color:#2554a0;
          border-radius:50%;margin:0 auto 24px;
          animation:__spin__ 0.8s linear infinite;
        "></div>
        <h2 style="color:#0d1b38;margin:0 0 10px;font-size:20px;font-weight:700;">${mensaje}</h2>
        <p style="color:#7a8fbb;margin:0;font-size:14px;">${submensaje}</p>
        <style>@keyframes __spin__{ to{ transform:rotate(360deg) } }</style>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
}

function mostrarOverlayExito(nuevos: number, actualizados: number, cobradas: number, total: number) {
  eliminarOverlay()
  const overlay = document.createElement('div')
  overlay.id = '__overlay_carga__'
  overlay.innerHTML = `
    <div style="
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:#000;z-index:99999;
      display:flex;align-items:center;justify-content:center;
      font-family:Inter,sans-serif;
    ">
      <div style="
        background:#fff;border-radius:16px;padding:50px 40px;
        text-align:center;max-width:440px;width:90%;
        box-shadow:0 25px 80px rgba(0,0,0,0.6);
      ">
        <div style="font-size:54px;margin-bottom:18px;">✅</div>
        <h2 style="color:#059669;margin:0 0 20px;font-size:22px;font-weight:700;">¡Carga completada!</h2>
        <div style="
          background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;
          padding:18px;margin-bottom:16px;text-align:left;
          color:#14532d;font-size:14px;line-height:2;
        ">
          <div>✓ <strong>${nuevos}</strong> facturas nuevas</div>
          <div>✓ <strong>${actualizados}</strong> ya existían → cobradas</div>
          <div>✓ <strong>${cobradas}</strong> detectadas como cobradas</div>
          <div>✓ <strong>${total}</strong> comprobantes procesados</div>
        </div>
        <p style="color:#7a8fbb;margin:0;font-size:12px;font-style:italic;">Recargando página...</p>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
}

function mostrarOverlayError(mensaje: string) {
  eliminarOverlay()
  const overlay = document.createElement('div')
  overlay.id = '__overlay_carga__'
  overlay.innerHTML = `
    <div style="
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:#000;z-index:99999;
      display:flex;align-items:center;justify-content:center;
      font-family:Inter,sans-serif;
    ">
      <div style="
        background:#fff;border-radius:16px;padding:50px 40px;
        text-align:center;max-width:440px;width:90%;
        box-shadow:0 25px 80px rgba(0,0,0,0.6);
      ">
        <div style="font-size:54px;margin-bottom:18px;">❌</div>
        <h2 style="color:#dc2626;margin:0 0 14px;font-size:20px;font-weight:700;">Error al procesar</h2>
        <p style="color:#7a8fbb;margin:0 0 20px;font-size:14px;">${mensaje}</p>
        <button onclick="document.getElementById('__overlay_carga__').remove()" style="
          background:#2554a0;color:#fff;border:none;
          padding:10px 28px;border-radius:8px;font-size:14px;
          font-weight:700;cursor:pointer;
        ">Cerrar</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
}

function eliminarOverlay() {
  const existing = document.getElementById('__overlay_carga__')
  if (existing) existing.remove()
}

export function SubirReporte() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

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
    setError('')
    mostrarOverlay('Procesando Excel...', 'Actualizando comprobantes en la base de datos')

    const formData = new FormData()
    formData.append('archivo', archivo)
    formData.append('usuario', 'usuario@asap.com')

    try {
      const { data } = await axios.post('/api/reportes/subir', formData, {
        timeout: 600000
      })

      mostrarOverlayExito(data.nuevos, data.actualizados, data.cobradas, data.total)

      setTimeout(() => { window.location.reload() }, 2500)
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Error al procesar el archivo.'
      console.error('Error:', err)
      mostrarOverlayError(errorMsg)
      setError(errorMsg)
      setCargando(false)
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #d9e2f1',
      borderRadius: '8px',
      padding: '18px 20px',
      marginBottom: '24px',
      boxShadow: '0 10px 28px rgba(38,63,101,0.06)'
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
          cursor: cargando ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 700,
          boxShadow: cargando ? 'none' : '0 10px 22px rgba(37,84,160,0.22)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          userSelect: 'none',
        }}>
          {cargando && (
            <span style={{
              width: '14px', height: '14px',
              border: '2px solid rgba(255,255,255,0.35)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              display: 'inline-block',
              animation: '__spin__ 0.8s linear infinite'
            }} />
          )}
          {cargando ? 'Procesando...' : 'Cargar Excel'}
          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx,.csv,.xml"
            onChange={handleArchivo}
            disabled={cargando}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {error && (
        <div style={{ color: '#dc2626', marginTop: '10px', fontSize: '13px', fontWeight: 500 }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}
