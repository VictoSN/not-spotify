import { useId } from 'react'

export interface AreaPoint {
  label: string
  value: number
}

interface AreaChartProps {
  data: AreaPoint[]
  height?: number
  /** CSS color for the line/fill. Defaults to the app accent. */
  color?: string
  /** How many x-axis labels to show (evenly spaced). */
  ticks?: number
  formatValue?: (n: number) => string
}

/**
 * Lightweight dependency-free SVG area chart (smooth-ish polyline + gradient
 * fill) for dashboards. Scales to its container width via a 0–1000 viewBox.
 */
export function AreaChart({
  data,
  height = 160,
  color = 'var(--c-accent, #1db954)',
  ticks = 6,
  formatValue = (n) => String(n),
}: AreaChartProps) {
  const gradId = useId()
  const W = 1000
  const H = 300
  const padX = 8
  const padTop = 16
  const padBottom = 4

  if (data.length === 0) {
    return <div className="flex items-center justify-center rounded-lg border border-elevated/40 bg-base/35 text-sm text-secondary" style={{ height }}>No data</div>
  }

  const max = Math.max(...data.map((d) => d.value), 1)
  const n = data.length
  const x = (i: number) => padX + (i * (W - padX * 2)) / Math.max(1, n - 1)
  const y = (v: number) => padTop + (1 - v / max) * (H - padTop - padBottom)

  const linePts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const areaPath = `M ${x(0).toFixed(1)},${(H - padBottom).toFixed(1)} L ${linePts.split(' ').join(' L ')} L ${x(n - 1).toFixed(1)},${(H - padBottom).toFixed(1)} Z`

  const tickEvery = Math.max(1, Math.ceil(n / ticks))

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height }} role="img" aria-label="Trend chart">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* baseline */}
        <line x1={padX} y1={H - padBottom} x2={W - padX} y2={H - padBottom} stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" className="text-secondary" />
        <path d={areaPath} fill={`url(#${gradId})`} />
        <polyline points={linePts} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.value)} r="4" fill={color} vectorEffect="non-scaling-stroke">
            <title>{`${d.label}: ${formatValue(d.value)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-1 text-[10px] text-muted">
        {data.map((d, i) => (
          <span key={i} className={i % tickEvery === 0 || i === n - 1 ? '' : 'invisible'}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}
