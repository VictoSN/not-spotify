import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { ConfirmContext, type ConfirmFn, type ConfirmOptions } from '@/hooks/useConfirm'

/**
 * Renders one accessible confirmation dialog and exposes `confirm()` via context.
 * Headless UI provides the focus trap, Escape handling, and focus restoration.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      // A second request supersedes the first instead of leaving its promise pending.
      resolver.current?.(false)
      resolver.current = resolve
      setOptions(opts)
    })
  }, [])

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result)
    resolver.current = null
    setOptions(null)
  }, [])

  useEffect(
    () => () => {
      resolver.current?.(false)
      resolver.current = null
    },
    [],
  )

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={options !== null} onClose={() => settle(false)} className="relative z-[70]">
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-lg bg-elevated p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              {options?.danger && (
                <ExclamationTriangleIcon className="h-6 w-6 shrink-0 text-red-400" />
              )}
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold text-primary">
                  {options?.title}
                </DialogTitle>
                {options?.message && (
                  <p className="mt-2 text-sm text-secondary">{options.message}</p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                autoFocus
                type="button"
                onClick={() => settle(false)}
                className="rounded-full border border-secondary/40 px-5 py-2 text-sm font-semibold text-primary transition-colors hover:border-primary"
              >
                {options?.cancelText ?? 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => settle(true)}
                className={
                  options?.danger
                    ? 'rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600'
                    : 'rounded-full bg-accent px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-accent-dark'
                }
              >
                {options?.confirmText ?? 'Confirm'}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  )
}
