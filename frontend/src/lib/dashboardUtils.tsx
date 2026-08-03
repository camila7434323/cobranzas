export const DASH_BAR_COLORS = ['#2554a0','#dc2626','#059669','#d97706','#7c3aed','#0891b2','#9d174d','#65a30d','#ea580c','#0f766e']
export const EXEC_PIE_COLORS = ['#1d4170','#0f766e','#7c3aed','#b45309','#0369a1','#15803d','#9f1239','#1e3a5f','#6d28d9','#065f46']

export function svgPie(items: { value: number; color: string }[], size = 160) {
  const total = items.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null
  const r = size / 2; const cx = r; const cy = r
  const toXY = (angle: number) => ({
    x: cx + r * Math.cos((angle - 90) * Math.PI / 180),
    y: cy + r * Math.sin((angle - 90) * Math.PI / 180),
  })
  let cum = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {items.map((d, i) => {
        const start = (cum / total) * 360
        cum += d.value
        const end = (cum / total) * 360
        const s = toXY(start); const e = toXY(end < 360 ? end : 359.99)
        const large = end - start > 180 ? 1 : 0
        return <path key={i} d={`M${cx} ${cy} L${s.x} ${s.y} A${r} ${r} 0 ${large} 1 ${e.x} ${e.y}Z`} fill={d.color} />
      })}
    </svg>
  )
}
