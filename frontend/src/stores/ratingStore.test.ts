import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/services/trackService', () => ({
  trackService: {
    getMyRatings: vi.fn(),
    rateTrack: vi.fn(),
    unrateTrack: vi.fn(),
  },
}))

import { useRatingStore } from './ratingStore'
import { useAuthStore } from './authStore'
import { trackService } from '@/services/trackService'

const rateTrack = vi.mocked(trackService.rateTrack)
const unrateTrack = vi.mocked(trackService.unrateTrack)
const getMyRatings = vi.mocked(trackService.getMyRatings)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'me' } as never })
  useRatingStore.setState({ myRatings: {}, aggregates: {} })
})

describe('ratingStore', () => {
  it('seedAggregate / getAggregate round-trip, with a zero default', () => {
    expect(useRatingStore.getState().getAggregate('x')).toEqual({ ratingCount: 0, averageRating: 0 })
    useRatingStore.getState().seedAggregate('x', 12, 4.5)
    expect(useRatingStore.getState().getAggregate('x')).toEqual({ ratingCount: 12, averageRating: 4.5 })
  })

  it('setRating optimistically updates, persists, and syncs the server aggregate', async () => {
    rateTrack.mockResolvedValue({ ratingCount: 10, averageRating: 4.2, myRating: 4 })

    await useRatingStore.getState().setRating('t1', 4)

    expect(rateTrack).toHaveBeenCalledWith('t1', 4)
    expect(useRatingStore.getState().getMyRating('t1')).toBe(4)
    expect(useRatingStore.getState().getAggregate('t1')).toEqual({ ratingCount: 10, averageRating: 4.2 })
    expect(JSON.parse(localStorage.getItem('ns-track-ratings')!)).toEqual({ t1: 4 })
  })

  it('rolls back the optimistic update when the server call fails', async () => {
    rateTrack.mockRejectedValue(new Error('500'))

    await useRatingStore.getState().setRating('t1', 5)

    expect(useRatingStore.getState().getMyRating('t1')).toBe(0) // reverted
    expect(JSON.parse(localStorage.getItem('ns-track-ratings')!)).toEqual({})
  })

  it('re-rating with the same value toggles the rating off via unrateTrack', async () => {
    useRatingStore.setState({ myRatings: { t1: 4 } })
    unrateTrack.mockResolvedValue({ ratingCount: 9, averageRating: 4.0, myRating: 0 })

    await useRatingStore.getState().setRating('t1', 4)

    expect(unrateTrack).toHaveBeenCalledWith('t1')
    expect(rateTrack).not.toHaveBeenCalled()
    expect(useRatingStore.getState().getMyRating('t1')).toBe(0)
    expect(useRatingStore.getState().getAggregate('t1')).toEqual({ ratingCount: 9, averageRating: 4.0 })
  })

  it('rating 0 clears the rating', async () => {
    useRatingStore.setState({ myRatings: { t1: 3 } })
    unrateTrack.mockResolvedValue({ ratingCount: 1, averageRating: 3, myRating: 0 })

    await useRatingStore.getState().setRating('t1', 0)

    expect(unrateTrack).toHaveBeenCalledWith('t1')
    expect(useRatingStore.getState().getMyRating('t1')).toBe(0)
  })

  it('updates locally but skips the API when unauthenticated', async () => {
    useAuthStore.setState({ isAuthenticated: false, user: null })
    useRatingStore.setState({ myRatings: {} }) // logout subscriber already cleared it

    await useRatingStore.getState().setRating('t1', 5)

    expect(rateTrack).not.toHaveBeenCalled()
    expect(useRatingStore.getState().getMyRating('t1')).toBe(5) // local optimistic state stands
  })

  it('loadFromBackend pulls ratings when authenticated, and is a no-op otherwise', async () => {
    getMyRatings.mockResolvedValue({ a: 5, b: 3 })
    await useRatingStore.getState().loadFromBackend()
    expect(useRatingStore.getState().myRatings).toEqual({ a: 5, b: 3 })

    getMyRatings.mockClear()
    useAuthStore.setState({ isAuthenticated: false, user: null })
    await useRatingStore.getState().loadFromBackend()
    expect(getMyRatings).not.toHaveBeenCalled()
  })

  it('clears all ratings on logout', () => {
    useRatingStore.setState({ myRatings: { t1: 4 }, aggregates: { t1: { ratingCount: 2, averageRating: 4 } } })
    localStorage.setItem('ns-track-ratings', JSON.stringify({ t1: 4 }))

    useAuthStore.setState({ isAuthenticated: false, user: null })

    expect(useRatingStore.getState().myRatings).toEqual({})
    expect(useRatingStore.getState().aggregates).toEqual({})
    expect(localStorage.getItem('ns-track-ratings')).toBeNull()
  })
})
