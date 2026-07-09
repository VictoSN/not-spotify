import { create } from 'zustand'

// Shared page-hue state. `hoverColor` lets a quick-access playlist temporarily
// tint the Home page while it is hovered.
// `hueTouched` flips true the first time any card is hovered in this page load
// (in-memory only, so a refresh/new tab resets it): until then Home rests on a
// neutral grey wash; afterwards it rests on the first playlist's hue.
// `headerScrolled` reflects whether the main content area is scrolled past its
// hero — consumed by page-local sticky headers (e.g. Home's filter bar), NOT the
// global app header, which stays visually independent.
interface HueState {
  hoverColor: string | null
  hueTouched: boolean
  setHoverColor: (color: string | null) => void
  headerScrolled: boolean
  setHeaderScrolled: (scrolled: boolean) => void
}

export const useHueStore = create<HueState>((set) => ({
  hoverColor: null,
  hueTouched: false,
  setHoverColor: (color) =>
    set((state) => ({ hoverColor: color, hueTouched: state.hueTouched || color !== null })),
  headerScrolled: false,
  setHeaderScrolled: (scrolled) => set({ headerScrolled: scrolled }),
}))
