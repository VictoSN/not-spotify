import { toast } from 'sonner'

/**
 * Thin wrapper over sonner so call sites stay consistent and the toast library
 * can be swapped in one place. Use to surface caught errors instead of
 * swallowing them silently (see FEATURE_GAP_REPORT §5.2).
 */
export const notify = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  info: (message: string) => toast(message),
}
