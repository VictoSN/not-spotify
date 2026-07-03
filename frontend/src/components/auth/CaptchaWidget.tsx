import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

/**
 * Google reCAPTCHA v2 checkbox. Rendered only when the backend reports captcha
 * as enabled (GET /auth/captcha); tokens are single-use, so callers must reset()
 * after every failed submit.
 */

interface GrecaptchaApi {
  render: (
    container: HTMLElement,
    params: {
      sitekey: string
      theme?: 'light' | 'dark'
      callback?: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
    },
  ) => number
  reset: (widgetId?: number) => void
}

declare global {
  interface Window {
    grecaptcha?: GrecaptchaApi
    __onRecaptchaLoad?: () => void
  }
}

let scriptPromise: Promise<GrecaptchaApi> | null = null

function loadRecaptcha(): Promise<GrecaptchaApi> {
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      window.__onRecaptchaLoad = () => resolve(window.grecaptcha!)
      const script = document.createElement('script')
      script.src = 'https://www.google.com/recaptcha/api.js?onload=__onRecaptchaLoad&render=explicit'
      script.async = true
      script.defer = true
      script.onerror = () => {
        scriptPromise = null
        reject(new Error('Failed to load reCAPTCHA'))
      }
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

export interface CaptchaWidgetHandle {
  reset: () => void
}

interface CaptchaWidgetProps {
  siteKey: string
  /** Called with the solved token, or null when it expires/errors. */
  onToken: (token: string | null) => void
  className?: string
}

export const CaptchaWidget = forwardRef<CaptchaWidgetHandle, CaptchaWidgetProps>(
  function CaptchaWidget({ siteKey, onToken, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const widgetIdRef = useRef<number | null>(null)
    const onTokenRef = useRef(onToken)
    onTokenRef.current = onToken

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current !== null) window.grecaptcha?.reset(widgetIdRef.current)
        onTokenRef.current(null)
      },
    }), [])

    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      let cancelled = false
      // grecaptcha can't render twice into the same node (StrictMode remounts),
      // so each mount gets a fresh child node that cleanup throws away.
      const mount = document.createElement('div')
      container.appendChild(mount)

      loadRecaptcha()
        .then((grecaptcha) => {
          if (cancelled) return
          const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
          widgetIdRef.current = grecaptcha.render(mount, {
            sitekey: siteKey,
            theme,
            callback: (token) => onTokenRef.current(token),
            'expired-callback': () => onTokenRef.current(null),
            'error-callback': () => onTokenRef.current(null),
          })
        })
        .catch(() => {
          /* script blocked/offline — backend still enforces, submit will surface the error */
        })

      return () => {
        cancelled = true
        widgetIdRef.current = null
        mount.remove()
      }
    }, [siteKey])

    return <div ref={containerRef} className={className} />
  },
)
