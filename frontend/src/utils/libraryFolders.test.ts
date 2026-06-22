import { describe, it, expect, beforeEach } from 'vitest'
import {
  getFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  setFolderCollapsed,
  addItemToFolder,
  removeItemFromFolder,
  folderOfItem,
  FOLDERS_STORAGE_KEY,
} from './libraryFolders'

beforeEach(() => window.localStorage.clear())

describe('libraryFolders', () => {
  it('creates and persists a folder', () => {
    const f = createFolder('Rock')
    expect(f.name).toBe('Rock')
    const all = getFolders()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(f.id)
    expect(all[0].itemKeys).toEqual([])
    expect(all[0].collapsed).toBe(false)
  })

  it('falls back to a default name when blank', () => {
    expect(createFolder('   ').name).toBe('New Folder')
  })

  it('renames (ignoring blank) and deletes', () => {
    const f = createFolder('A')
    renameFolder(f.id, '   ') // blank → ignored
    expect(getFolders()[0].name).toBe('A')
    renameFolder(f.id, 'B')
    expect(getFolders()[0].name).toBe('B')
    deleteFolder(f.id)
    expect(getFolders()).toEqual([])
  })

  it('keeps an item in at most one folder (adding moves it)', () => {
    const a = createFolder('A')
    const b = createFolder('B')
    addItemToFolder(a.id, 'pl-1')
    expect(folderOfItem(getFolders(), 'pl-1')).toBe(a.id)

    addItemToFolder(b.id, 'pl-1') // moves out of A
    const folders = getFolders()
    expect(folderOfItem(folders, 'pl-1')).toBe(b.id)
    expect(folders.find((f) => f.id === a.id)!.itemKeys).toEqual([])
  })

  it('does not duplicate an item already in the folder', () => {
    const a = createFolder('A')
    addItemToFolder(a.id, 'pl-1')
    addItemToFolder(a.id, 'pl-1')
    expect(getFolders()[0].itemKeys).toEqual(['pl-1'])
  })

  it('removes an item from whichever folder holds it', () => {
    const a = createFolder('A')
    addItemToFolder(a.id, 'al-9')
    removeItemFromFolder('al-9')
    expect(folderOfItem(getFolders(), 'al-9')).toBeNull()
  })

  it('toggles the collapsed flag', () => {
    const a = createFolder('A')
    setFolderCollapsed(a.id, true)
    expect(getFolders()[0].collapsed).toBe(true)
    setFolderCollapsed(a.id, false)
    expect(getFolders()[0].collapsed).toBe(false)
  })

  it('ignores corrupt storage', () => {
    window.localStorage.setItem(FOLDERS_STORAGE_KEY, '{bad')
    expect(getFolders()).toEqual([])
  })
})
