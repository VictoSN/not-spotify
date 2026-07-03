// Cover thumbnails via the serverless microservice (aws/thumbnail-lambda).
// Grid/card views can prefer thumbUrl() and fall back to the original
// presigned cover URL when the API is not configured — fail-open by design.
const THUMB_API = import.meta.env.VITE_THUMB_API as string | undefined
// e.g. https://abc123.execute-api.us-east-1.amazonaws.com

export function thumbUrl(coverKey: string | null | undefined): string | null {
  if (!coverKey || !THUMB_API) return null
  return `${THUMB_API}/thumbnail/${encodeURIComponent(coverKey)}`
}
