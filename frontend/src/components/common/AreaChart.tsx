import { useId, useRef, useState } from 'react'

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
  /** Series name shown in the tooltip header. */
  seriesLabel?: string
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
  seriesLabel,
}: AreaChartProps) {
  const gradId = useId()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

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

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const step = (W - padX * 2) / Math.max(1, n - 1)
    const idx = Math.min(n - 1, Math.max(0, Math.round((px - padX) / step)))
    setHoverIdx(idx)
  }

  const active = hoverIdx != null ? data[hoverIdx] : null
  const wrapWidth = wrapRef.current?.getBoundingClientRect().width ?? 0
  const tipLeftPct = hoverIdx != null ? (x(hoverIdx) / W) * 100 : 0
  // Keep tooltip inside the container: nudge left if it would clip the right edge.
  const tipTranslate =
    wrapWidth && hoverIdx != null && (tipLeftPct / 100) * wrapWidth > wrapWidth - 90
      ? 'translate(-100%, -100%)'
      : wrapWidth && hoverIdx != null && (tipLeftPct / 100) * wrapWidth < 90
        ? 'translate(0, -100%)'
        : 'translate(-50%, -100%)'

  return (
    <div ref={wrapRef} className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height }}
        role="img"
        aria-label="Trend chart"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIdx(null)}
      >
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
        {hoverIdx != null && (
          <line
            x1={x(hoverIdx)}
            y1={padTop}
            x2={x(hoverIdx)}
            y2={H - padBottom}
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="1"
            strokeDasharray="4 4"
            className="text-secondary"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(d.value)}
            r={hoverIdx === i ? 6 : 4}
            fill={color}
            stroke={hoverIdx === i ? 'var(--c-base, #000)' : 'transparent'}
            strokeWidth={hoverIdx === i ? 2 : 0}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {active && hoverIdx != null && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-elevated/60 bg-elevated px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `${tipLeftPct}%`, top: 0, transform: `${tipTranslate} translateY(-6px)` }}
          role="tooltip"
        >
          {seriesLabel && <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">{seriesLabel}</div>}
          <div className="font-semibold text-primary">{formatValue(active.value)}</div>
          <div className="text-[11px] text-secondary">{active.label}</div>
        </div>
      )}
      <div className="mt-1 flex justify-between px-1 text-[10px] text-muted">
        {data.map((d, i) => (
          <span key={i} className={i % tickEvery === 0 || i === n - 1 ? '' : 'invisible'}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}
