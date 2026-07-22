export const CONDICION_OPTS = [
  'Cuenta Corriente 7 días', 'Cuenta Corriente a 15 días', 'Cuenta Corriente 30 días',
  'Cuenta Corriente 45 días', 'Cuenta Corriente 60 días', 'Cuenta Corriente 90 días', 'Contado',
]

export type SociedadKey = 'sa' | 'llc' | 'sl'

export const SOCIEDADES: Record<SociedadKey, { nombre: string; corto: string; flag: string; flagCode: string; manual: boolean; monedas: string[] }> = {
  sa:  { nombre: 'ASAP Consulting SA',   corto: 'ASAP SA',     flag: '🇦🇷', flagCode: 'ar', manual: false, monedas: ['ARS'] },
  llc: { nombre: 'ASAP Consulting LLC',  corto: 'ASAP LLC',    flag: '🇺🇸', flagCode: 'us', manual: true,  monedas: ['USD'] },
  sl:  { nombre: 'IT ASAP Solutions SL', corto: 'IT ASAP SL',  flag: '🇪🇸', flagCode: 'es', manual: true,  monedas: ['USD', 'EUR'] },
}

export type ManualFactura = {
  id: string
  sociedad: Exclude<SociedadKey, 'sa'>
  comprobante: string
  cliente: string
  ejecutivo: string
  fecha_emision: string
  fecha_vencimiento: string
  condicion: string
  moneda: string
  descripcion: string
  unidad: string
  cantidad: number
  valor_unitario: number
  monto: number
  oc_hes_pedido: string
  periodo: string
  colaborador: string
  otros_conceptos: string
  pdf_url: string
  pdf_base64: string
  pdf_nombre: string
  creado_el: string
  cobrado_el?: string
}
