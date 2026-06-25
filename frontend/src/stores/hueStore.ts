import { create } from 'zustand'

// Shared page-hue state. `hoverColor` lets hovering a card tint the page hue.
// `headerScrolled` reflects whether the main content area is scrolled past its
// hero — consumed by page-local sticky headers (e.g. Home's filter bar), NOT the
// global app header, which stays visually independent.
interface HueState {
  hoverColor: string | null
  setHoverColor: (color: string | null) => void
  headerScrolled: boolean
  setHeaderScrolled: (scrolled: boolean) => void
}

export const useHueStore = create<HueState>((set) => ({
  hoverColor: null,
  setHoverColor: (color) => set({ hoverColor: color }),
  headerScrolled: false,
  setHeaderScrolled: (scrolled) => set({ headerScrolled: scrolled }),
}))
