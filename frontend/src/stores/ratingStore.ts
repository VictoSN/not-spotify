import { create } from 'zustand'
import { trackService } from '@/services/trackService'
import { useAuthStore } from './authStore'

const LS_KEY = 'ns-track-ratings'

function loadFromStorage(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveToStorage(ratings: Record<string, number>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ratings))
  } catch { /* ignore */ }
}

/** Per-track aggregate cached from server responses */
interface TrackAggregate {
  ratingCount: number
  averageRating: number
}

interface RatingState {
  /** User's own ratings: trackId → 1-5 */
  myRatings: Record<string, number>
  /** Server aggregates, updated optimistically on every rate/unrate */
  aggregates: Record<string, TrackAggregate>

  /** Seed aggregates from track data returned by any endpoint */
  seedAggregate: (trackId: string, ratingCount: number, averageRating: number) => void
  /** Pull all of this user's ratings from the server (call on login) */
  loadFromBackend: () => Promise<void>
  /** Rate a track (1-5). Pass 0 or same value as current to clear. */
  setRating: (trackId: string, rating: number) => Promise<void>
  getMyRating: (trackId: string) => number
  getAggregate: (trackId: string) => TrackAggregate
}

export const useRatingStore = create<RatingState>((set, get) => ({
  myRatings: loadFromStorage(),
  aggregates: {},

  seedAggregate: (trackId, ratingCount, averageRating) => {
    set((s) => ({
      aggregates: { ...s.aggregates, [trackId]: { ratingCount, averageRating } },
    }))
  },

  loadFromBackend: async () => {
    if (!useAuthStore.getState().isAuthenticated) return
    try {
      const serverRatings = await trackService.getMyRatings()
      set({ myRatings: serverRatings })
      saveToStorage(serverRatings)
    } catch { /* ignore — keep local cache */ }
  },

  setRating: async (trackId, rating) => {
    const { myRatings } = get()
    const current = myRatings[trackId] ?? 0
    const isToggleOff = rating === current || rating === 0

    // Optimistic update
    const updated = { ...myRatings }
    if (isToggleOff) {
      delete updated[trackId]
    } else {
      updated[trackId] = rating
    }
    set({ myRatings: updated })
    saveToStorage(updated)

    if (!useAuthStore.getState().isAuthenticated) return

    try {
      const result = isToggleOff
        ? await trackService.unrateTrack(trackId)
        : await trackService.rateTrack(trackId, rating)

      set((s) => ({
        aggregates: {
          ...s.aggregates,
          [trackId]: { ratingCount: result.ratingCount, averageRating: result.averageRating },
        },
      }))
    } catch {
      // Rollback optimistic update
      set({ myRatings })
      saveToStorage(myRatings)
    }
  },

  getMyRating: (trackId) => get().myRatings[trackId] ?? 0,
  getAggregate: (trackId) => get().aggregates[trackId] ?? { ratingCount: 0, averageRating: 0 },
}))

// Clear local ratings on logout
useAuthStore.subscribe((state) => {
  if (!state.isAuthenticated) {
    localStorage.removeItem(LS_KEY)
    useRatingStore.setState({ myRatings: {}, aggregates: {} })
  }
})
