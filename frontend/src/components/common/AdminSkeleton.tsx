import { cn } from '@/utils/cn'

interface AdminTableSkeletonProps {
  rows?: number
  columns?: number
  className?: string
}

/**
 * Row-shaped placeholder for admin list pages. Matches the visual footprint of
 * the real table (rounded surface + header row + N body rows) so navigating in
 * doesn't jerk the layout.
 */
export function AdminTableSkeleton({ rows = 6, columns = 5, className }: AdminTableSkeletonProps) {
  const cols = Array.from({ length: columns }, (_, i) => i)
  return (
    <div
      className={cn('bg-surface rounded-lg border border-elevated/40 overflow-hidden', className)}
      role="status"
      aria-label="Loading data"
    >
      <div className="grid gap-4 border-b border-elevated/40 px-4 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {cols.map((c) => (
          <div key={c} className="h-3 w-16 rounded bg-elevated/70 animate-pulse" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="grid gap-4 border-b border-elevated/30 px-4 py-4 last:border-b-0"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {cols.map((c) => (
            <div key={c} className={cn('h-4 rounded bg-elevated/60 animate-pulse', c === 0 ? 'w-8' : c === columns - 1 ? 'w-16 justify-self-end' : 'w-full max-w-[180px]')} />
          ))}
        </div>
      ))}
    </div>
  )
}

interface AdminCardGridSkeletonProps {
  count?: number
  className?: string
}

/**
 * Card-grid placeholder for admin pages that render a grid of tiles instead of
 * a table (advertisements, playlists preview, etc).
 */
export function AdminCardGridSkeleton({ count = 6, className }: AdminCardGridSkeletonProps) {
  return (
    <div
      className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}
      role="status"
      aria-label="Loading data"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-surface rounded-lg border border-elevated/40 p-4">
          <div className="h-32 w-full rounded-md bg-elevated/60 animate-pulse" />
          <div className="mt-4 h-4 w-2/3 rounded bg-elevated/60 animate-pulse" />
          <div className="mt-2 h-3 w-1/2 rounded bg-elevated/50 animate-pulse" />
        </div>
      ))}
    </div>
  )
}

interface AdminBubbleFilterSkeletonProps {
  count?: number
  className?: string
}

/**
 * Placeholder for the pill-shaped tab row (Pending / Approved / All …) so the
 * bubble filter doesn't flash empty before its content loads.
 */
export function AdminBubbleFilterSkeleton({ count = 4, className }: AdminBubbleFilterSkeletonProps) {
  return (
    <div className={cn('flex gap-2 flex-wrap', className)} role="status" aria-label="Loading filters">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-8 w-24 rounded-full bg-elevated/60 animate-pulse" />
      ))}
    </div>
  )
}

/**
 * Stat-tile placeholder for the dashboard overview page.
 */
export function AdminStatTilesSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)} role="status" aria-label="Loading stats">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-surface rounded-lg border border-elevated/40 p-5">
          <div className="h-3 w-20 rounded bg-elevated/60 animate-pulse" />
          <div className="mt-3 h-7 w-16 rounded bg-elevated/70 animate-pulse" />
          <div className="mt-3 h-3 w-32 rounded bg-elevated/50 animate-pulse" />
        </div>
      ))}
    </div>
  )
}
