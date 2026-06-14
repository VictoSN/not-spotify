import { create } from 'zustand'
import { useAuthStore } from './authStore'

export type JamRole = 'off' | 'host' | 'guest'

interface JamState {
  role: JamRole
  /** The host's user id for the active jam (own id when hosting). */
  hostId: string | null
  hostName: string | null
  /** People in the jam (host + guests), as reported by the hub. */
  participants: number

  startHosting: () => void
  stopJam: () => void
  joinAs: (hostId: string, hostName: string) => void
  setParticipants: (n: number) => void
}

export const useJamStore = create<JamState>((set) => ({
  role: 'off',
  hostId: null,
  hostName: null,
  participants: 0,

  startHosting: () => {
    const me = useAuthStore.getState().user
    if (!me) return
    set({ role: 'host', hostId: me.id, hostName: me.name, participants: 1 })
  },

  stopJam: () => set({ role: 'off', hostId: null, hostName: null, participants: 0 }),

  joinAs: (hostId, hostName) => set({ role: 'guest', hostId, hostName, participants: 0 }),

  setParticipants: (n) => set({ participants: n }),
}))

// Leave any jam on logout.
useAuthStore.subscribe((state, prev) => {
  if (!prev.isAuthenticated || state.isAuthenticated) return
  useJamStore.setState({ role: 'off', hostId: null, hostName: null, participants: 0 })
})
