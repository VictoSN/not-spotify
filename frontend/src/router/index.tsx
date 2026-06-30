import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { AdminShell } from '@/components/layout/AdminShell'
import { SettingsShell } from '@/components/layout/SettingsShell'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { AdminRoute } from '@/components/common/AdminRoute'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { SupportPage } from '@/pages/SupportPage'
import { HomePage } from '@/pages/HomePage'
import { SearchPage } from '@/pages/SearchPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { FollowingPage } from '@/pages/FollowingPage'
import { AccountSettingsPage } from '@/pages/AccountSettingsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { MessagesPage } from '@/pages/MessagesPage'
import { PremiumPage } from '@/pages/PremiumPage'
import { PlaylistDetailPage } from '@/pages/PlaylistDetailPage'
import { AlbumDetailPage } from '@/pages/AlbumDetailPage'
import { MixDetailPage } from '@/pages/MixDetailPage'
import { ArtistProfilePage } from '@/pages/ArtistProfilePage'
import { ArtistEventsPage } from '@/pages/ArtistEventsPage'
import { ArtistEventDetailPage } from '@/pages/ArtistEventDetailPage'
import { GenreBrowsePage } from '@/pages/GenreBrowsePage'
import { GenreDetailPage } from '@/pages/GenreDetailPage'
import { MoodActivityPage } from '@/pages/MoodActivityPage'
import { MoodDetailPage } from '@/pages/MoodDetailPage'
import { PodcastsPage } from '@/pages/PodcastsPage'
import { PodcastDetailPage } from '@/pages/PodcastDetailPage'
import { MusicVideosPage } from '@/pages/MusicVideosPage'
import { MusicVideoPage } from '@/pages/MusicVideoPage'
import { TrendingPage } from '@/pages/browse/TrendingPage'
import { ChartsPage } from '@/pages/browse/ChartsPage'
import { StatsPage } from '@/pages/StatsPage'
import { RecommendedTracksPage } from '@/pages/browse/RecommendedTracksPage'
import { RecentsPage } from '@/pages/browse/RecentsPage'
import { RecommendedPlaylistsPage } from '@/pages/browse/RecommendedPlaylistsPage'
import { PopularArtistsPage } from '@/pages/browse/PopularArtistsPage'
import { NewReleasesPage } from '@/pages/browse/NewReleasesPage'
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage'
import { AdminArtistsListPage } from '@/pages/admin/AdminArtistsListPage'
import { AdminArtistFormPage } from '@/pages/admin/AdminArtistFormPage'
import { AdminAlbumsListPage } from '@/pages/admin/AdminAlbumsListPage'
import { AdminAlbumFormPage } from '@/pages/admin/AdminAlbumFormPage'
import { AdminTracksListPage } from '@/pages/admin/AdminTracksListPage'
import { AdminTrackFormPage } from '@/pages/admin/AdminTrackFormPage'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { AdminApplicationsPage } from '@/pages/admin/AdminApplicationsPage'
import { AdminDevPage } from '@/pages/admin/AdminDevPage'
import { AdminTeamPage } from '@/pages/admin/AdminTeamPage'
import { AdminApprovalsPage } from '@/pages/admin/AdminApprovalsPage'
import { AdminPlaylistsPage } from '@/pages/admin/AdminPlaylistsPage'
import { AdminAdsPage } from '@/pages/admin/AdminAdsPage'
import { ArtistDashboardPage } from '@/pages/ArtistDashboardPage'
import { UserProfilePage } from '@/pages/UserProfilePage'
import { TrackDetailPage } from '@/pages/TrackDetailPage'
import { QueuePage } from '@/pages/QueuePage'
import { UploadsPage } from '@/pages/UploadsPage'
import { RecognizePage } from '@/pages/RecognizePage'
import { EmbedTrackPage } from '@/pages/EmbedTrackPage'
import { DevKaraokePage } from '@/pages/DevKaraokePage'
import { AboutPage, LegalPage, PrivacyPolicyPage } from '@/pages/legal/InfoPages'
import { DownloadPage } from '@/pages/DownloadPage'
import { InstallAppPage } from '@/pages/InstallAppPage'

export const router = createBrowserRouter([
  // Dev-only harness for the karaoke lyrics view; excluded from production builds.
  ...(import.meta.env.DEV ? [{ path: '/dev/karaoke', element: <DevKaraokePage /> }] : []),
  // Standalone embeddable mini-player — rendered bare (no shell/auth) so it can
  // be dropped into an <iframe> on any external page.
  { path: '/embed/track/:id', element: <EmbedTrackPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/support', element: <SupportPage /> },
  { path: '/download', element: <DownloadPage /> },
  { path: '/admin/login', element: <AdminLoginPage /> },
  // Friendly alias — the admin console's only advertised entrance.
  { path: '/adminlogin', element: <AdminLoginPage /> },
  {
    errorElement: (
      <ErrorBoundary>
        <div />
      </ErrorBoundary>
    ),
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'search', element: <SearchPage /> },
          { path: 'premium', element: <PremiumPage /> },
          { path: 'library', element: <LibraryPage /> },
          { path: 'playlist/:id', element: <PlaylistDetailPage /> },
          { path: 'album/:id', element: <AlbumDetailPage /> },
          { path: 'mix/:id', element: <MixDetailPage /> },
          { path: 'artist/:id', element: <ArtistProfilePage /> },
          { path: 'artist/:id/events', element: <ArtistEventsPage /> },
          { path: 'artist/:id/events/:eventId', element: <ArtistEventDetailPage /> },
          { path: 'genres', element: <GenreBrowsePage /> },
          { path: 'genres/:slug', element: <GenreDetailPage /> },
          { path: 'moods', element: <MoodActivityPage /> },
          { path: 'moods/:slug', element: <MoodDetailPage /> },
          { path: 'podcasts', element: <PodcastsPage /> },
          { path: 'podcasts/:id', element: <PodcastDetailPage /> },
          { path: 'videos', element: <MusicVideosPage /> },
          { path: 'videos/:id', element: <MusicVideoPage /> },
          { path: 'trending', element: <TrendingPage /> },
          { path: 'charts', element: <ChartsPage /> },
          { path: 'recommended-tracks', element: <RecommendedTracksPage /> },
          { path: 'recents', element: <RecentsPage /> },
          { path: 'history', element: <RecentsPage /> },
          { path: 'playlists', element: <RecommendedPlaylistsPage /> },
          { path: 'popular-artists', element: <PopularArtistsPage /> },
          { path: 'new-releases', element: <NewReleasesPage /> },
          { path: 'user/:userId', element: <UserProfilePage /> },
          { path: 'track/:id', element: <TrackDetailPage /> },
          { path: 'queue', element: <QueuePage /> },
          { path: 'recognize', element: <RecognizePage /> },
          { path: 'install-app', element: <InstallAppPage /> },
          // Static footer pages — public so links resolve for guests too.
          { path: 'about', element: <AboutPage /> },
          { path: 'legal', element: <LegalPage /> },
          { path: 'privacy', element: <PrivacyPolicyPage /> },
          {
            element: <ProtectedRoute />,
            children: [
              { path: 'profile', element: <ProfilePage /> },
              { path: 'following', element: <FollowingPage /> },
              { path: 'settings', element: <SettingsPage /> },
              { path: 'stats', element: <StatsPage /> },
              { path: 'uploads', element: <UploadsPage /> },
              { path: 'messages', element: <MessagesPage /> },
            ],
          },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <SettingsShell />,
            children: [
              { path: 'account', element: <AccountSettingsPage /> },
              { path: 'artist-dashboard', element: <ArtistDashboardPage /> },
            ],
          },
        ],
      },
      {
        // AdminRoute handles auth itself: unauthenticated → /admin/login,
        // authenticated non-admins → /. (No ProtectedRoute wrapper — it would
        // intercept first and send admins to the member /login instead.)
        element: <AdminRoute />,
        children: [
          {
            element: <AdminShell />,
            children: [
              { path: 'admin', element: <Navigate to="/admin/dashboard" replace /> },
              { path: 'admin/dashboard', element: <AdminDashboardPage /> },
              { path: 'admin/artists', element: <AdminArtistsListPage /> },
              { path: 'admin/artists/new', element: <AdminArtistFormPage /> },
              { path: 'admin/artists/:id/edit', element: <AdminArtistFormPage /> },
              { path: 'admin/albums', element: <AdminAlbumsListPage /> },
              { path: 'admin/albums/new', element: <AdminAlbumFormPage /> },
              { path: 'admin/albums/:id/edit', element: <AdminAlbumFormPage /> },
              { path: 'admin/tracks', element: <AdminTracksListPage /> },
              { path: 'admin/tracks/new', element: <AdminTrackFormPage /> },
              { path: 'admin/tracks/:id/edit', element: <AdminTrackFormPage /> },
              { path: 'admin/playlists', element: <AdminPlaylistsPage /> },
              { path: 'admin/ads', element: <AdminAdsPage /> },
              { path: 'admin/applications', element: <AdminApplicationsPage /> },
              { path: 'admin/team', element: <AdminTeamPage /> },
              { path: 'admin/approvals', element: <AdminApprovalsPage /> },
              { path: 'admin/dev', element: <AdminDevPage /> },
            ],
          },
        ],
      },
    ],
  },
])
