import { usePlayerStore } from '@/stores/playerStore'

export function usePlayer() {
  return usePlayerStore()
}
