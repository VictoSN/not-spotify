import { create } from 'zustand'

// Shared page-hue state. `hoverColor` lets hovering a card tint the page hue.
// `lastCoverColor` remembers the last card that actually had a cover, so the hero
// keeps its tint after the cursor leaves (instead of snapping to the default).
// `headerScrolled` reflects whether the main content area is scrolled past its
// hero — consumed by page-local sticky headers (e.g. Home's filter bar), NOT the
// global app header, which stays visually independent.
interface HueState {
  hoverColor: string | null
  setHoverColor: (color: string | null) => void
  lastCoverColor: string | null
  setLastCoverColor: (color: string | null) => void
  headerScrolled: boolean
  setHeaderScrolled: (scrolled: boolean) => void
}

export const useHueStore = create<HueState>((set) => ({
  hoverColor: null,
  setHoverColor: (color) => set({ hoverColor: color }),
  lastCoverColor: null,
  setLastCoverColor: (color) => set({ lastCoverColor: color }),
  headerScrolled: false,
  setHeaderScrolled: (scrolled) => set({ headerScrolled: scrolled }),
}))
