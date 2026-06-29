import { cn } from '@/utils/cn'

export const COLLECTION_PAGE_CLASS = 'px-4 py-6 sm:px-6 lg:px-8'
export const COLLECTION_GRID_CLASS = 'grid [grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))] gap-x-4 gap-y-7'
export const VIDEO_COLLECTION_GRID_CLASS = 'grid [grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))] gap-x-5 gap-y-7'

export function CollectionPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold text-primary">{title}</h1>
      <p className="mt-1 text-sm text-secondary">{description}</p>
    </header>
  )
}

export function CollectionPageSkeleton({
  label,
  variant = 'square',
  roundArtwork = false,
  count = 12,
}: {
  label: string
  variant?: 'square' | 'video'
  roundArtwork?: boolean
  count?: number
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(COLLECTION_PAGE_CLASS, 'min-h-[calc(100vh-6rem)] animate-pulse motion-reduce:animate-none')}
    >
      <div className="mb-8">
        <div className="h-8 w-52 max-w-[70%] rounded bg-elevated" />
        <div className="mt-3 h-3 w-80 max-w-[85%] rounded bg-primary/10" />
      </div>
      <div className={variant === 'video' ? VIDEO_COLLECTION_GRID_CLASS : COLLECTION_GRID_CLASS} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="min-w-0">
            <div
              className={cn(
                'w-full bg-elevated',
                variant === 'video' ? 'aspect-video rounded-md' : 'aspect-square',
                variant === 'square' && (roundArtwork ? 'rounded-full' : 'rounded-md'),
              )}
            />
            <div className="mt-3 h-3.5 w-4/5 rounded bg-primary/15" />
            <div className="mt-2 h-2.5 w-2/5 rounded bg-primary/10" />
          </div>
        ))}
      </div>
    </div>
  )
}
