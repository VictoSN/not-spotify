import { create } from 'zustand'

// Shared "hovered cover colour" so hovering a card can tint the page hue.
interface HueState {
  hoverColor: string | null
  setHoverColor: (color: string | null) => void
}

export const useHueStore = create<HueState>((set) => ({
  hoverColor: null,
  setHoverColor: (color) => set({ hoverColor: color }),
}))
