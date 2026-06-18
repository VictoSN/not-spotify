export interface MoodTag {
  id: string
  name: string
  slug: string
  /** "mood" | "activity" */
  kind: string
  color: string
  /** Heroicon component name (e.g. "BoltIcon"), or null. */
  icon: string | null
  /** Catalogue search fallback used when no tracks are tagged yet. */
  searchQuery: string | null
  sortOrder: number
}
