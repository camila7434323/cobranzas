import { supabase } from './supabase'

// Duración máxima de la sesión, igual que Rentabilidad: 10 horas desde que
// se ingresó. Pasado ese tiempo se cierra y hay que volver a entrar.
export const DURACION_SESION_MS = 10 * 60 * 60 * 1000
const CLAVE = 'asap_sesion_inicio'

export function marcarInicioSesion() {
  try { localStorage.setItem(CLAVE, String(Date.now())) } catch { /* sin storage: no se limita */ }
}

export function limpiarInicioSesion() {
  try { localStorage.removeItem(CLAVE) } catch { /* nada */ }
}

// Devuelve true si la sesión ya superó las 10 hs (y la cierra).
// Si no hay marca (por ejemplo, ingreso con contraseña), empieza a contar ahora.
export async function controlarVencimientoSesion(): Promise<boolean> {
  let inicio: number | null = null
  try { inicio = Number(localStorage.getItem(CLAVE)) || null } catch { return false }
  if (!inicio) { marcarInicioSesion(); return false }
  if (Date.now() - inicio < DURACION_SESION_MS) return false
  limpiarInicioSesion()
  await supabase.auth.signOut()
  return true
}
