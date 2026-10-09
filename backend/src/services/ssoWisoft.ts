import { createHmac, timingSafeEqual } from 'crypto'

// Token de ingreso que genera WiSoft (Talent) al hacer clic en "Cobranzas".
// Formato acordado con el equipo de Talent:
//   - JWT firmado con HS512 y un secreto exclusivo para Cobranzas
//   - claims: sub, email, nombre, nombreUsuario, aud = "cobranzas", iat, exp (5 min)
//   - no trae roles: los permisos se definen en Cobranzas (tabla perfiles)

export interface ClaimsWisoft {
  sub: string
  email: string
  nombre?: string
  nombreUsuario?: string
  aud: string | string[]
  iat?: number
  exp: number
}

export class TokenInvalidoError extends Error {}

const AUDIENCIA = 'cobranzas'
const TOLERANCIA_RELOJ_SEG = 30

function base64UrlDecode(parte: string): Buffer {
  const b64 = parte.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(b64 + '='.repeat((4 - (b64.length % 4)) % 4), 'base64')
}

// El secreto puede venir como texto plano o en base64 (muchas librerías Java,
// como la que usa Rentabilidad, lo manejan en base64). Se elige con
// WISOFT_SSO_SECRET_ENCODING = "utf8" (default) o "base64".
export function claveDesdeEnv(secreto: string, encoding: string | undefined): Buffer {
  return encoding === 'base64' ? Buffer.from(secreto, 'base64') : Buffer.from(secreto, 'utf8')
}

export function verificarTokenWisoft(token: string, clave: Buffer, ahoraSeg = Math.floor(Date.now() / 1000)): ClaimsWisoft {
  const partes = token.split('.')
  if (partes.length !== 3) throw new TokenInvalidoError('Formato de token inválido')
  const [h, p, firma] = partes

  let header: { alg?: string }
  let claims: ClaimsWisoft
  try {
    header = JSON.parse(base64UrlDecode(h).toString('utf8'))
    claims = JSON.parse(base64UrlDecode(p).toString('utf8'))
  } catch {
    throw new TokenInvalidoError('Token ilegible')
  }

  // Solo aceptamos HS512: evita que alguien mande un token con alg "none" u otro.
  if (header.alg !== 'HS512') throw new TokenInvalidoError('Algoritmo no permitido')

  const esperada = createHmac('sha512', clave).update(`${h}.${p}`).digest()
  const recibida = base64UrlDecode(firma)
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) {
    throw new TokenInvalidoError('Firma inválida')
  }

  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!aud.includes(AUDIENCIA)) throw new TokenInvalidoError('Token no emitido para Cobranzas')
  if (typeof claims.exp !== 'number') throw new TokenInvalidoError('Token sin vencimiento')
  if (claims.exp + TOLERANCIA_RELOJ_SEG < ahoraSeg) throw new TokenInvalidoError('Token vencido')
  if (typeof claims.iat === 'number' && claims.iat - TOLERANCIA_RELOJ_SEG > ahoraSeg) {
    throw new TokenInvalidoError('Token emitido en el futuro')
  }
  if (!claims.email || typeof claims.email !== 'string') throw new TokenInvalidoError('Token sin email')

  return claims
}
