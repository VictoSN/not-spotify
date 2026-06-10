import * as RadixSlider from '@radix-ui/react-slider'
import { cn } from '@/utils/cn'

interface SliderProps {
  value: number
  min?: number
  max?: number
  step?: number
  onValueChange: (value: number) => void
  onValueCommit?: (value: number) => void
  className?: string
  trackClassName?: string
  thumbClassName?: string
  'aria-label'?: string
}

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  onValueCommit,
  className,
  trackClassName,
  thumbClassName,
  'aria-label': ariaLabel,
}: SliderProps) {
  return (
    <RadixSlider.Root
      className={cn('relative flex items-center select-none touch-none w-full h-4 group', className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([v]) => onValueChange(v)}
      onValueCommit={([v]) => onValueCommit?.(v)}
      aria-label={ariaLabel}
    >
      <RadixSlider.Track
        className={cn(
          'relative grow rounded-full h-1 bg-elevated group-hover:h-1.5 transition-all',
          trackClassName,
        )}
      >
        <RadixSlider.Range className="absolute bg-primary rounded-full h-full group-hover:bg-accent transition-colors" />
      </RadixSlider.Track>
      <RadixSlider.Thumb
        className={cn(
          'block w-3 h-3 bg-primary rounded-full shadow-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity focus:outline-none focus:opacity-100',
          thumbClassName,
        )}
      />
    </RadixSlider.Root>
  )
}
