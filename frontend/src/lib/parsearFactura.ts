import type { ManualFactura, ManualFacturaItem, SociedadKey } from '../types/sociedades'

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const MESES_LABEL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const aFechaISO = (dd: number, mm: number, yyyy: number): string | null => {
  if (!dd || !mm || !yyyy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

function parsearFechaUS(texto: string): string | null {
  const m = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return null
  return aFechaISO(Number(m[2]), Number(m[1]), Number(m[3]))
}

function parsearFechaES(texto: string): string | null {
  const m = texto.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+)?(\d{4})/i)
  if (!m) return null
  const mes = MESES_ES.indexOf(m[2].toLowerCase()) + 1
  if (!mes) return null
  return aFechaISO(Number(m[1]), mes, Number(m[3]))
}

function parsearFecha(texto: string, sociedad: SociedadKey): string | null {
  return sociedad === 'sl' ? (parsearFechaES(texto) || parsearFechaUS(texto)) : (parsearFechaUS(texto) || parsearFechaES(texto))
}

function condicionMasCercana(textoTerms: string, opciones: string[]): string {
  if (/contado|cash/i.test(textoTerms)) {
    return opciones.find(o => /contado/i.test(o)) || ''
  }
  const dias = Number(textoTerms.match(/(\d+)/)?.[1])
  if (!dias) return ''
  let mejor = ''
  let menorDif = Infinity
  for (const op of opciones) {
    const diasOp = Number(op.match(/(\d+)/)?.[1])
    if (!diasOp) continue
    const dif = Math.abs(diasOp - dias)
    if (dif < menorDif) { menorDif = dif; mejor = op }
  }
  return mejor
}

function numeroFlexible(valor: string): number | null {
  const usaComaDecimal = /,\d{2}\s*(?:€|\$)?\s*$/.test(valor) || (valor.includes(',') && !valor.includes('.'))
  const limpio = usaComaDecimal
    ? valor.replace(/\./g, '').replace(',', '.')
    : valor.replace(/,/g, '')
  const n = parseFloat(limpio)
  return isNaN(n) ? null : n
}

function parsearMonto(texto: string): number | null {
  const matches = [...texto.matchAll(/\bTOTAL\b[^\d\n]{0,15}([\d][\d.,]*\d|\d)/gi)]
  if (!matches.length) return null
  return numeroFlexible(matches[matches.length - 1][1])
}

function parsearIva(texto: string): number | null {
  const m = texto.match(/\bIVA\b\s*(?:\d{1,2}(?:[.,]\d+)?\s*%)?[^\d\n]{0,10}(\d[\d.,]*\d|\d)/i)
  return m ? numeroFlexible(m[1]) : null
}

const numeroES = (str: string): number => {
  const n = parseFloat(str.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

function parsearItemsIngles(texto: string): ManualFacturaItem[] {
  const items: ManualFacturaItem[] = []
  for (const linea of texto.split('\n')) {
    const m = linea.match(/^\d+\.\s+(?:\d{1,2}\/\d{1,2}\/\d{4}\s+)?(.+?)\s+(\d+(?:\.\d+)?)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})\s*$/)
    if (!m) continue
    items.push({
      descripcion: m[1].trim(),
      unidad: '',
      cantidad: Number(m[2]),
      valor_unitario: Number(m[3].replace(/,/g, '')),
    })
  }
  return items
}

function parsearItemsEspanol(texto: string): ManualFacturaItem[] {
  const items: ManualFacturaItem[] = []
  const lineas = texto.split('\n')
  for (let i = 1; i < lineas.length; i++) {
    const m = lineas[i].match(/cantidad\s+horas:\s*([\d.,]+)\s+coste\s+hora\s+en\s*€:\s*([\d.,]+)\s*€/i)
    if (!m) continue
    items.push({
      descripcion: lineas[i - 1].trim(),
      unidad: 'horas',
      cantidad: numeroES(m[1]),
      valor_unitario: numeroES(m[2]),
    })
  }
  return items
}

function parsearItems(texto: string): ManualFacturaItem[] {
  const es = parsearItemsEspanol(texto)
  return es.length ? es : parsearItemsIngles(texto)
}

function parsearPeriodo(texto: string): string {
  const es = texto.match(/(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+(\d{4})/i)
  if (es) return `${es[1][0].toUpperCase()}${es[1].slice(1).toLowerCase()} ${es[2]}`
  const en = texto.match(new RegExp(`(${MESES_EN.join('|')})\\s+(\\d{4})`, 'i'))
  if (en) {
    const idx = MESES_EN.indexOf(en[1].toLowerCase())
    return `${MESES_LABEL[idx]} ${en[2]}`
  }
  return ''
}

export function parsearFacturaTexto(texto: string, sociedad: SociedadKey, condicionOpts: string[]): Partial<ManualFactura> {
  const resultado: Partial<ManualFactura> = {}

  const comprobante = texto.match(/invoice\s*(?:no\.?|number|#)\s*:?\s*([A-Za-z0-9./-]+)/i)
    || texto.match(/n[°ºo]\.?\s*factura\.?\s*:?\s*([A-Za-z0-9./-]+)/i)
    || texto.match(/factura\s*n[°ºo]\.?\s*:?\s*([A-Za-z0-9./-]+)/i)
  if (comprobante) resultado.comprobante = comprobante[1]

  const billTo = texto.match(/bill\s*to\s*\n\s*(.+)/i)
  const clienteEs = texto.match(/CLIENTE\s*:?\s*(.+)/i)
  if (clienteEs) resultado.cliente = clienteEs[1].trim()
  else if (billTo) resultado.cliente = billTo[1].trim()

  const fechaEmisionTxt = texto.match(/invoice\s*date\s*:?\s*([^\n]+)/i)?.[1]
    || texto.match(/(\d{1,2}\s+de\s+[a-záéíóú]+\s+(?:de\s+)?\d{4})/i)?.[1]
  if (fechaEmisionTxt) {
    const iso = parsearFecha(fechaEmisionTxt, sociedad)
    if (iso) resultado.fecha_emision = iso
  }

  const fechaVencTxt = texto.match(/due\s*date\s*:?\s*([^\n]+)/i)?.[1] || texto.match(/vencimiento\s*:?\s*([^\n]+)/i)?.[1]
  if (fechaVencTxt) {
    const iso = parsearFecha(fechaVencTxt, sociedad)
    if (iso) resultado.fecha_vencimiento = iso
  }

  const terms = texto.match(/terms\s*:?\s*([^\n]+)/i)?.[1]
  if (terms && condicionOpts.length) {
    const cond = condicionMasCercana(terms, condicionOpts)
    if (cond) resultado.condicion = cond
  }

  const oc = texto.match(/\bPO[\s#-]*(\d[\d-]*)/i) || texto.match(/(?:OC|HES|PEDIDO)\s*[:#]?\s*([\w-]+)/i)
  if (oc) resultado.oc_hes_pedido = oc[0].replace(/\s+/g, ' ').trim()

  const iva = parsearIva(texto)
  if (iva !== null) resultado.iva = iva

  const items = parsearItems(texto)
  if (items.length) {
    resultado.items = items
    resultado.monto = items.reduce((s, it) => s + it.cantidad * it.valor_unitario, 0)
  } else {
    const monto = parsearMonto(texto)
    if (monto !== null) resultado.monto = monto
  }

  if (texto.includes('€')) resultado.moneda = 'EUR'
  else if (texto.includes('$') || /\bUSD\b/i.test(texto)) resultado.moneda = 'USD'

  const periodo = parsearPeriodo(texto)
  if (periodo) resultado.periodo = periodo

  return resultado
}
