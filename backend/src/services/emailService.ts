import nodemailer from 'nodemailer'
import { supabase } from '../lib/supabase'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  }
})

const EMAILS_EJECUTIVOS: Record<string, string> = {
  'Lucas Roca':            'camilaruberto2004@gmail.com',
  'Joaquin Ramirez':       'camilaruberto2004@gmail.com',
  'Julieta Salvucci':      'camilaruberto2004@gmail.com',
  'Emiliano Angelinetta':  'camilaruberto2004@gmail.com',
  'Leonardo Nocera':       'camilaruberto2004@gmail.com',
  'Maria Cadarso':         'camilaruberto2004@gmail.com',
  'Fernanda Dugini':       'camilaruberto2004@gmail.com',
  'Pablo Cruz':            'camilaruberto2004@gmail.com'
}

function fmt(n: number) {
  return '$' + Math.round(n).toLocaleString('es-AR')
}

function seccionHTML(titulo: string, color: string, facturas: any[], mostrarDias: boolean = true) {
  if (facturas.length === 0) return ''
  const filas = facturas.map(f => `
    <tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:10px 12px;font-family:monospace;font-size:12px;color:#3d5278">${f.comprobante}</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#0d1b38">${f.nombre_cliente}</td>
      <td style="padding:10px 12px;font-size:12px;color:#3d5278">${f.fecha_vencimiento || '-'}</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:600">${fmt(f.monto)}</td>
      <td style="padding:10px 12px">
        <span style="background:${color}22;color:${color};padding:3px 9px;border-radius:20px;font-size:12px;font-weight:600">
          ${mostrarDias ? `${f.dias_mora}d` : `vence ${f.fecha_vencimiento}`}
        </span>
      </td>
    </tr>
  `).join('')

  return `
    <div style="margin-top:24px">
      <div style="background:${color}15;border-left:4px solid ${color};border-radius:8px;padding:10px 16px;margin-bottom:12px">
        <strong style="color:${color};font-size:13px">${titulo}</strong>
        <span style="color:#7a8fbb;font-size:12px;margin-left:8px">${facturas.length} factura${facturas.length > 1 ? 's' : ''}</span>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f8faff">
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:#7a8fbb;text-transform:uppercase">Comprobante</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:#7a8fbb;text-transform:uppercase">Cliente</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:#7a8fbb;text-transform:uppercase">Vencimiento</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:#7a8fbb;text-transform:uppercase">Monto</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:#7a8fbb;text-transform:uppercase">Estado</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `
}

export async function notificarDuplicados(usuario: string, duplicados: any[], reapariciones: any[]) {
  const emails = new Set<string>()
  const detallesPorEjecutivo: Record<string, any[]> = {}

  // Agrupar por ejecutivo
  for (const c of [...duplicados, ...reapariciones]) {
    const exec = c.ejecutivo || 'Sin asignar'
    const email = EMAILS_EJECUTIVOS[exec]
    if (email) emails.add(email)
    if (!detallesPorEjecutivo[exec]) detallesPorEjecutivo[exec] = []
    detallesPorEjecutivo[exec].push(c)
  }

  for (const email of Array.from(emails)) {
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:Inter,sans-serif;background:#f4f6fb;margin:0;padding:20px">
        <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
          <div style="background:#059669;padding:24px 28px">
            <div style="color:#fff;font-size:18px;font-weight:700">✅ Facturas Marcadas como Cobradas</div>
            <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px">
              Se detectaron ${duplicados.length + reapariciones.length} comprobante(s) duplicado(s) al importar
            </div>
          </div>
          <div style="padding:24px 28px">
            <p style="font-size:14px;color:#3d5278">
              Se encontraron comprobantes que ya estaban registrados en el sistema. Estos han sido marcados como <strong>cobrados</strong> automáticamente.
            </p>
            <p style="font-size:12px;color:#7a8fbb;margin-top:16px">
              <strong>Usuario que cargó:</strong> ${usuario}<br>
              <strong>Fecha:</strong> ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR')}
            </p>
            ${duplicados.length > 0 ? `
              <div style="margin-top:16px;background:#f0fdf4;border-left:4px solid #059669;border-radius:8px;padding:12px 16px">
                <strong style="color:#059669;font-size:13px">Comprobantes duplicados (${duplicados.length}):</strong>
                <div style="font-size:12px;color:#3d5278;margin-top:8px">
                  ${duplicados.map(c => `• ${c.comprobante} — ${c.nombre_cliente} — ${fmt(c.monto)}`).join('<br>')}
                </div>
              </div>
            ` : ''}
            ${reapariciones.length > 0 ? `
              <div style="margin-top:12px;background:#f0fdf4;border-left:4px solid #059669;border-radius:8px;padding:12px 16px">
                <strong style="color:#059669;font-size:13px">Reapariciones (${reapariciones.length}):</strong>
                <div style="font-size:12px;color:#3d5278;margin-top:8px">
                  ${reapariciones.map(c => `• ${c.comprobante} — ${c.nombre_cliente} — ${fmt(c.monto)}`).join('<br>')}
                </div>
              </div>
            ` : ''}
            <p style="font-size:12px;color:#7a8fbb;margin-top:24px;border-top:1px solid #f0f0f0;padding-top:16px">
              Este mail fue generado automáticamente por el sistema de cobranzas de ASAP Consulting.
            </p>
          </div>
        </div>
      </body>
      </html>
    `

    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: email,
        subject: `✅ ${duplicados.length + reapariciones.length} Facturas Marcadas como Cobradas`,
        html
      })
      console.log(`✅ Notificación de duplicados enviada a ${email}`)
    } catch (err: any) {
      console.error(`❌ Error enviando notificación de duplicados:`, err.message)
    }
  }
}

export async function enviarAlertas() {
  console.log('📧 Iniciando envío de alertas...')

  const hoy = new Date()

  // Traer todos los comprobantes pendientes
  const { data: comprobantes, error } = await supabase
    .from('comprobantes')
    .select('*')
    .eq('estado', 'pendiente')
    .order('dias_mora', { ascending: false })

  if (error) {
    console.error('Error al traer comprobantes:', error.message)
    return
  }

  if (!comprobantes || comprobantes.length === 0) {
    console.log('No hay comprobantes pendientes')
    return
  }

  // Agregar facturas próximas a vencer (en 7 días)
  const proximasAVencer = comprobantes.filter(c => {
    if (!c.fecha_vencimiento) return false
    const vto = new Date(c.fecha_vencimiento)
    const diasHastaVto = Math.floor((vto.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    return diasHastaVto >= 0 && diasHastaVto <= 7
  })

  // Facturas con mora
  const conMora = comprobantes.filter(c => c.dias_mora > 0)

  // Todos los relevantes
  const todos = [...new Map([...conMora, ...proximasAVencer].map(c => [c.id, c])).values()]

  // Agrupar por ejecutivo
  const porEjecutivo: Record<string, any[]> = {}
  todos.forEach(c => {
    const exec = c.ejecutivo || 'Sin asignar'
    if (!porEjecutivo[exec]) porEjecutivo[exec] = []
    porEjecutivo[exec].push(c)
  })

  for (const [ejecutivo, facturas] of Object.entries(porEjecutivo)) {
    const email = EMAILS_EJECUTIVOS[ejecutivo]
    if (!email) {
      console.log(`Sin email para ${ejecutivo}, saltando...`)
      continue
    }

    // Clasificar
    const urgentes    = facturas.filter(f => f.dias_mora > 60)
    const criticas    = facturas.filter(f => f.dias_mora > 30 && f.dias_mora <= 60)
    const recientes   = facturas.filter(f => f.dias_mora >= 1 && f.dias_mora <= 30)
    const proximas    = facturas.filter(f => f.dias_mora === 0)

    const totalMora = facturas.filter(f => f.dias_mora > 0).reduce((s, f) => s + f.monto, 0)

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:Inter,sans-serif;background:#f4f6fb;margin:0;padding:20px">
        <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">

          <div style="background:#0a1628;padding:24px 28px">
            <div style="color:#fff;font-size:18px;font-weight:700">Cobranzas · ASAP Consulting</div>
            <div style="color:rgba(255,255,255,0.5);font-size:13px;margin-top:4px">
              Reporte de mora · ${hoy.toLocaleDateString('es-AR')}
            </div>
          </div>

          <div style="padding:24px 28px">
            <p style="font-size:15px;color:#0d1b38">Hola <strong>${ejecutivo}</strong>,</p>
            <p style="font-size:14px;color:#3d5278">
              Resumen de tus facturas al ${hoy.toLocaleDateString('es-AR')}:
            </p>

            <div style="display:flex;gap:12px;margin:16px 0;flex-wrap:wrap">
              ${urgentes.length > 0 ? `<div style="background:#ede9fe;border-radius:8px;padding:10px 16px;text-align:center"><div style="font-size:20px;font-weight:700;color:#7c3aed">${urgentes.length}</div><div style="font-size:11px;color:#4c1d95">⚠️ Urgentes +60d</div></div>` : ''}
              ${criticas.length > 0 ? `<div style="background:#fee2e2;border-radius:8px;padding:10px 16px;text-align:center"><div style="font-size:20px;font-weight:700;color:#dc2626">${criticas.length}</div><div style="font-size:11px;color:#991b1b">🔴 En mora 31-60d</div></div>` : ''}
              ${recientes.length > 0 ? `<div style="background:#fef3c7;border-radius:8px;padding:10px 16px;text-align:center"><div style="font-size:20px;font-weight:700;color:#d97706">${recientes.length}</div><div style="font-size:11px;color:#92400e">🟡 Mora 1-30d</div></div>` : ''}
              ${proximas.length > 0 ? `<div style="background:#d1fae5;border-radius:8px;padding:10px 16px;text-align:center"><div style="font-size:20px;font-weight:700;color:#059669">${proximas.length}</div><div style="font-size:11px;color:#065f46">🟢 Vence en 7d</div></div>` : ''}
            </div>

            ${totalMora > 0 ? `<p style="font-size:14px;color:#dc2626;font-weight:600">Total en mora: ${fmt(totalMora)}</p>` : ''}

            ${seccionHTML('⚠️ URGENTES — Más de 60 días de mora', '#7c3aed', urgentes)}
            ${seccionHTML('🔴 EN MORA — 31 a 60 días', '#dc2626', criticas)}
            ${seccionHTML('🟡 MORA RECIENTE — 1 a 30 días', '#d97706', recientes)}
            ${seccionHTML('🟢 PRÓXIMAS A VENCER — En los próximos 7 días', '#059669', proximas, false)}

            <p style="font-size:12px;color:#7a8fbb;margin-top:28px;border-top:1px solid #f0f0f0;padding-top:16px">
              Este mail fue generado automáticamente por el sistema de cobranzas de ASAP Consulting.
            </p>
          </div>
        </div>
      </body>
      </html>
    `

    const tieneUrgentes = urgentes.length > 0
    const subject = `${tieneUrgentes ? '⚠️ URGENTE · ' : ''}Reporte de mora · ${ejecutivo} · ${hoy.toLocaleDateString('es-AR')}`

    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: email,
        subject,
        html
      })
      console.log(`✅ Mail enviado a ${ejecutivo} (${email}) — ${urgentes.length} urgentes, ${criticas.length} críticas, ${recientes.length} recientes, ${proximas.length} próximas`)
    } catch (err: any) {
      console.error(`❌ Error enviando a ${ejecutivo}:`, err.message)
    }
  }

  console.log('📧 Alertas enviadas')
}