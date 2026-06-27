import { create } from 'zustand'

export type SocialTab = 'messages' | 'friends'

interface UiState {
  // When true the left library expands to fill the whole middle row (Spotify's
  // "expand" view); the main content + right panel are hidden while it's on.
  libraryExpanded: boolean
  setLibraryExpanded: (v: boolean) => void
  toggleLibraryExpanded: () => void
  libraryMinimizing: boolean
  setLibraryMinimizing: (v: boolean) => void

  // Friend Activity feed in the right rail. While open it takes the slot the
  // Now Playing panel normally occupies (Spotify's buddy-feed behavior).
  friendActivityOpen: boolean
  setFriendActivityOpen: (v: boolean) => void
  toggleFriendActivity: () => void

  // Unified social hub: messages, listening activity, and friend management
  // share one responsive panel instead of competing for separate entry points.
  socialPanelOpen: boolean
  socialPanelTab: SocialTab
  setSocialPanelOpen: (v: boolean) => void
  toggleSocialPanel: () => void
  setSocialPanelTab: (tab: SocialTab) => void
}

export const useUiStore = create<UiState>((set) => ({
  libraryExpanded: false,
  setLibraryExpanded: (v) => set({ libraryExpanded: v }),
  toggleLibraryExpanded: () => set((s) => ({ libraryExpanded: !s.libraryExpanded })),
  libraryMinimizing: false,
  setLibraryMinimizing: (v) => set({ libraryMinimizing: v }),

  friendActivityOpen: false,
  setFriendActivityOpen: (v) => set({ friendActivityOpen: v }),
  toggleFriendActivity: () => set((s) => ({ friendActivityOpen: !s.friendActivityOpen })),

  socialPanelOpen: false,
  socialPanelTab: 'messages',
  setSocialPanelOpen: (v) => set({ socialPanelOpen: v }),
  toggleSocialPanel: () => set((s) => ({ socialPanelOpen: !s.socialPanelOpen })),
  setSocialPanelTab: (tab) => set({ socialPanelTab: tab }),
}))
