import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { getEjecutivo } from './ejecutivos'
import { notificarDuplicados } from './emailService'

type ComprobanteImportado = {
  codigo: string
  nombre_cliente: string
  ejecutivo: string
  comprobante: string
  fecha_emision: string | null
  fecha_vencimiento: string | null
  condicion: string
  monto: number
  dias_mora: number
  estado: 'pendiente'
}

export async function registrarCobros(buffer: Buffer, usuario: string) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const hoja = workbook.Sheets[workbook.SheetNames[0]]
  const filas: any[] = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' })

  const norm = (s: any) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')

  let colComp = -1
  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]
    if (!fila) continue
    for (let j = 0; j < fila.length; j++) {
      if (norm(fila[j]) === 'comprobante') { colComp = j; break }
    }
    if (colComp !== -1) break
  }

  if (colComp === -1) throw new Error('No se encontró la columna Comprobante en el Excel.')

  const numerosExcel = new Set<string>()
  for (const fila of filas) {
    if (!fila) continue
    const comp = limpiarTexto(fila[colComp])
    if (/^(FCM|FC|NCM|NC|NDM|ND)\s*[A-Z0-9]/i.test(comp)) numerosExcel.add(comp)
  }

  if (numerosExcel.size === 0) throw new Error('No se encontraron comprobantes válidos en el archivo.')

  const { data: pendientes, error } = await supabase
    .from('comprobantes')
    .select('*')
    .eq('estado', 'pendiente')
    .in('comprobante', Array.from(numerosExcel))

  if (error) throw error

  for (const p of (pendientes || [])) {
    await supabase
      .from('comprobantes')
      .update({ estado: 'cobrado', updated_at: new Date().toISOString() })
      .eq('id', p.id)

    await supabase.from('historial_cobros').insert({
      comprobante_id:     p.id,
      comprobante_numero: p.comprobante,
      cliente:            p.nombre_cliente,
      monto:              p.monto,
      fecha_cobro:        new Date().toISOString(),
      cobrado_por:        usuario,
      ejecutivo:          p.ejecutivo || 'Sin asignar',
    })
  }

  return {
    cobradas:      pendientes?.length || 0,
    noEncontradas: numerosExcel.size - (pendientes?.length || 0),
    total:         numerosExcel.size,
  }
}

export async function procesarArchivo(buffer: Buffer, usuario: string, nombreArchivo?: string) {
  const nombre = (nombreArchivo || '').toLowerCase()
  if (nombre.endsWith('.xml')) return procesarXML(buffer, usuario, nombreArchivo)
  if (nombre.endsWith('.xlsx') || nombre.endsWith('.xls')) return procesarExcel(buffer, usuario, nombreArchivo)

  // Fallback: detectar por contenido
  const cabecera = buffer.subarray(0, 200).toString('utf-8').trimStart()
  if (cabecera.startsWith('<?xml') || cabecera.startsWith('<FormattedReport')) {
    return procesarXML(buffer, usuario, nombreArchivo)
  }
  return procesarExcel(buffer, usuario, nombreArchivo)
}

export async function procesarXML(buffer: Buffer, usuario: string, nombreArchivo?: string) {
  const xmlText = buffer.toString('utf-8')
  const esCrystalReports = xmlText.includes('<FormattedReport') || xmlText.includes('FormattedReportObject')
  const comprobantes = esCrystalReports
    ? parsearCrystalReportsXML(xmlText)
    : parsearClientesFlatXML(xmlText)
  if (comprobantes.length === 0) {
    throw new Error('No se encontraron comprobantes validos en el XML.')
  }
  return sincronizarComprobantes(comprobantes, usuario, nombreArchivo)
}

export async function procesarExcel(buffer: Buffer, usuario: string, nombreArchivo?: string) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const hoja = workbook.Sheets[workbook.SheetNames[0]]
  const filas: any[] = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' })

  const norm = (s: any) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')

  let colFecha = -1
  let colComp = -1
  let colCondicion = -1
  let colImporte = -1
  let colMora = -1
  let colVto = -1

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]
    if (!fila) continue

    for (let j = 0; j < fila.length; j++) {
      const cell = norm(fila[j])
      if (cell === 'fecha') colFecha = j
      if (cell === 'comprobante') colComp = j
      if (cell.startsWith('condic')) colCondicion = j
      if (cell.includes('importe') && !cell.includes('orig')) colImporte = j
      if (cell === 'mora') colMora = j
      if (cell === 'vto' || cell === 'vto.' || cell === 'vencimiento') colVto = j
    }

    if (colComp !== -1 && colImporte !== -1) break
  }

  if (colComp === -1) {
    throw new Error('No se encontro la columna Comprobante en el Excel.')
  }

  const comprobantes: ComprobanteImportado[] = []
  const comprobantesVistos = new Set<string>()
  let clienteActual = ''
  let nombreActual = ''
  let rowsPostCliente = 0

  for (const fila of filas) {
    if (!fila || fila.length === 0) continue

    const clienteCell = fila.find((cell: any) => norm(cell).startsWith('cliente'))
    if (clienteCell) {
      clienteActual = limpiarTexto(clienteCell).replace(/^cliente\s*[: ]\s*/i, '')
      nombreActual = ''
      rowsPostCliente = 0
      continue
    }

    if (clienteActual && !nombreActual && rowsPostCliente < 4) {
      rowsPostCliente++
      const nombre = fila
        .map(limpiarTexto)
        .find((v: string) =>
          v.length > 3 &&
          !/^\d/.test(v) &&
          !/^(total|fecha|comprobante|vto|importe|condici|causa|mora|periodo|\$|composicion)/i.test(v) &&
          !/^(FCM?|NCM?|NDM?)\s/i.test(v) &&
          /[A-Za-z]{3}/.test(v)
        )

      if (nombre) nombreActual = nombre
      continue
    }

    const comprobante = colComp >= 0 ? limpiarTexto(fila[colComp]) : ''
    const esComprobante = /^(FCM|FC|NCM|NC|NDM|ND)\s*[A-Z0-9]/i.test(comprobante)

    if (!esComprobante || !clienteActual || comprobantesVistos.has(comprobante)) continue
    comprobantesVistos.add(comprobante)
    rowsPostCliente = 99

    const nombreCliente = nombreActual || clienteActual
    const fechaEmision = colFecha >= 0 ? parsearFecha(fila[colFecha]) : ''
    const fechaVencimiento = detectarFechaVencimiento(fila, colVto, colFecha, colComp)
    const monto = detectarMonto(fila, colImporte)
    const diasMora = detectarMora(fila, colMora, fechaVencimiento)

    comprobantes.push({
      codigo: clienteActual,
      nombre_cliente: nombreCliente,
      ejecutivo: getEjecutivo(nombreCliente),
      comprobante,
      fecha_emision: fechaEmision || null,
      fecha_vencimiento: fechaVencimiento || null,
      condicion: colCondicion >= 0 ? limpiarTexto(fila[colCondicion]) : '',
      monto,
      dias_mora: diasMora,
      estado: 'pendiente'
    })
  }

  if (comprobantes.length === 0) {
    throw new Error('No se encontraron comprobantes validos en el archivo.')
  }

  return sincronizarComprobantes(comprobantes, usuario, nombreArchivo)
}

async function sincronizarComprobantes(
  comprobantes: ComprobanteImportado[],
  usuario: string,
  nombreArchivo?: string
) {
  const [{ data: todos, error: errorSelect }, { data: historialExistente }] = await Promise.all([
    supabase.from('comprobantes').select('*'),
    supabase.from('historial_cobros').select('comprobante_id')
  ])
  if (errorSelect) throw errorSelect

  const yaEnHistorial = new Set((historialExistente || []).map((h: any) => h.comprobante_id))
  const todosMap = new Map<string, any>((todos || []).map((c: any) => [c.comprobante, c]))
  const pendientes = (todos || []).filter((c: any) => c.estado === 'pendiente')
  const numerosNuevos = new Set(comprobantes.map(c => c.comprobante))

  const cobradas = pendientes.filter((c: any) => !numerosNuevos.has(c.comprobante))
  const nuevosComp = comprobantes.filter(c => !todosMap.has(c.comprobante))
  const yaExisten = comprobantes.filter(c => todosMap.has(c.comprobante))
  const reaparicion = yaExisten
    .map(c => todosMap.get(c.comprobante))
    .filter(ex => ex.estado === 'pendiente')

  const ahora = new Date().toISOString()
  const idsACobrar = [
    ...cobradas.map((c: any) => c.id),
    ...reaparicion.map((c: any) => c.id)
  ]

  const historialNuevo = [
    ...cobradas.filter((c: any) => !yaEnHistorial.has(c.id)),
    ...yaExisten
      .map(c => todosMap.get(c.comprobante))
      .filter((ex: any) => !yaEnHistorial.has(ex.id))
  ].map((c: any) => ({
    comprobante_id:     c.id,
    comprobante_numero: c.comprobante,
    cliente:            c.nombre_cliente,
    monto:              c.monto,
    fecha_cobro:        ahora,
    cobrado_por:        usuario,
    ejecutivo:          c.ejecutivo || 'Sin asignar'
  }))

  const ops: PromiseLike<any>[] = []

  if (nuevosComp.length > 0) {
    for (let i = 0; i < nuevosComp.length; i += 500) {
      ops.push(supabase.from('comprobantes').insert(nuevosComp.slice(i, i + 500)))
    }
  }

  if (idsACobrar.length > 0) {
    ops.push(
      supabase
        .from('comprobantes')
        .update({ estado: 'cobrado', updated_at: ahora })
        .in('id', idsACobrar)
    )
  }

  if (historialNuevo.length > 0) {
    for (let i = 0; i < historialNuevo.length; i += 500) {
      ops.push(supabase.from('historial_cobros').insert(historialNuevo.slice(i, i + 500)))
    }
  }

  const resultados = await Promise.all(ops)
  for (const r of resultados) if (r?.error) throw r.error

  // Notificar si hay duplicados detectados
  const duplicadosParaNotificar = [...cobradas, ...reaparicion]
  if (duplicadosParaNotificar.length > 0) {
    await notificarDuplicados(usuario, cobradas, reaparicion).catch(err =>
      console.error('Error enviando notificación de duplicados:', err.message)
    )
  }

  await supabase.from('reportes').insert({
    nombre_archivo: nombreArchivo || `reporte_${ahora}`,
    subido_por: usuario,
    comprobantes_nuevos: nuevosComp.length,
    comprobantes_cobrados: cobradas.length,
    comprobantes_actualizados: reaparicion.length
  })

  return {
    nuevos: nuevosComp.length,
    actualizados: reaparicion.length,
    cobradas: cobradas.length,
    total: comprobantes.length
  }
}

function parsearCrystalReportsXML(xmlText: string): ComprobanteImportado[] {
  const records: ComprobanteImportado[] = []
  let currentCode: string | null = null
  let currentName: string | null = null
  let nextName: string | null = null
  let nextCode: string | null = null
  let pending: {
    comp?: string
    emision?: string
    fecha21?: string
    condicion?: string
    moneda?: string
    monto?: string
    monto_ars?: string
    mora?: string
  } = {}

  const flush = () => {
    if (pending.comp && currentCode) {
      const condicion = pending.condicion || ''
      let vtoIso = ''

      if (pending.emision && condicion) {
        const diasMatch = condicion.match(/(\d+)/)
        const dias = diasMatch ? parseInt(diasMatch[1], 10) : 30
        if (/^\d{4}-\d{2}-\d{2}$/.test(pending.emision)) {
          const d = new Date(`${pending.emision}T00:00:00`)
          d.setDate(d.getDate() + dias)
          vtoIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        }
      } else if (pending.fecha21 && /^\d{4}-\d{2}-\d{2}$/.test(pending.fecha21)) {
        vtoIso = pending.fecha21
      }

      const nombre = currentName || currentCode
      const usaMontoArs = pending.moneda && pending.moneda !== '$' && pending.monto_ars
      const montoNum = usaMontoArs
        ? parseFloat(pending.monto_ars as string)
        : parseFloat(pending.monto || '0')

      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      let diasMora = parseInt(pending.mora || '0', 10) || 0
      if (!diasMora && vtoIso) {
        const v = new Date(`${vtoIso}T00:00:00`)
        const diff = Math.floor((hoy.getTime() - v.getTime()) / 86400000)
        diasMora = diff > 0 ? diff : 0
      }

      records.push({
        codigo: currentCode,
        nombre_cliente: nombre,
        ejecutivo: getEjecutivo(nombre),
        comprobante: pending.comp,
        fecha_emision: pending.emision || null,
        fecha_vencimiento: vtoIso || null,
        condicion,
        monto: Number.isFinite(montoNum) ? montoNum : 0,
        dias_mora: diasMora,
        estado: 'pendiente'
      })
    }
    pending = {}
  }

  const rxObj = /<FormattedReportObject\b([^>]*)>([\s\S]*?)<\/FormattedReportObject>/g
  const decode = (s: string) =>
    s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  const inner = (body: string, tag: string) => {
    const m = body.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
    return m ? decode(m[1]).trim() : ''
  }

  let m: RegExpExecArray | null
  while ((m = rxObj.exec(xmlText)) !== null) {
    const attrs = m[1]
    const body = m[2]
    const xtype = (attrs.match(/xsi:type="([^"]+)"/) || ['', ''])[1]
    const on = inner(body, 'ObjectName')
    const fv = inner(body, 'FormattedValue')
    const val = inner(body, 'Value')
    const tv = inner(body, 'TextValue')

    if (on === 'cliRazSoc1') nextName = fv
    if (xtype === 'CTFormattedText' && tv.includes('Cliente:')) {
      const mm = tv.match(/Cliente:\s+(\S+)/)
      if (mm) nextCode = mm[1]
    }
    if (on === 'Comprobante1') {
      flush()
      if (nextName) { currentName = nextName; nextName = null }
      if (nextCode) { currentCode = nextCode; nextCode = null }
      pending.comp = /^(FCM|FC|NCM|NC|NDM|ND)\s*[A-Z0-9]/i.test(val) ? val : ''
    }
    if (on === 'Fecha11')         pending.emision   = val
    if (on === 'Fecha21')         pending.fecha21   = val
    if (on === 'CondicionVenta1') pending.condicion = val.replace(/^\d+\s*/, '').trim()
    if (on === 'Simbolo2')        pending.moneda    = val.toLowerCase().trim()
    if (on === 'acSaldo1' && val) pending.monto_ars = val
    if (on === 'cveSaldoMonCC1')  pending.monto     = val
    if (on === 'Mora1')           pending.mora      = val
  }
  flush()
  return records
}

function parsearClientesFlatXML(xmlText: string): ComprobanteImportado[] {
  const records: ComprobanteImportado[] = []
  const vistos = new Set<string>()
  const decode = (s: string) =>
    s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'")

  const getField = (block: string, tagPrefix: string): string => {
    const rx = new RegExp(`<${tagPrefix}[^>]*?>([^<]*)</${tagPrefix}[^>]*>`)
    const m = block.match(rx)
    return m ? decode(m[1] || '').trim() : ''
  }

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const chunks = xmlText.split(/<Cliente>/)
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i]
    const idxEnd = chunk.indexOf('</Cliente>')
    if (idxEnd < 0) continue
    const nombre = decode(chunk.substring(0, idxEnd)).trim()
    if (!nombre) continue
    const rest = chunk.substring(idxEnd + '</Cliente>'.length)

    const comp = getField(rest, 'Comprobante')
    if (!comp || !/^(FCM|FC|NCM|NC|NDM|ND)\s*[A-Z0-9]/i.test(comp)) continue
    if (vistos.has(comp)) continue
    vistos.add(comp)

    const emision = getField(rest, 'Fecha_Emisi')
    const vto = getField(rest, 'Fecha_Vencimiento')
    const saldo = getField(rest, 'Saldo')
    const condicion = getField(rest, 'Condici')
    const moraStr = getField(rest, 'Mora')

    const montoNum = parseFloat(saldo)
    let diasMora = parseInt(moraStr, 10) || 0
    if (!diasMora && /^\d{4}-\d{2}-\d{2}$/.test(vto)) {
      const v = new Date(`${vto}T00:00:00`)
      const diff = Math.floor((hoy.getTime() - v.getTime()) / 86400000)
      diasMora = diff > 0 ? diff : 0
    }

    const codigo = nombre.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'CLI'

    records.push({
      codigo,
      nombre_cliente: nombre,
      ejecutivo: getEjecutivo(nombre),
      comprobante: comp,
      fecha_emision: /^\d{4}-\d{2}-\d{2}$/.test(emision) ? emision : null,
      fecha_vencimiento: /^\d{4}-\d{2}-\d{2}$/.test(vto) ? vto : null,
      condicion,
      monto: Number.isFinite(montoNum) ? montoNum : 0,
      dias_mora: diasMora,
      estado: 'pendiente'
    })
  }

  return records
}

function detectarFechaVencimiento(fila: any[], colVto: number, colFecha: number, colComp: number): string {
  const fechaDirecta = colVto >= 0 ? parsearFecha(fila[colVto]) : ''
  if (fechaDirecta) return fechaDirecta

  for (let k = 0; k < fila.length; k++) {
    if (k === colFecha || k === colComp) continue
    const fecha = parsearFecha(fila[k])
    if (fecha) return fecha
  }

  return ''
}

function detectarMonto(fila: any[], colImporte: number): number {
  if (colImporte < 0) return 0

  for (let k = colImporte; k <= Math.min(colImporte + 8, fila.length - 1); k++) {
    const monto = parsearMonto(fila[k])
    if (monto > 0) return monto
  }

  return 0
}

function detectarMora(fila: any[], colMora: number, fechaVencimiento: string): number {
  if (colMora >= 0) {
    const mora = Number(fila[colMora])
    if (Number.isFinite(mora) && mora > 0) return mora
  }

  if (!fechaVencimiento) return 0
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vencimiento = new Date(`${fechaVencimiento}T00:00:00`)
  const diff = Math.floor((hoy.getTime() - vencimiento.getTime()) / 86400000)
  return diff > 0 ? diff : 0
}

function serialToIso(serial: number): string {
  const d = XLSX.SSF.parse_date_code(serial)
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
}

function parsearFecha(val: any): string {
  if (!val) return ''
  if (typeof val === 'number' && val > 40000 && val < 60000) return serialToIso(val)

  if (typeof val === 'string') {
    const s = val.trim()
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/')
      return `${y}-${m}-${d}`
    }
    if (/^\d{2}\/\d{2}\/\d{2}$/.test(s)) {
      const [d, m, y] = s.split('/')
      return `20${y}-${m}-${d}`
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  }

  return ''
}

function parsearMonto(val: any): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (typeof val !== 'string') return 0

  const normalizado = val.replace(/\$/g, '').replace(/\./g, '').replace(',', '.').trim()
  const monto = Number(normalizado)
  return Number.isFinite(monto) ? monto : 0
}

function limpiarTexto(valor: any): string {
  return String(valor || '').replace(/\s+/g, ' ').trim()
}
