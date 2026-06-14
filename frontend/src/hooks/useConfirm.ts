import { createContext, useContext } from 'react'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  /** Styles the confirm button as destructive (red). */
  danger?: boolean
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

export const ConfirmContext = createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm must be used within <ConfirmProvider>')
  return confirm
}
