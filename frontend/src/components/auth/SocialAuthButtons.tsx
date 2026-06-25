import { cn } from '@/utils/cn'

type Provider = 'google' | 'facebook'

const providers: { id: Provider; label: string }[] = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'facebook', label: 'Continue with Facebook' },
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

function ProviderIcon({ provider }: { provider: Provider }) {
  if (provider === 'google') return <GoogleIcon />
  return <FacebookIcon />
}

export function SocialAuthButtons({
  onUnavailable,
  onProviderSuccess,
  showFacebook = false,
  className,
  googleHref,
  facebookHref,
}: {
  onUnavailable: (provider: Provider) => void
  onProviderSuccess?: (provider: Provider) => void | Promise<void>
  showFacebook?: boolean
  className?: string
  googleHref?: string | null
  facebookHref?: string | null
}) {
  const openOAuthPopup = (provider: Provider, href: string | null | undefined) => {
    if (!href) {
      onUnavailable(provider)
      return
    }

    const width = 520
    const height = 680
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2)
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2)
    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${Math.round(left)}`,
      `top=${Math.round(top)}`,
      'popup=yes',
      'resizable=yes',
      'scrollbars=yes',
    ].join(',')

    const popup = window.open(href, `notspotify-${provider}-oauth`, features)
    if (!popup) {
      window.location.assign(href)
      return
    }

    const expectedOrigin = new URL(href, window.location.href).origin
    let settled = false
    let closeTimer: number | undefined

    const cleanup = () => {
      settled = true
      window.removeEventListener('message', onMessage)
      if (closeTimer !== undefined) window.clearInterval(closeTimer)
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== expectedOrigin) return
      const data = event.data as { type?: string; provider?: string; status?: string } | null
      if (data?.type !== 'notspotify:oauth' || data.provider !== provider) return

      cleanup()
      popup.close()
      if (data.status === 'success') {
        void onProviderSuccess?.(provider)
      } else {
        onUnavailable(provider)
      }
    }

    window.addEventListener('message', onMessage)
    closeTimer = window.setInterval(() => {
      if (!settled && popup.closed) cleanup()
    }, 500)
  }

  return (
    <div className={cn('grid gap-2', className)}>
      {providers.filter((provider) => provider.id === 'google' || showFacebook).map((provider) => {
        const href = provider.id === 'google' ? googleHref : facebookHref
        const enabled = Boolean(href)
        return (
          <button
            key={provider.id}
            type="button"
            onClick={() => {
              if (enabled) {
                openOAuthPopup(provider.id, href)
              } else {
                onUnavailable(provider.id)
              }
            }}
            className="relative flex h-12 w-full items-center justify-center rounded-full border border-secondary/50 bg-transparent px-4 text-sm font-bold text-primary transition-all hover:border-primary hover:bg-elevated/60 active:scale-[0.99]"
          >
            <span className="absolute left-6">
              <ProviderIcon provider={provider.id} />
            </span>
            {provider.label}
          </button>
        )
      })}
    </div>
  )
}
