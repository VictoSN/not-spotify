import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { AdminShell } from '@/components/layout/AdminShell'
import { SettingsShell } from '@/components/layout/SettingsShell'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { AdminRoute } from '@/components/common/AdminRoute'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { HomePage } from '@/pages/HomePage'
import { SearchPage } from '@/pages/SearchPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { AccountSettingsPage } from '@/pages/AccountSettingsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { MessagesPage } from '@/pages/MessagesPage'
import { PremiumPage } from '@/pages/PremiumPage'
import { PlaylistDetailPage } from '@/pages/PlaylistDetailPage'
import { AlbumDetailPage } from '@/pages/AlbumDetailPage'
import { ArtistProfilePage } from '@/pages/ArtistProfilePage'
import { GenreBrowsePage } from '@/pages/GenreBrowsePage'
import { GenreDetailPage } from '@/pages/GenreDetailPage'
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
import { ArtistDashboardPage } from '@/pages/ArtistDashboardPage'
import { UserProfilePage } from '@/pages/UserProfilePage'
import { TrackDetailPage } from '@/pages/TrackDetailPage'
import { DevKaraokePage } from '@/pages/DevKaraokePage'

export const router = createBrowserRouter([
  // Dev-only harness for the karaoke lyrics view; excluded from production builds.
  ...(import.meta.env.DEV ? [{ path: '/dev/karaoke', element: <DevKaraokePage /> }] : []),
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/admin/login', element: <AdminLoginPage /> },
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
          { path: 'artist/:id', element: <ArtistProfilePage /> },
          { path: 'genres', element: <GenreBrowsePage /> },
          { path: 'genres/:slug', element: <GenreDetailPage /> },
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
          {
            element: <ProtectedRoute />,
            children: [
              { path: 'profile', element: <ProfilePage /> },
              { path: 'settings', element: <SettingsPage /> },
              { path: 'stats', element: <StatsPage /> },
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
              { path: 'admin/applications', element: <AdminApplicationsPage /> },
              { path: 'admin/dev', element: <AdminDevPage /> },
            ],
          },
        ],
      },
    ],
  },
])
