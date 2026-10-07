export const DASH_BAR_COLORS = ['#5b8def','#f87171','#34d399','#fbbf24','#a78bfa','#22d3ee','#f472b6','#a3e635','#fb923c','#2dd4bf']
export const EXEC_PIE_COLORS = ['#5b8def','#2dd4bf','#a78bfa','#fbbf24','#38bdf8','#4ade80','#fb7185','#94a3b8','#c084fc','#34d399']

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
