// Logo de ASAP (asap-logo.png, blanco con fondo transparente).

export const NAVY = '#2b3990'
export const AZUL = '#1a8fd0'

// Sin color: el logo tal cual (blanco, para fondos celestes). Con color: la misma
// imagen usada como máscara, para que se vea sobre fondos claros sin cambiar la forma.
export function LogoAsap({ alto = 40, color }: { alto?: number; color?: string }) {
  if (!color) return <img src="/asap-logo.png" alt="ASAP Consulting" style={{ height: alto, display: 'block' }} />
  const mascara = 'url(/asap-logo.png) center / contain no-repeat'
  return (
    <div role="img" aria-label="ASAP Consulting" style={{
      height: alto, aspectRatio: '800 / 320', margin: '0 auto', background: color,
      WebkitMask: mascara, mask: mascara,
    }} />
  )
}
