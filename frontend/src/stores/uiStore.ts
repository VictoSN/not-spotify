import { create } from 'zustand'

interface UiState {
  // When true the left library expands to fill the whole middle row (Spotify's
  // "expand" view); the main content + right panel are hidden while it's on.
  libraryExpanded: boolean
  setLibraryExpanded: (v: boolean) => void
  toggleLibraryExpanded: () => void

  // Friend Activity feed in the right rail. While open it takes the slot the
  // Now Playing panel normally occupies (Spotify's buddy-feed behavior).
  friendActivityOpen: boolean
  setFriendActivityOpen: (v: boolean) => void
  toggleFriendActivity: () => void
}

export const useUiStore = create<UiState>((set) => ({
  libraryExpanded: false,
  setLibraryExpanded: (v) => set({ libraryExpanded: v }),
  toggleLibraryExpanded: () => set((s) => ({ libraryExpanded: !s.libraryExpanded })),

  friendActivityOpen: false,
  setFriendActivityOpen: (v) => set({ friendActivityOpen: v }),
  toggleFriendActivity: () => set((s) => ({ friendActivityOpen: !s.friendActivityOpen })),
}))
