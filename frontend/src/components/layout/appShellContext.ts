export interface AppShellOutletContext {
  setPageLoading: (loading: boolean) => void
  /** Let a full-height mobile view drive the shell's main overlay scrollbar. */
  setPageScrollTarget: (target: HTMLDivElement | null) => void
}
