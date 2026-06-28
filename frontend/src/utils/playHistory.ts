const KEY = 'ns-play-history'

type HistoryMap = Record<string, string>

function read(): HistoryMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export const PLAY_HISTORY_EVENT = 'ns-play-history-change'

export function recordPlay(kind: string, id: string): void {
  try {
    const map = read()
    map[`${kind}:${id}`] = new Date().toISOString()
    localStorage.setItem(KEY, JSON.stringify(map))
    window.dispatchEvent(new CustomEvent(PLAY_HISTORY_EVENT))
  } catch {
    /* ignore */
  }
}

export function getPlayHistory(): HistoryMap {
  return read()
}
