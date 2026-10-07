export type Modulo = 'cobranzas' | 'facturacion' | 'pendientes'

export const OPCIONES: { key: Modulo; inicial: string; nombre: string; desc: string; color: string }[] = [
  { key: 'cobranzas', inicial: 'C', nombre: 'Cobranzas', desc: 'Estado de cuenta e historial de pagos por cliente y ejecutivo.', color: '#2554a0' },
  { key: 'facturacion', inicial: 'F', nombre: 'Facturación', desc: 'Detalle de facturas por cliente, ejecutivo, centro de costos, periodos y otros.', color: '#0e7490' },
  { key: 'pendientes', inicial: 'P', nombre: 'Pendientes de Facturación', desc: 'Seguimiento de lo que falta facturar por sociedad, aprobaciones y demoras.', color: '#4f46e5' },
]
