import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { AdminShell } from '@/components/layout/AdminShell'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { AdminRoute } from '@/components/common/AdminRoute'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { HomePage } from '@/pages/HomePage'
import { SearchPage } from '@/pages/SearchPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { PlaylistDetailPage } from '@/pages/PlaylistDetailPage'
import { AlbumDetailPage } from '@/pages/AlbumDetailPage'
import { ArtistProfilePage } from '@/pages/ArtistProfilePage'
import { GenreBrowsePage } from '@/pages/GenreBrowsePage'
import { GenreDetailPage } from '@/pages/GenreDetailPage'
import { AdminArtistsListPage } from '@/pages/admin/AdminArtistsListPage'
import { AdminArtistFormPage } from '@/pages/admin/AdminArtistFormPage'
import { AdminAlbumsListPage } from '@/pages/admin/AdminAlbumsListPage'
import { AdminAlbumFormPage } from '@/pages/admin/AdminAlbumFormPage'
import { AdminTracksListPage } from '@/pages/admin/AdminTracksListPage'
import { AdminTrackFormPage } from '@/pages/admin/AdminTrackFormPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    element: <ProtectedRoute />,
    errorElement: <ErrorBoundary><div /></ErrorBoundary>,
    children: [
      // ── Music app (sidebar + player) ──────────────────────────────
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'search', element: <SearchPage /> },
          { path: 'library', element: <LibraryPage /> },
          { path: 'playlist/:id', element: <PlaylistDetailPage /> },
          { path: 'album/:id', element: <AlbumDetailPage /> },
          { path: 'artist/:id', element: <ArtistProfilePage /> },
          { path: 'genres', element: <GenreBrowsePage /> },
          { path: 'genres/:slug', element: <GenreDetailPage /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },

      // ── Admin panel (own layout, no music chrome) ─────────────────
      {
        element: <AdminRoute />,
        children: [
          {
            element: <AdminShell />,
            children: [
              { path: 'admin', element: <Navigate to="/admin/artists" replace /> },
              { path: 'admin/artists', element: <AdminArtistsListPage /> },
              { path: 'admin/artists/new', element: <AdminArtistFormPage /> },
              { path: 'admin/artists/:id/edit', element: <AdminArtistFormPage /> },
              { path: 'admin/albums', element: <AdminAlbumsListPage /> },
              { path: 'admin/albums/new', element: <AdminAlbumFormPage /> },
              { path: 'admin/albums/:id/edit', element: <AdminAlbumFormPage /> },
              { path: 'admin/tracks', element: <AdminTracksListPage /> },
              { path: 'admin/tracks/new', element: <AdminTrackFormPage /> },
              { path: 'admin/tracks/:id/edit', element: <AdminTrackFormPage /> },
            ],
          },
        ],
      },
    ],
  },
])
