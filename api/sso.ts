import express from 'express'
import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { verificarTokenWisoft, claveDesdeEnv, TokenInvalidoError } from '../backend/src/services/ssoWisoft'

// POST /api/sso  { token: "<jwt de WiSoft>" }
//
// 1. Valida el JWT de WiSoft (firma HS512, aud "cobranzas", vencimiento).
// 2. Verifica que no se haya usado antes (un token = un ingreso).
// 3. Busca el usuario de Supabase con ese email y que tenga fila en `perfiles`.
// 4. Devuelve un token_hash de un solo uso; el frontend lo canjea con
//    supabase.auth.verifyOtp y queda con una sesión normal de Supabase,
//    así que las políticas RLS por rol/ejecutivo se aplican igual que siempre.

const app = express()
app.use(express.json({ limit: '16kb' }))

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SIN_ACCESO = 'Tu usuario de WiSoft no tiene acceso a Cobranzas. Pedí el alta a Administración.'

app.post('*', async (req, res) => {
  const secreto = process.env.WISOFT_SSO_SECRET
  if (!secreto) {
    console.error('SSO: falta la variable WISOFT_SSO_SECRET')
    res.status(500).json({ error: 'El ingreso desde WiSoft no está configurado.' })
    return
  }

  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
  if (!token) { res.status(400).json({ error: 'Falta el token de ingreso.' }); return }

  try {
    const claims = verificarTokenWisoft(token, claveDesdeEnv(secreto, process.env.WISOFT_SSO_SECRET_ENCODING))
    const email = claims.email.trim().toLowerCase()

    // Un token sirve una sola vez: guardamos su hash hasta que vence.
    await supabase.from('sso_tokens_usados').delete().lt('expira_el', new Date().toISOString())
    const hash = createHash('sha256').update(token).digest('hex')
    const { error: errorUso } = await supabase.from('sso_tokens_usados').insert({
      hash,
      email,
      wisoft_sub: String(claims.sub ?? ''),
      expira_el: new Date(claims.exp * 1000).toISOString(),
    })
    if (errorUso) {
      if (errorUso.code === '23505') {
        res.status(401).json({ error: 'Este link de ingreso ya se usó. Volvé a entrar desde WiSoft.' })
        return
      }
      throw errorUso
    }

    const { data: userId, error: errorUsuario } = await supabase.rpc('sso_usuario_por_email', { p_email: email })
    if (errorUsuario) throw errorUsuario
    if (!userId) {
      console.warn(`SSO: ${email} no existe en Supabase`)
      res.status(403).json({ error: SIN_ACCESO })
      return
    }

    const { data: perfil, error: errorPerfil } = await supabase
      .from('perfiles').select('rol').eq('id', userId).maybeSingle()
    if (errorPerfil) throw errorPerfil
    if (!perfil) {
      console.warn(`SSO: ${email} no tiene fila en perfiles`)
      res.status(403).json({ error: SIN_ACCESO })
      return
    }

    const { data: link, error: errorLink } = await supabase.auth.admin.generateLink({ type: 'magiclink', email })
    if (errorLink || !link?.properties?.hashed_token) throw errorLink ?? new Error('No se pudo generar el ingreso')

    console.log(`SSO: ingreso de ${email} (WiSoft ${claims.nombreUsuario ?? claims.sub}) como ${perfil.rol}`)
    res.json({ token_hash: link.properties.hashed_token })
  } catch (error: any) {
    if (error instanceof TokenInvalidoError) {
      console.warn('SSO: token rechazado -', error.message)
      res.status(401).json({ error: 'El link de ingreso no es válido o venció. Volvé a entrar desde WiSoft.' })
      return
    }
    console.error('SSO: error inesperado', error)
    res.status(500).json({ error: 'No se pudo completar el ingreso. Probá de nuevo en unos minutos.' })
  }
})

export default app
