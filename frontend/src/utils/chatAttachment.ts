/**
 * Chat file attachments over a text-only channel.
 *
 * Messages travel and persist as a plain string body capped at 4000 chars
 * (PresenceHub.MaxBodyLength) — there is no file/blob storage for chat. So an
 * attachment is encoded INTO the body as a sentinel token, exactly like the
 * `ns:share:*` cards (see utils/chatShare.ts): zero backend change, and the
 * recipient's client detects the token and renders a rich bubble.
 *
 * Images are downscaled + re-encoded to a JPEG data URL small enough to fit the
 * body budget, so a real (if compact) photo actually reaches the other side and
 * survives a reload. Documents/videos can't fit their bytes, so they ride as a
 * metadata card (name + size + kind) instead.
 *
 * Token layout is NEWLINE-delimited (not colon-delimited like ns:share) because
 * a data URL is full of ':', ';' and ',' — newlines never appear inside one:
 *
 *   ns:att:1\n<kind>\n<name>\n<size>\n<mime>\n<dataUrl?>
 */

const ATT_PREFIX = 'ns:att:1\n'
// Leave comfortable headroom under the backend's 4000-char body cap for the
// prefix + kind + name (≤120) + size + mime lines; the data URL is kept under this.
const MAX_DATAURL_CHARS = 3600

export type AttachmentKind = 'image' | 'video' | 'file'

export interface ParsedAttachment {
  kind: AttachmentKind
  name: string
  /** Original file size in bytes (0 when unknown). */
  size: number
  mime: string
  /** Inline preview (JPEG data URL) — only present for images that fit the budget. */
  dataUrl: string | null
}

function sanitizeName(name: string): string {
  return name.replace(/[\r\n]+/g, ' ').trim().slice(0, 120) || 'file'
}

function encodeAttachment(a: {
  kind: AttachmentKind
  name: string
  size: number
  mime: string
  dataUrl?: string | null
}): string {
  return [
    'ns:att:1',
    a.kind,
    sanitizeName(a.name),
    String(Math.max(0, Math.round(a.size)) || 0),
    (a.mime || '').replace(/[\r\n]+/g, ''),
    a.dataUrl ?? '',
  ].join('\n')
}

/** Detects an attachment token. Returns null for plain text / other tokens. */
export function parseAttachment(body: string): ParsedAttachment | null {
  if (!body.startsWith(ATT_PREFIX)) return null
  const lines = body.split('\n')
  if (lines.length < 5) return null
  const kind = lines[1]
  if (kind !== 'image' && kind !== 'video' && kind !== 'file') return null
  const dataUrl = lines.slice(5).join('\n')
  return {
    kind,
    name: lines[2] || 'file',
    size: Number(lines[3]) || 0,
    mime: lines[4] || '',
    dataUrl: dataUrl.startsWith('data:') ? dataUrl : null,
  }
}

/** Human-readable file size, e.g. 2.4 MB. Empty string for unknown/zero. */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const rounded = value >= 10 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unit]}`
}

/** One-line preview for the conversation list / search, e.g. "📷 Photo". */
export function attachmentPreviewLabel(attachment: ParsedAttachment): string {
  if (attachment.kind === 'image') return '📷 Photo'
  if (attachment.kind === 'video') return '🎥 Video'
  return '📄 Document'
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not decode image'))
    }
    img.src = url
  })
}

function drawToJpeg(img: HTMLImageElement, maxDim: number, quality: number): string | null {
  const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1
  const scale = Math.min(1, maxDim / longest)
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, w, h)
  try {
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return null // tainted canvas / unsupported — fall back to a metadata card
  }
}

// Progressively smaller dimensions + quality until the data URL fits the body
// budget. A photo channelled through a text message can only be a small preview.
const IMAGE_STEPS: ReadonlyArray<{ max: number; quality: number }> = [
  { max: 320, quality: 0.5 },
  { max: 288, quality: 0.45 },
  { max: 256, quality: 0.42 },
  { max: 224, quality: 0.4 },
  { max: 192, quality: 0.38 },
  { max: 160, quality: 0.36 },
  { max: 128, quality: 0.34 },
  { max: 96, quality: 0.3 },
]

async function compressImageToDataUrl(file: File): Promise<string | null> {
  const img = await loadImage(file)
  for (const step of IMAGE_STEPS) {
    const url = drawToJpeg(img, step.max, step.quality)
    if (url && url.length <= MAX_DATAURL_CHARS) return url
  }
  return null
}

/**
 * Turn a picked file into a message body. Images become an inline preview bubble
 * when they can be squeezed under the body budget; everything else (and images
 * that can't fit) becomes a metadata card.
 */
export async function buildAttachmentToken(file: File): Promise<string> {
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')

  if (isImage) {
    try {
      const dataUrl = await compressImageToDataUrl(file)
      if (dataUrl) {
        return encodeAttachment({ kind: 'image', name: file.name, size: file.size, mime: file.type, dataUrl })
      }
    } catch {
      /* decode failed — fall through to a metadata card */
    }
  }

  return encodeAttachment({
    kind: isImage ? 'image' : isVideo ? 'video' : 'file',
    name: file.name,
    size: file.size,
    mime: file.type,
  })
}
