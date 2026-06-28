import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  children?: ReactNode
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-accent',
          {
            'bg-accent hover:bg-accent-dark text-black': variant === 'primary',
            'bg-surface hover:bg-elevated text-primary': variant === 'secondary',
            'text-secondary hover:text-primary hover:bg-elevated/60': variant === 'ghost',
            'border border-secondary/40 text-primary hover:border-primary': variant === 'outline',
          },
          {
            'px-3 py-1.5 text-sm h-8': size === 'sm',
            'px-5 py-2.5 text-sm h-10': size === 'md',
            'px-8 py-3 text-base h-12': size === 'lg',
            'w-9 h-9 p-0 rounded-full': size === 'icon',
          },
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
export { Button }
