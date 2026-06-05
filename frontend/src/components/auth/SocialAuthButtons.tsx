import { cn } from '@/utils/cn'

type Provider = 'google' | 'facebook' | 'apple'

const providers: { id: Provider; label: string }[] = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'facebook', label: 'Continue with Facebook' },
  { id: 'apple', label: 'Continue with Apple' },
]

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.03 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.27h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-primary">
      <path fill="currentColor" d="M16.37 1.43c0 1.14-.46 2.2-1.2 2.99-.8.86-2.11 1.52-3.17 1.43-.14-1.1.4-2.26 1.13-3.05.81-.88 2.22-1.54 3.24-1.37zM20.5 17.23c-.58 1.35-.86 1.95-1.6 3.14-1.04 1.58-2.5 3.55-4.31 3.57-1.61.02-2.03-1.04-4.22-1.03-2.19.01-2.65 1.06-4.26 1.04-1.81-.02-3.19-1.79-4.23-3.37C-1.02 16.1-.35 10.8 3.15 8.67c1.74-1.06 4-1.09 5.38-.37 1.38.72 2.25.72 4.03-.16 1.35-.67 3.67-.46 5.25.86-4.61 2.53-3.86 9.1.69 8.23z" />
    </svg>
  )
}

function ProviderIcon({ provider }: { provider: Provider }) {
  if (provider === 'google') return <GoogleIcon />
  if (provider === 'facebook') return <FacebookIcon />
  return <AppleIcon />
}

export function SocialAuthButtons({ onUnavailable, className }: { onUnavailable: (provider: Provider) => void; className?: string }) {
  return (
    <div className={cn('grid gap-2', className)}>
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => onUnavailable(provider.id)}
          className="relative flex h-12 w-full items-center justify-center rounded-full border border-secondary/50 bg-transparent px-4 text-sm font-bold text-primary transition-all hover:border-primary hover:bg-elevated/60 active:scale-[0.99]"
        >
          <span className="absolute left-6">
            <ProviderIcon provider={provider.id} />
          </span>
          {provider.label}
        </button>
      ))}
    </div>
  )
}
