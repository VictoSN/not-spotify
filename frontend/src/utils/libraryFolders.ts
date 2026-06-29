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

// ── Folder nesting utilities (bug 32) ────────────────────────────────

/** Prefix for folder keys in itemKeys arrays, e.g. "fold-abc-123". */
export const FOLDER_KEY_PREFIX = 'fold-'

/** Maximum nesting depth for folders (0 = root, 1 = inside a folder, etc.). */
export const MAX_FOLDER_DEPTH = 3

/** Compose a key for a folder, e.g. "fold-abc-123". */
export function folderKey(folderId: string): string {
  return `${FOLDER_KEY_PREFIX}${folderId}`
}

/** Extract the folder id from a folder key, e.g. "fold-abc-123" → "abc-123". Returns null for non-folder keys. */
export function folderIdFromKey(key: string): string | null {
  if (!key.startsWith(FOLDER_KEY_PREFIX)) return null
  return key.slice(FOLDER_KEY_PREFIX.length) || null
}

/** Find the folder that directly contains the given folder id, or undefined. */
export function findParentFolder(folders: LibraryFolder[], childId: string): LibraryFolder | undefined {
  const key = folderKey(childId)
  return folders.find((f) => f.itemKeys.includes(key))
}

/** Walk up the parent chain and return all ancestor folder ids (nearest parent first). */
export function getFolderAncestors(folders: LibraryFolder[], folderId: string): string[] {
  const ancestors: string[] = []
  let current = findParentFolder(folders, folderId)
  while (current) {
    ancestors.push(current.id)
    current = findParentFolder(folders, current.id)
  }
  return ancestors
}

/** The nesting depth of a folder (0 = root level, 1 = inside another folder, etc.). */
export function getFolderDepth(folders: LibraryFolder[], folderId: string): number {
  return getFolderAncestors(folders, folderId).length
}

/**
 * Check whether moving `draggedFolderId` into `targetFolderId` would create
 * a cycle. True if target is the dragged folder itself or a descendant of it.
 */
export function wouldCreateCycle(
  folders: LibraryFolder[],
  draggedFolderId: string,
  targetFolderId: string,
): boolean {
  if (draggedFolderId === targetFolderId) return true
  return getFolderAncestors(folders, targetFolderId).includes(draggedFolderId)
}

/**
 * Validate that an item key can be added to a folder.
 * - Non-folder keys (pl-*, al-*, etc.): always valid (one-folder-only enforced by addItemToFolder).
 * - Folder keys (fold-*): checks depth limit and circular reference.
 */
export function canAddItemToFolder(
  folders: LibraryFolder[],
  folderId: string,
  key: string,
  maxDepth = MAX_FOLDER_DEPTH,
): { ok: boolean; reason?: string } {
  const fid = folderIdFromKey(key)
  if (!fid) return { ok: true } // plain item key — always valid

  // Folder key — validate nesting constraints
  if (folderId === fid) {
    return { ok: false, reason: 'Cannot move a folder into itself' }
  }
  if (wouldCreateCycle(folders, fid, folderId)) {
    return { ok: false, reason: 'Cannot create circular folder nesting' }
  }
  // Remove the dragged folder from its current parent before checking depth,
  // so the depth calculation reflects the destination, not the source.
  const parentless = folders.map((f) =>
    f.itemKeys.includes(key) ? { ...f, itemKeys: f.itemKeys.filter((k) => k !== key) } : f,
  )
  const targetDepth = getFolderDepth(parentless, folderId)
  if (targetDepth + 1 >= maxDepth) {
    return { ok: false, reason: `Maximum folder nesting depth (${maxDepth}) exceeded` }
  }
  return { ok: true }
}

/**
 * Safe version of {@link addItemToFolder} that validates depth/cycle
 * constraints for folder keys before adding. Non-folder keys pass through.
 * Returns true if the item was added, false if validation failed.
 */
export function addItemToFolderSafely(
  folderId: string,
  key: string,
  maxDepth = MAX_FOLDER_DEPTH,
): boolean {
  const validation = canAddItemToFolder(getFolders(), folderId, key, maxDepth)
  if (!validation.ok) return false
  addItemToFolder(folderId, key)
  return true
}
