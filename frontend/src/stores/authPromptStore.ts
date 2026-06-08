import { create } from 'zustand'

interface AuthPromptState {
  isOpen: boolean
  title: string
  imageUrl: string | null
  open: (payload: { title?: string; imageUrl?: string | null }) => void
  close: () => void
}

export const useAuthPromptStore = create<AuthPromptState>((set) => ({
  isOpen: false,
  title: 'Start listening with a free account',
  imageUrl: null,
  open: ({ title = 'Start listening with a free account', imageUrl = null }) => set({ isOpen: true, title, imageUrl }),
  close: () => set({ isOpen: false }),
}))
