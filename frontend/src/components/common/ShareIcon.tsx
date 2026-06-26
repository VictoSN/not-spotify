import { cn } from '@/utils/cn'

export function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('stroke-[2.25]', className)}
      aria-hidden="true"
    >
      <path d="M12 3v11" />
      <path d="m7.6 7 4.4-4 4.4 4" />
      <path d="M5 10v9h14v-9" />
    </svg>
  )
}
