import { Toaster } from 'sonner'
import { useThemeStore } from '@/stores/themeStore'

/**
 * App-wide toast outlet. Matches the active theme and sits above the bottom
 * player bar so it never hides behind it.
 */
export function AppToaster() {
  const theme = useThemeStore((s) => s.theme)
  return (
    <Toaster
      theme={theme}
      richColors
      position="bottom-center"
      offset={104}
      toastOptions={{ duration: 3000 }}
    />
  )
}
