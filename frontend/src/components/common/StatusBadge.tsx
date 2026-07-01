import { CheckCircleIcon, ClockIcon, XCircleIcon } from '@heroicons/react/24/outline'

const STATUS_CONFIG = {
  approved: { label: 'Live', icon: CheckCircleIcon, cls: 'text-green-400', bg: 'bg-green-500/15' },
  pending: { label: 'Pending', icon: ClockIcon, cls: 'text-yellow-400', bg: 'bg-yellow-500/15' },
  rejected: { label: 'Rejected', icon: XCircleIcon, cls: 'text-red-400', bg: 'bg-red-500/15' },
}

/** Artist-facing review-status pill (Live/Pending/Rejected) shared by the artist dashboard and its media managers. */
export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  )
}
