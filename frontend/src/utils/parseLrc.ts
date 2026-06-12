export interface LyricLine {
  timeMs: number
  text: string
}

// Matches LRC time tags like [01:23.45], [1:23], [01:23.456]
const TIME_TAG = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g

/**
 * Parses LRC-format synced lyrics ("[mm:ss.xx] line") into sorted timed lines.
 * A line may carry several time tags (repeated chorus) — it's emitted once per tag.
 * Returns null when the text has fewer than 2 timed lines, so callers can fall
 * back to plain-text rendering instead of a degenerate karaoke view.
 */
export function parseLrc(lrc: string): LyricLine[] | null {
  const lines: LyricLine[] = []

  for (const raw of lrc.split('\n')) {
    const tags: number[] = []
    TIME_TAG.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = TIME_TAG.exec(raw)) !== null) {
      const minutes = Number(match[1])
      const seconds = Number(match[2])
      // Fraction may be 1-3 digits; pad to milliseconds ("4" → 400ms, "45" → 450ms)
      const ms = Number((match[3] ?? '0').padEnd(3, '0').slice(0, 3))
      tags.push(minutes * 60_000 + seconds * 1_000 + ms)
    }
    if (tags.length === 0) continue

    const text = raw.replace(TIME_TAG, '').trim()
    for (const timeMs of tags) lines.push({ timeMs, text })
  }

  if (lines.length < 2) return null
  return lines.sort((a, b) => a.timeMs - b.timeMs)
}

/** Index of the line currently being sung, or -1 before the first line. */
export function activeLineIndex(lines: LyricLine[], positionMs: number): number {
  let active = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= positionMs) active = i
    else break
  }
  return active
}
