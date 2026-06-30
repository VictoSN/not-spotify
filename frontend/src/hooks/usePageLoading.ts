import { useLayoutEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { AppShellOutletContext } from '@/components/layout/appShellContext'

/** Keeps shell-owned UI, such as the global footer, behind a page's load boundary. */
export function usePageLoading(loading: boolean) {
  const outletContext = useOutletContext<AppShellOutletContext | null>()
  const setPageLoading = outletContext?.setPageLoading

  useLayoutEffect(() => {
    setPageLoading?.(loading)
    return () => setPageLoading?.(false)
  }, [loading, setPageLoading])
}
