import type { PlaybackMode } from '@/stores/playerStore'

/** Which right-rail now-playing panel matches the active playback surface. */
export type NowPlayingPanelKind = 'video' | 'audio'

/**
 * Picks the now-playing right panel for the current playback surface. An
 * independently-played music video (`playbackMode === 'video'`) drives the
 * dedicated MusicVideoNowPlayingPanel; audio playback — a song, or an audio
 * track that merely *has* a video — uses the standard NowPlayingPanel.
 *
 * Kept as a pure helper so the choice is unit-testable and AppShell's panel
 * wiring can't silently drift from the playback mode.
 */
export function selectNowPlayingPanel(playbackMode: PlaybackMode): NowPlayingPanelKind {
  return playbackMode === 'video' ? 'video' : 'audio'
}
