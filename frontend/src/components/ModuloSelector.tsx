type Modulo = 'cobranzas' | 'facturacion'

const OPCIONES: { key: Modulo; inicial: string; nombre: string; desc: string; color: string }[] = [
  { key: 'cobranzas', inicial: 'C', nombre: 'Cobranzas', desc: 'Seguimiento de comprobantes pendientes, mora y cobros.', color: '#2554a0' },
  { key: 'facturacion', inicial: 'F', nombre: 'Facturación', desc: 'Análisis de facturación por cliente, ejecutivo y período.', color: '#0e7490' },
]

export function ModuloSelector({ onSelect }: { onSelect: (modulo: Modulo) => void }) {
  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: '#eef2f8', fontFamily: 'Inter, sans-serif', gap: '28px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '20px', fontWeight: 800, color: '#0d1b38', marginBottom: '4px' }}>ASAP Consulting</div>
        <div style={{ fontSize: '13px', color: '#7a8fbb' }}>Elegí con qué app querés trabajar</div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {OPCIONES.map(o => (
          <div
            key={o.key}
            onClick={() => onSelect(o.key)}
            style={{
              width: '240px', background: '#fff', borderRadius: '16px', padding: '28px 24px',
              boxShadow: '0 12px 32px rgba(10,22,40,0.1)', border: '1px solid #dde3f0', cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 18px 40px rgba(10,22,40,0.16)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(10,22,40,0.1)' }}
          >
            <div style={{ width: '48px', height: '48px', background: o.color, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <span style={{ color: '#fff', fontSize: '22px', fontWeight: 800 }}>{o.inicial}</span>
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0d1b38', marginBottom: '6px' }}>{o.nombre}</div>
            <div style={{ fontSize: '12.5px', color: '#7a8fbb', lineHeight: 1.5 }}>{o.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
