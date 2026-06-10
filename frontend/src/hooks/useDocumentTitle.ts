import { useEffect } from 'react'

/**
 * Sets the browser tab title to "{title} | not-spotify".
 * Pass null/undefined to leave the title unchanged.
 * The previous title is restored on unmount.
 */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return
    const prev = document.title
    document.title = `${title} | not-spotify`
    return () => {
      document.title = prev
    }
  }, [title])
}
