/**
 * Shares an in-app link: uses the native share sheet when available (mobile),
 * otherwise copies the URL to the clipboard. Returns how it was handled so the
 * caller can show a "Copied" hint when appropriate.
 */
export async function shareLink(
  path: string,
  opts: { title?: string; text?: string } = {},
): Promise<'shared' | 'copied' | 'failed'> {
  const url = `${window.location.origin}${path}`
  if (navigator.share) {
    try {
      await navigator.share({ title: opts.title, text: opts.text, url })
      return 'shared'
    } catch {
      /* cancelled or unsupported — fall through to clipboard */
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
