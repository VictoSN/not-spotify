/**
 * Library folders — a purely client-side grouping layer over the user's saved
 * library, alongside [[pinnedLibrary]]. Folders hold sidebar item keys
 * (`pl-<id>` / `al-<id>` / `ar-<id>`) and render as collapsible groups at the
 * top of Your Library. Persisted in localStorage (no backend / no migration);
 * changes broadcast on FOLDERS_EVENT so every open view updates in step (same
 * pattern the ns-pref-* settings use).
 *
 * An item lives in at most one folder: adding it to a folder removes it from any
 * other. Deleting a folder simply ungroups its items (they reappear in the flat
 * list). Item keys that no longer exist in the library are kept but ignored at
 * render time, so unfollowing then re-following restores grouping.
 */
export const FOLDERS_STORAGE_KEY = 'ns-library-folders'
export const FOLDERS_EVENT = 'ns-folders-change'

export interface LibraryFolder {
  id: string
  name: string
  itemKeys: string[]
  collapsed: boolean
}

function isFolder(value: unknown): value is LibraryFolder {
  if (!value || typeof value !== 'object') return false
  const f = value as Partial<LibraryFolder>
  return (
    typeof f.id === 'string' &&
    typeof f.name === 'string' &&
    Array.isArray(f.itemKeys) &&
    f.itemKeys.every((k) => typeof k === 'string')
  )
}

export function getFolders(): LibraryFolder[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(FOLDERS_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isFolder).map((f) => ({ ...f, collapsed: f.collapsed === true }))
  } catch {
    return []
  }
}

function save(next: LibraryFolder[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent(FOLDERS_EVENT))
  } catch {
    /* ignore persistence failures */
  }
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Create a folder and return it (caller can immediately add an item or rename). */
export function createFolder(name = 'New Folder'): LibraryFolder {
  const folder: LibraryFolder = { id: newId(), name: name.trim() || 'New Folder', itemKeys: [], collapsed: false }
  save([...getFolders(), folder])
  return folder
}

export function renameFolder(id: string, name: string) {
  const trimmed = name.trim()
  if (!trimmed) return
  save(getFolders().map((f) => (f.id === id ? { ...f, name: trimmed } : f)))
}

export function deleteFolder(id: string) {
  save(getFolders().filter((f) => f.id !== id))
}

export function setFolderCollapsed(id: string, collapsed: boolean) {
  save(getFolders().map((f) => (f.id === id ? { ...f, collapsed } : f)))
}

/** Add an item to a folder, removing it from any other folder first. */
export function addItemToFolder(folderId: string, key: string) {
  save(
    getFolders().map((f) => {
      if (f.id === folderId) {
        return f.itemKeys.includes(key) ? f : { ...f, itemKeys: [...f.itemKeys, key] }
      }
      return f.itemKeys.includes(key) ? { ...f, itemKeys: f.itemKeys.filter((k) => k !== key) } : f
    }),
  )
}

/** Remove an item from whichever folder it's in. */
export function removeItemFromFolder(key: string) {
  save(getFolders().map((f) => (f.itemKeys.includes(key) ? { ...f, itemKeys: f.itemKeys.filter((k) => k !== key) } : f)))
}

/** The id of the folder an item belongs to, or null. */
export function folderOfItem(folders: LibraryFolder[], key: string): string | null {
  return folders.find((f) => f.itemKeys.includes(key))?.id ?? null
}
