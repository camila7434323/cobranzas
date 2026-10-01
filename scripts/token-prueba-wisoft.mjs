// Genera un token igual al que manda WiSoft, para probar el ingreso sin
// depender de Talent. Usar SOLO con el secreto de QA.
//
//   node scripts/token-prueba-wisoft.mjs <email> <url-base> <secreto> [base64]
//
// Ejemplo:
//   node scripts/token-prueba-wisoft.mjs joaquin.ramirez@asap-consulting.net https://cobranzas-qa.vercel.app "secreto-qa"
//
// Imprime la URL lista para abrir en el navegador (vale 5 minutos y un solo uso).
import { createHmac } from 'crypto'

const [email, urlBase, secreto, encoding] = process.argv.slice(2)
if (!email || !urlBase || !secreto) {
  console.error('Uso: node scripts/token-prueba-wisoft.mjs <email> <url-base> <secreto> [base64]')
  process.exit(1)
}

const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
const ahora = Math.floor(Date.now() / 1000)
const header = b64u({ alg: 'HS512', typ: 'JWT' })
const payload = b64u({
  sub: 'prueba', email, nombre: 'Usuario de prueba', nombreUsuario: email.split('@')[0],
  aud: 'cobranzas', iat: ahora, exp: ahora + 5 * 60,
})
const clave = encoding === 'base64' ? Buffer.from(secreto, 'base64') : Buffer.from(secreto, 'utf8')
const firma = createHmac('sha512', clave).update(`${header}.${payload}`).digest('base64url')

console.log(`${urlBase.replace(/\/$/, '')}/ingreso?auth=${header}.${payload}.${firma}`)
