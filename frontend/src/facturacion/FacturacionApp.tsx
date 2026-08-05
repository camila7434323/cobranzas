import { useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useFacturacionLineas } from './hooks/useFacturacionLineas'
import { SubirFacturacionExcel } from './components/SubirFacturacionExcel'

const fmt = (n: number, moneda: string) => {
  const simbolo = moneda === 'USD' ? 'US$' : moneda === 'EUR' ? '€' : '$'
  return `${simbolo} ${Math.round(n).toLocaleString('es-AR')}`
}

const fmtFecha = (v: string | null) => {
  if (!v) return '-'
  const [y, m, d] = v.split('-')
  return `${d}/${m}/${y}`
}

export function FacturacionApp({ session, onCambiarModulo }: { session: Session; onCambiarModulo: () => void }) {
  const { data, loading, error, insertarLote } = useFacturacionLineas()
  const [empresaActiva, setEmpresaActiva] = useState<string>('')

  const empresas = useMemo(() => Array.from(new Set(data.map(r => r.empresa).filter(Boolean))).sort(), [data])
  const filas = empresaActiva ? data.filter(r => r.empresa === empresaActiva) : data
  const totalGeneral = useMemo(() => filas.reduce((s, r) => s + r.total_neto, 0), [filas])

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#eef2f8', fontFamily: 'Inter, sans-serif' }}>
      <aside style={{ width: '240px', background: 'linear-gradient(180deg, #0c2436 0%, #05101f 100%)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '22px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Facturación</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px' }}>ASAP Consulting</div>
        </div>

        <div style={{ padding: '10px', flex: 1, overflowY: 'auto' }}>
          <div
            onClick={() => setEmpresaActiva('')}
            style={{ padding: '9px 12px', borderRadius: '9px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: empresaActiva === '' ? '#fff' : 'rgba(255,255,255,0.55)', background: empresaActiva === '' ? '#0ea5e9' : 'transparent', marginBottom: '4px' }}
          >
            Todas las compañías
          </div>
          {empresas.map(e => (
            <div
              key={e}
              onClick={() => setEmpresaActiva(e)}
              style={{ padding: '9px 12px', borderRadius: '9px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: empresaActiva === e ? '#fff' : 'rgba(255,255,255,0.55)', background: empresaActiva === e ? '#0ea5e9' : 'transparent', marginBottom: '4px' }}
            >
              {e}
            </div>
          ))}
        </div>

        <div style={{ padding: '14px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={onCambiarModulo} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '11px', color: 'rgba(255,255,255,0.4)', padding: '6px 10px', borderRadius: '6px', fontWeight: 600 }}>
            ← Cambiar de app
          </button>
          <button onClick={() => supabase.auth.signOut()} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '11px', color: 'rgba(255,255,255,0.4)', padding: '6px 10px', borderRadius: '6px', fontWeight: 600 }}>
            Salir
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '20px 26px 30px', overflowY: 'auto' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#0d1b38', margin: '0 0 4px' }}>Facturación</h1>
        <div style={{ fontSize: '12px', color: '#7a8fbb', marginBottom: '18px' }}>{session.user.email}</div>

        <SubirFacturacionExcel insertarLote={insertarLote} />

        {error && <div style={{ color: '#dc2626', marginBottom: '14px', fontSize: '13px' }}>⚠ {error}</div>}

        <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #dde3f0', background: '#f8faff', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <strong style={{ fontSize: '13px', color: '#0d1b38' }}>Detalle</strong>
            <span style={{ fontSize: '12px', color: '#7a8fbb' }}>{filas.length} línea{filas.length === 1 ? '' : 's'}</span>
            {filas.length > 0 && (
              <span style={{ fontSize: '12px', color: '#7a8fbb', marginLeft: 'auto' }}>
                Total: <strong style={{ color: '#0d1b38' }}>{fmt(totalGeneral, filas[0]?.moneda || 'ARS')}</strong>
              </span>
            )}
          </div>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#7a8fbb' }}>Cargando...</div>
          ) : filas.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#7a8fbb' }}>Sin datos aún — subí un Excel para empezar.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8faff' }}>
                    {['Empresa', 'Cliente', 'Ejecutivo', 'Período', 'Fecha factura', 'N° Factura', 'CC Descripción', 'Monto'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Monto' ? 'right' : 'left', fontSize: '10px', color: '#7a8fbb', textTransform: 'uppercase', borderBottom: '1px solid #dde3f0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #dde3f0' }}>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#7a8fbb', whiteSpace: 'nowrap' }}>{r.empresa || '-'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, color: '#0d1b38' }}>{r.cliente}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#7a8fbb' }}>{r.ejecutivo || '-'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#7a8fbb', whiteSpace: 'nowrap' }}>{fmtFecha(r.periodo)}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#7a8fbb', whiteSpace: 'nowrap' }}>{fmtFecha(r.fecha_factura)}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', fontFamily: 'monospace', color: '#3d5278', whiteSpace: 'nowrap' }}>{r.n_factura || '-'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#7a8fbb' }}>{r.cc_descripcion || '-'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', textAlign: 'right' }}>{fmt(r.total_neto, r.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
