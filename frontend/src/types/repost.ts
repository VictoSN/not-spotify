import type { UserRef } from './user'
import type { Track } from './track'
import type { Album } from './album'
import type { Playlist } from './playlist'

export interface Repost {
  id: string
  user: UserRef
  trackId: string | null
  albumId: string | null
  playlistId: string | null
  track: Track | null
  album: Album | null
  playlist: Playlist | null
  createdAt: string
}
