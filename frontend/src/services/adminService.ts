import type { Artist } from '@/types/artist'
import type { Album } from '@/types/album'
import type { Track } from '@/types/track'
import type { MoodTag } from '@/types/mood'
import type { MusicVideo } from '@/types/musicVideo'
import type { Podcast, PodcastSummary } from '@/types/podcast'
import { api } from './api'

export interface ArtistApplication {
  id: string
  userId: string
  userName: string
  userEmail: string
  displayName: string
  bio: string
  sampleWorkUrl: string | null
  status: 'pending' | 'approved' | 'rejected'
  submittedAt: string
  reviewedAt: string | null
  reviewNote: string | null
}

export interface AdminTrendPoint {
  date: string
  count: number
}

export interface AdminTopTrack {
  id: string
  title: string
  artistName: string
  albumTitle: string
  coverUrl: string | null
  playCount: number
  playsInWindow: number
  uniqueListeners: number
}

export interface AdminActiveTrack {
  id: string
  title: string
  artistName: string
  coverUrl: string | null
  activeListeners: number
}

export interface AdminRecentVisit {
  path: string
  userName: string | null
  visitedAt: string
}

export interface AdminDashboardStats {
  totalVisits: number
  visitsToday: number
  activeListeners: number
  totalUsers: number
  premiumUsers: number
  totalTracks: number
  totalArtists: number
  totalAlbums: number
  pendingApplications: number
  pendingAlbums: number
  pendingTracks: number
  playsToday: number
  playsLast7Days: number
  visitsTrend: AdminTrendPoint[]
  playsTrend: AdminTrendPoint[]
  topTracks: AdminTopTrack[]
  activeTracks: AdminActiveTrack[]
  recentVisits: AdminRecentVisit[]
}

// ── Artist ────────────────────────────────────────────────────────────────────

export interface CreateArtistPayload {
  name: string
  bio?: string | null
  instagram?: string | null
  twitter?: string | null
  website?: string | null
  verified?: boolean
}

export type UpdateArtistPayload = Partial<CreateArtistPayload>

// ── Album ─────────────────────────────────────────────────────────────────────

export interface CreateAlbumPayload {
  title: string
  artistId: string
  type?: string
  releaseDate?: string | null  // YYYY-MM-DD
  label?: string | null
  copyright?: string | null
}

export type UpdateAlbumPayload = Partial<CreateAlbumPayload>

// ── Track ─────────────────────────────────────────────────────────────────────

export interface CreateTrackPayload {
  title: string
  albumId: string
  artistId: string
  durationMs: number
  trackNumber?: number
  discNumber?: number
  explicit?: boolean
}

export type UpdateTrackPayload = Partial<CreateTrackPayload>

export interface ReviewHistoryEntry {
  id: string
  entityType: string
  entityId: string
  action: 'approved' | 'rejected' | 'resubmitted'
  note: string | null
  reviewedByName: string | null
  reviewedAt: string
}

// ── Music videos ──────────────────────────────────────────────────────────────

export interface UpdateMusicVideoPayload {
  title?: string
  description?: string | null
  trackId?: string | null
  clearTrack?: boolean
}

// ── Podcasts ──────────────────────────────────────────────────────────────────

export interface UpsertPodcastPayload {
  title: string
  description?: string | null
  category?: string | null
}

export interface UpdateEpisodePayload {
  title?: string
  description?: string | null
  durationMs?: number
  episodeNumber?: number
  explicit?: boolean
  publishedAt?: string
}

// ── RBAC ──────────────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  isMaster: boolean
  isAdmin: boolean
  createdAt: string
}

export interface PendingAction {
  id: string
  actionType: 'grant-admin' | 'revoke-admin'
  targetUserId: string
  targetEmail: string
  status: 'pending' | 'approved' | 'rejected'
  requestedByUserId: string
  requestedByName: string
  requestedAt: string
  reviewedByName: string | null
  reviewedAt: string | null
  reviewNote: string | null
}

export interface AdminAuthProviderState {
  enabled: boolean
  configured: boolean
  available: boolean
  status: string
}

export interface AdminAuthProviders {
  google: AdminAuthProviderState
  facebook: AdminAuthProviderState
  apple: AdminAuthProviderState
}

// ── Service ───────────────────────────────────────────────────────────────────

export const adminService = {
  async getDashboardStats(): Promise<AdminDashboardStats> {
    const res = await api.get<AdminDashboardStats>('/admin/dashboard')
    return res.data
  },

  // Artists
  async listArtists(): Promise<Artist[]> {
    const res = await api.get<Artist[]>('/artists')
    return res.data
  },

  async getArtist(id: string): Promise<Artist> {
    const res = await api.get<Artist>(`/admin/artists/${id}`)
    return res.data
  },

  async createArtist(payload: CreateArtistPayload): Promise<Artist> {
    const res = await api.post<Artist>('/admin/artists', payload)
    return res.data
  },

  async updateArtist(id: string, payload: UpdateArtistPayload): Promise<Artist> {
    const res = await api.patch<Artist>(`/admin/artists/${id}`, payload)
    return res.data
  },

  async deleteArtist(id: string): Promise<void> {
    await api.delete(`/admin/artists/${id}`)
  },

  async revokeArtist(id: string, note?: string): Promise<Artist> {
    const res = await api.post<Artist>(`/admin/artists/${id}/revoke`, { note: note || null })
    return res.data
  },

  async reinstateArtist(id: string): Promise<Artist> {
    const res = await api.post<Artist>(`/admin/artists/${id}/reinstate`)
    return res.data
  },

  /** Force-refresh cached Ticketmaster tour dates for every artist now. Returns how many were synced. */
  async syncAllTours(): Promise<number> {
    const res = await api.post<{ synced: number }>('/admin/artists/sync-tour')
    return res.data.synced
  },

  async uploadArtistImage(id: string, file: File, type: 'profile' | 'header' = 'profile'): Promise<Artist> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await api.post<Artist>(`/admin/artists/${id}/image?type=${type}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  // Albums
  async listAlbums(status?: string): Promise<Album[]> {
    const res = await api.get<Album[]>('/admin/albums', { params: status ? { status } : undefined })
    return res.data
  },

  async listPendingAlbums(): Promise<Album[]> {
    const res = await api.get<Album[]>('/admin/albums/pending')
    return res.data
  },

  async approveAlbum(id: string, note?: string): Promise<Album> {
    const res = await api.patch<Album>(`/admin/albums/${id}/approve`, { note: note || null })
    return res.data
  },

  async rejectAlbum(id: string, note?: string): Promise<Album> {
    const res = await api.patch<Album>(`/admin/albums/${id}/reject`, { note: note || null })
    return res.data
  },

  async getAlbum(id: string): Promise<Album> {
    const res = await api.get<Album>(`/albums/${id}`)
    return res.data
  },

  async createAlbum(payload: CreateAlbumPayload): Promise<Album> {
    const res = await api.post<Album>('/admin/albums', payload)
    return res.data
  },

  async updateAlbum(id: string, payload: UpdateAlbumPayload): Promise<Album> {
    const res = await api.patch<Album>(`/admin/albums/${id}`, payload)
    return res.data
  },

  async deleteAlbum(id: string): Promise<void> {
    await api.delete(`/admin/albums/${id}`)
  },

  async uploadAlbumCover(id: string, file: File): Promise<Album> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await api.post<Album>(`/admin/albums/${id}/cover`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  // Tracks
  async listTracks(status?: string): Promise<Track[]> {
    const res = await api.get<Track[]>('/admin/tracks', { params: status ? { status } : undefined })
    return res.data
  },

  async getTrack(id: string): Promise<Track> {
    const res = await api.get<Track>(`/tracks/${id}`)
    return res.data
  },

  async createTrack(payload: CreateTrackPayload): Promise<Track> {
    const res = await api.post<Track>('/admin/tracks', payload)
    return res.data
  },

  async updateTrack(id: string, payload: UpdateTrackPayload): Promise<Track> {
    const res = await api.patch<Track>(`/admin/tracks/${id}`, payload)
    return res.data
  },

  async deleteTrack(id: string): Promise<void> {
    await api.delete(`/admin/tracks/${id}`)
  },

  async uploadTrackAudio(id: string, file: File): Promise<Track> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await api.post<Track>(`/admin/tracks/${id}/audio`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  async getAlbumTracks(albumId: string): Promise<Track[]> {
    const res = await api.get<Track[]>(`/admin/albums/${albumId}/tracks`)
    return res.data
  },

  async updateArtistTrack(id: string, payload: { trackNumber?: number; title?: string; explicit?: boolean }): Promise<Track> {
    const res = await api.patch<Track>(`/me/artist-tracks/${id}`, payload)
    return res.data
  },

  // Pending track approvals
  async listPendingTracks(): Promise<Track[]> {
    const res = await api.get<Track[]>('/admin/tracks/pending')
    return res.data
  },

  async approveTrack(id: string, note?: string): Promise<void> {
    await api.patch(`/admin/tracks/${id}/approve`, { note: note || null })
  },

  async rejectTrack(id: string, note?: string): Promise<void> {
    await api.patch(`/admin/tracks/${id}/reject`, { note: note || null })
  },

  async getAlbumReviewHistory(id: string): Promise<ReviewHistoryEntry[]> {
    const res = await api.get<ReviewHistoryEntry[]>(`/admin/albums/${id}/review-history`)
    return res.data
  },

  async getTrackReviewHistory(id: string): Promise<ReviewHistoryEntry[]> {
    const res = await api.get<ReviewHistoryEntry[]>(`/admin/tracks/${id}/review-history`)
    return res.data
  },

  // Music videos
  async listVideos(status?: string): Promise<MusicVideo[]> {
    const res = await api.get<MusicVideo[]>('/admin/videos', { params: status ? { status } : undefined })
    return res.data
  },

  async listPendingVideos(): Promise<MusicVideo[]> {
    const res = await api.get<MusicVideo[]>('/admin/videos/pending')
    return res.data
  },

  async updateVideo(id: string, payload: UpdateMusicVideoPayload): Promise<MusicVideo> {
    const res = await api.patch<MusicVideo>(`/admin/videos/${id}`, payload)
    return res.data
  },

  async deleteVideo(id: string): Promise<void> {
    await api.delete(`/admin/videos/${id}`)
  },

  async approveVideo(id: string, note?: string): Promise<void> {
    await api.patch(`/admin/videos/${id}/approve`, { note: note || null })
  },

  async rejectVideo(id: string, note?: string): Promise<void> {
    await api.patch(`/admin/videos/${id}/reject`, { note: note || null })
  },

  async getVideoReviewHistory(id: string): Promise<ReviewHistoryEntry[]> {
    const res = await api.get<ReviewHistoryEntry[]>(`/admin/videos/${id}/review-history`)
    return res.data
  },

  // Podcasts
  async listPodcasts(status?: string): Promise<PodcastSummary[]> {
    const res = await api.get<PodcastSummary[]>('/admin/podcasts', { params: status ? { status } : undefined })
    return res.data
  },

  async listPendingPodcasts(): Promise<PodcastSummary[]> {
    const res = await api.get<PodcastSummary[]>('/admin/podcasts/pending')
    return res.data
  },

  async getPodcast(id: string): Promise<Podcast> {
    const res = await api.get<Podcast>(`/admin/podcasts/${id}`)
    return res.data
  },

  async updatePodcast(id: string, payload: UpsertPodcastPayload): Promise<Podcast> {
    const res = await api.patch<Podcast>(`/admin/podcasts/${id}`, payload)
    return res.data
  },

  async deletePodcast(id: string): Promise<void> {
    await api.delete(`/admin/podcasts/${id}`)
  },

  async approvePodcast(id: string, note?: string): Promise<void> {
    await api.patch(`/admin/podcasts/${id}/approve`, { note: note || null })
  },

  async rejectPodcast(id: string, note?: string): Promise<void> {
    await api.patch(`/admin/podcasts/${id}/reject`, { note: note || null })
  },

  async getPodcastReviewHistory(id: string): Promise<ReviewHistoryEntry[]> {
    const res = await api.get<ReviewHistoryEntry[]>(`/admin/podcasts/${id}/review-history`)
    return res.data
  },

  async updateEpisode(id: string, payload: UpdateEpisodePayload): Promise<void> {
    await api.patch(`/admin/podcasts/episodes/${id}`, payload)
  },

  async deleteEpisode(id: string): Promise<void> {
    await api.delete(`/admin/podcasts/episodes/${id}`)
  },

  async approveEpisode(id: string, note?: string): Promise<void> {
    await api.patch(`/admin/podcasts/episodes/${id}/approve`, { note: note || null })
  },

  async rejectEpisode(id: string, note?: string): Promise<void> {
    await api.patch(`/admin/podcasts/episodes/${id}/reject`, { note: note || null })
  },

  async getEpisodeReviewHistory(id: string): Promise<ReviewHistoryEntry[]> {
    const res = await api.get<ReviewHistoryEntry[]>(`/admin/podcasts/episodes/${id}/review-history`)
    return res.data
  },

  // Artist applications
  async listApplications(status?: string): Promise<ArtistApplication[]> {
    const res = await api.get<ArtistApplication[]>('/admin/applications', {
      params: status ? { status } : undefined,
    })
    return res.data
  },

  async approveApplication(id: string, note?: string): Promise<ArtistApplication> {
    const res = await api.patch<ArtistApplication>(`/admin/applications/${id}/approve`, { note })
    return res.data
  },

  async rejectApplication(id: string, note?: string): Promise<ArtistApplication> {
    const res = await api.patch<ArtistApplication>(`/admin/applications/${id}/reject`, { note })
    return res.data
  },

  // ---- Mood / activity tags ----
  async listMoodTags(): Promise<MoodTag[]> {
    const res = await api.get<MoodTag[]>('/admin/mood-tags')
    return res.data
  },

  async getTrackMoodTags(trackId: string): Promise<MoodTag[]> {
    const res = await api.get<MoodTag[]>(`/admin/tracks/${trackId}/mood-tags`)
    return res.data
  },

  async setTrackMoodTags(trackId: string, moodTagIds: string[]): Promise<MoodTag[]> {
    const res = await api.put<MoodTag[]>(`/admin/tracks/${trackId}/mood-tags`, { moodTagIds })
    return res.data
  },

  // ---- RBAC: team & approvals ----
  async getTeam(): Promise<TeamMember[]> {
    const res = await api.get<TeamMember[]>('/admin/team')
    return res.data
  },

  /** Master executes immediately (200); a regular admin enqueues (202). */
  async grantAdmin(email: string): Promise<{ enqueued: boolean }> {
    const res = await api.post('/admin/team/grant', { email })
    return { enqueued: res.status === 202 }
  },

  async revokeAdmin(userId: string): Promise<{ enqueued: boolean }> {
    const res = await api.post(`/admin/team/${userId}/revoke`)
    return { enqueued: res.status === 202 }
  },

  async getApprovals(status?: string): Promise<PendingAction[]> {
    const res = await api.get<PendingAction[]>('/admin/approvals', {
      params: status ? { status } : undefined,
    })
    return res.data
  },

  async approveAction(id: string, note?: string): Promise<PendingAction> {
    const res = await api.post<PendingAction>(`/admin/approvals/${id}/approve`, { note: note || null })
    return res.data
  },

  async rejectAction(id: string, note?: string): Promise<PendingAction> {
    const res = await api.post<PendingAction>(`/admin/approvals/${id}/reject`, { note: note || null })
    return res.data
  },

  async getAuthProviders(): Promise<AdminAuthProviders> {
    const res = await api.get<AdminAuthProviders>('/admin/dev/auth-providers')
    return res.data
  },

  async updateAuthProviders(payload: { google: boolean; facebook: boolean; apple: boolean }): Promise<AdminAuthProviders> {
    const res = await api.put<AdminAuthProviders>('/admin/dev/auth-providers', payload)
    return res.data
  },
}

/** Download all tracks in an album as a ZIP file. Works for any authenticated user. */
export async function downloadAlbumZip(albumId: string, albumTitle: string): Promise<void> {
  const res = await api.get(`/albums/${albumId}/download-zip`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${albumTitle}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
