import { type ReactNode } from 'react'

interface HorizontalScrollerProps {
  children: ReactNode
}

export function HorizontalScroller({ children }: HorizontalScrollerProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
      {children}
    </div>
  )
}
