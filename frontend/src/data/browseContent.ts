export type BrowseFilter = 'all' | 'music' | 'podcasts'

export interface BrowseFeatureItem {
  title: string
  description: string
  imageUrl: string
  href?: string
}

export interface BrowseFeatureRow {
  title: string
  items: BrowseFeatureItem[]
  /** Real route for the row's "Show all" link (never a name→search query). */
  href?: string
}

export interface BrowseCategorySeed {
  name: string
  slug: string
  color: string
  coverUrl: string
  heroUrl?: string
  kind?: BrowseFilter
  to?: string
  searchQuery?: string
  chips?: string[]
  rows?: BrowseFeatureRow[]
}

const img = (id: string, width = 640, height = 640) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&h=${height}&q=80`

const square = (seed: string) => `https://picsum.photos/seed/not-spotify-${seed}/640/640`
const hero = (seed: string) => `https://picsum.photos/seed/not-spotify-hero-${seed}/1800/620`

// A showcase card opens a real in-app track-list destination — a dedicated
// discovery route, or the themed genre page — rather than a text search for the
// card's title. Searching a curated name like "New Music Friday" matches no
// catalogue track and lands on an empty results page (bug #2). Pass `to` to point
// a card at a specific route; otherwise it falls back to the themed genre page.
const card = (
  slug: string,
  title: string,
  description: string,
  imageUrl = square(`${slug}-${title}`),
  to = `/genres/${slug}`,
): BrowseFeatureItem => ({
  title,
  description,
  imageUrl,
  href: to,
})

export const curatedBrowseCategories: BrowseCategorySeed[] = [
  {
    name: 'Music',
    slug: 'music',
    color: '#dc148c',
    coverUrl: img('photo-1516280440614-37939bbacd81'),
    heroUrl: img('photo-1501386761578-eac5c94b800a', 1800, 620),
    searchQuery: 'new music',
    chips: ['Pop', 'Hip-Hop', 'Indie', 'Dance'],
    rows: [
      {
        title: 'Discover new music',
        href: '/new-releases',
        items: [
          card('music', 'New Music Friday', 'Fresh tracks and future favorites.', img('photo-1493225457124-a3eb161ffa5f'), '/new-releases'),
          card('music', 'Discover Weekly', 'New finds shaped around your taste.', img('photo-1514525253161-7a46d19cd819'), '/recommended-tracks'),
          card('music', 'Release Radar', 'Catch the latest from artists you follow.', img('photo-1494232410401-ad00d5433cfa'), '/new-releases'),
        ],
      },
    ],
  },
  {
    name: 'Podcasts',
    slug: 'podcasts',
    color: '#006450',
    kind: 'podcasts',
    to: '/podcasts',
    coverUrl: img('photo-1478737270239-2f02b77fc618'),
    heroUrl: img('photo-1590602847861-f357a9332bbc', 1800, 620),
    searchQuery: 'podcasts',
  },
  {
    name: 'Live Events',
    slug: 'live-events',
    color: '#8400e7',
    to: '/events',
    coverUrl: img('photo-1501281668745-f7f57925c3b4'),
    heroUrl: img('photo-1501386761578-eac5c94b800a', 1800, 620),
    searchQuery: 'live concert',
  },
  {
    name: 'Fitness',
    slug: 'fitness',
    color: '#777777',
    to: '/moods',
    coverUrl: img('photo-1517836357463-d25dfeac3438'),
    heroUrl: img('photo-1518611012118-696072aa579a', 1800, 620),
    searchQuery: 'workout',
    chips: ['Workout', 'Pilates', 'Running', 'Wellness'],
  },
  {
    name: 'Gaming',
    slug: 'gaming',
    color: '#e8115b',
    coverUrl: img('photo-1542751371-adc38448a05e'),
    heroUrl: img('photo-1511512578047-dfb367046420', 1800, 620),
    searchQuery: 'gaming soundtrack',
    chips: ['Game soundtracks', 'Focus', 'Electronic', 'Boss fight'],
    rows: [
      {
        title: 'Level up your session',
        items: [
          card('gaming', 'Top Gaming Tracks', 'High-energy tracks for every lobby.', img('photo-1542751110-97427bbecf20')),
          card('gaming', '8-bit Focus', 'Pixel-bright sounds for deep concentration.', img('photo-1550745165-9bc0b252726f')),
          card('gaming', 'Boss Battle Mix', 'Big cinematic energy for clutch moments.', img('photo-1511512578047-dfb367046420')),
        ],
      },
    ],
  },
  {
    name: 'Anime',
    slug: 'anime',
    color: '#0d72ea',
    coverUrl: img('photo-1612036782180-6f0b6cd846fe'),
    heroUrl: img('photo-1613376023733-0a73315d9b06', 1800, 620),
    searchQuery: 'anime opening',
    chips: ['Openings', 'J-pop', 'Soundtracks', 'Lo-fi'],
    rows: [
      {
        title: 'Anime playlists',
        items: [
          card('anime', 'Anime Now', 'Openings, endings, and new fan favorites.', img('photo-1612036782180-6f0b6cd846fe')),
          card('anime', 'Shonen Energy', 'Fast, bright, and ready for the final arc.', img('photo-1601850494422-3cf14624b0b3')),
          card('anime', 'Anime Lo-fi', 'Soft beats for studying between episodes.', img('photo-1493246507139-91e8fad9978e')),
        ],
      },
    ],
  },
  {
    name: 'Disney',
    slug: 'disney',
    color: '#0d72ea',
    coverUrl: img('photo-1534447677768-be436bb09401'),
    heroUrl: img('photo-1534447677768-be436bb09401', 1800, 620),
    searchQuery: 'disney',
    chips: ['Classics', 'Princess', 'Pixar', 'Sing-alongs'],
    rows: [
      {
        title: 'Disney playlists',
        items: [
          card('disney', 'Disney Favorites', 'Sing-along moments from animated classics.', img('photo-1500530855697-b586d89ba3ee')),
          card('disney', 'Pixar Hits', 'Bright, playful music for every adventure.', img('photo-1518791841217-8f162f1e1131')),
          card('disney', 'Disney Love Songs', 'Warm ballads and happily-ever-after hooks.', img('photo-1516589178581-6cd7833ae3b2')),
        ],
      },
    ],
  },
  { name: 'Made For You', slug: 'made-for-you', color: '#1e3264', coverUrl: img('photo-1493225457124-a3eb161ffa5f'), heroUrl: img('photo-1493225457124-a3eb161ffa5f', 1800, 620), searchQuery: 'recommended' },
  { name: 'New Releases', slug: 'new-releases', color: '#608108', coverUrl: img('photo-1494232410401-ad00d5433cfa'), heroUrl: img('photo-1494232410401-ad00d5433cfa', 1800, 620), searchQuery: 'new releases' },
  { name: 'Mandopop', slug: 'mandopop', color: '#23366f', coverUrl: img('photo-1516280440614-37939bbacd81'), heroUrl: img('photo-1501386761578-eac5c94b800a', 1800, 620), searchQuery: 'mandopop' },
  { name: 'Pop', slug: 'pop', color: '#477d95', coverUrl: img('photo-1516280440614-37939bbacd81'), heroUrl: img('photo-1501386761578-eac5c94b800a', 1800, 620), searchQuery: 'pop' },
  { name: 'K-Pop', slug: 'k-pop', color: '#e8115b', coverUrl: img('photo-1506157786151-b8491531f063'), heroUrl: img('photo-1506157786151-b8491531f063', 1800, 620), searchQuery: 'k-pop' },
  { name: 'Hip-Hop', slug: 'hip-hop', color: '#477d95', coverUrl: img('photo-1521337581100-8ca9a73a5f79'), heroUrl: img('photo-1521337581100-8ca9a73a5f79', 1800, 620), searchQuery: 'hip-hop' },
  { name: 'Charts', slug: 'charts', color: '#8d67ab', to: '/charts', coverUrl: img('photo-1514525253161-7a46d19cd819'), heroUrl: img('photo-1514525253161-7a46d19cd819', 1800, 620), searchQuery: 'charts' },
  { name: 'Podcast Charts', slug: 'podcast-charts', color: '#0d72ea', kind: 'podcasts', to: '/podcasts', coverUrl: img('photo-1590602847861-f357a9332bbc'), heroUrl: img('photo-1590602847861-f357a9332bbc', 1800, 620), searchQuery: 'podcast charts' },
  { name: 'Educational', slug: 'educational', color: '#477d95', kind: 'podcasts', to: '/podcasts', coverUrl: img('photo-1516321318423-f06f85e504b3'), heroUrl: img('photo-1516321318423-f06f85e504b3', 1800, 620), searchQuery: 'educational podcasts' },
  { name: 'Documentary', slug: 'documentary', color: '#503750', kind: 'podcasts', to: '/podcasts', coverUrl: img('photo-1495020689067-958852a7765e'), heroUrl: img('photo-1495020689067-958852a7765e', 1800, 620), searchQuery: 'documentary podcasts' },
  { name: 'Comedy', slug: 'comedy', color: '#af2896', kind: 'podcasts', to: '/podcasts', coverUrl: img('photo-1527224857830-43a7acc85260'), heroUrl: img('photo-1527224857830-43a7acc85260', 1800, 620), searchQuery: 'comedy' },
  { name: 'J-Tracks', slug: 'j-tracks', color: '#8c1932', coverUrl: img('photo-1511671782779-c97d3d27a1d4'), heroUrl: img('photo-1511671782779-c97d3d27a1d4', 1800, 620), searchQuery: 'j-pop' },
  { name: 'Indie', slug: 'indie', color: '#e8115b', coverUrl: img('photo-1493225457124-a3eb161ffa5f'), heroUrl: img('photo-1493225457124-a3eb161ffa5f', 1800, 620), searchQuery: 'indie' },
  { name: 'Dance / Electronic', slug: 'electronic', color: '#477d95', coverUrl: img('photo-1571266028243-d220c9c3c5e3'), heroUrl: img('photo-1571266028243-d220c9c3c5e3', 1800, 620), searchQuery: 'electronic' },
  { name: 'Mood', slug: 'mood', color: '#e1118c', to: '/moods', coverUrl: img('photo-1500530855697-b586d89ba3ee'), heroUrl: img('photo-1500530855697-b586d89ba3ee', 1800, 620), searchQuery: 'mood' },
  { name: 'Discover', slug: 'discover', color: '#8d67ab', coverUrl: img('photo-1514525253161-7a46d19cd819'), heroUrl: img('photo-1514525253161-7a46d19cd819', 1800, 620), searchQuery: 'discover' },
  { name: 'Sleep', slug: 'sleep', color: '#1e3264', to: '/moods', coverUrl: img('photo-1500530855697-b586d89ba3ee'), heroUrl: img('photo-1500530855697-b586d89ba3ee', 1800, 620), searchQuery: 'sleep' },
  { name: 'Chill', slug: 'chill', color: '#b06239', to: '/moods', coverUrl: img('photo-1493246507139-91e8fad9978e'), heroUrl: img('photo-1493246507139-91e8fad9978e', 1800, 620), searchQuery: 'chill' },
  { name: 'Love', slug: 'love', color: '#dc148c', coverUrl: img('photo-1516589178581-6cd7833ae3b2'), heroUrl: img('photo-1516589178581-6cd7833ae3b2', 1800, 620), searchQuery: 'love songs', chips: ['Romance', 'Intimacy', 'Heartbreak', 'Wedding'] },
  { name: 'RADAR', slug: 'radar', color: '#a56752', coverUrl: img('photo-1524368535928-5b5e00ddc76b'), heroUrl: img('photo-1524368535928-5b5e00ddc76b', 1800, 620), searchQuery: 'radar' },
  { name: 'R&B', slug: 'rnb', color: '#d66d00', coverUrl: img('photo-1516280440614-37939bbacd81'), heroUrl: img('photo-1516280440614-37939bbacd81', 1800, 620), searchQuery: 'rnb' },
  { name: 'Workout Music', slug: 'workout', color: '#777777', to: '/moods', coverUrl: img('photo-1517836357463-d25dfeac3438'), heroUrl: img('photo-1518611012118-696072aa579a', 1800, 620), searchQuery: 'workout' },
  { name: 'Soundtracks', slug: 'soundtracks', color: '#3046c7', coverUrl: img('photo-1489599849927-2ee91cede3ba'), heroUrl: img('photo-1489599849927-2ee91cede3ba', 1800, 620), searchQuery: 'soundtracks' },
  { name: 'Party', slug: 'party', color: '#8d67ab', to: '/moods', coverUrl: img('photo-1492684223066-81342ee5ff30'), heroUrl: img('photo-1492684223066-81342ee5ff30', 1800, 620), searchQuery: 'party' },
  { name: 'TV & Movies', slug: 'tv-movies', color: '#148a08', coverUrl: img('photo-1489599849927-2ee91cede3ba'), heroUrl: img('photo-1489599849927-2ee91cede3ba', 1800, 620), searchQuery: 'movie soundtrack' },
  { name: 'Rock', slug: 'rock', color: '#006450', coverUrl: img('photo-1498038432885-c6f3f1b912ee'), heroUrl: img('photo-1498038432885-c6f3f1b912ee', 1800, 620), searchQuery: 'rock' },
  { name: 'Latin', slug: 'latin', color: '#0d72ea', coverUrl: img('photo-1514525253161-7a46d19cd819'), heroUrl: img('photo-1514525253161-7a46d19cd819', 1800, 620), searchQuery: 'latin' },
  { name: 'Country', slug: 'country', color: '#e13300', coverUrl: img('photo-1500530855697-b586d89ba3ee'), heroUrl: img('photo-1500530855697-b586d89ba3ee', 1800, 620), searchQuery: 'country' },
  { name: 'At Home', slug: 'at-home', color: '#477d95', to: '/moods', coverUrl: img('photo-1505693416388-ac5ce068fe85'), heroUrl: img('photo-1505693416388-ac5ce068fe85', 1800, 620), searchQuery: 'at home' },
  { name: 'Decades', slug: 'decades', color: '#a56752', coverUrl: img('photo-1494232410401-ad00d5433cfa'), heroUrl: img('photo-1494232410401-ad00d5433cfa', 1800, 620), searchQuery: 'decades' },
  { name: 'Instrumental', slug: 'instrumental', color: '#477d95', coverUrl: img('photo-1511379938547-c1f69419868d'), heroUrl: img('photo-1511379938547-c1f69419868d', 1800, 620), searchQuery: 'instrumental' },
  { name: 'Wellness', slug: 'wellness', color: '#148a08', to: '/moods', coverUrl: img('photo-1506126613408-eca07ce68773'), heroUrl: img('photo-1506126613408-eca07ce68773', 1800, 620), searchQuery: 'wellness' },
  { name: 'Punk', slug: 'punk', color: '#e8115b', coverUrl: img('photo-1498038432885-c6f3f1b912ee'), heroUrl: img('photo-1498038432885-c6f3f1b912ee', 1800, 620), searchQuery: 'punk' },
  { name: 'Ambient', slug: 'ambient', color: '#148a08', coverUrl: img('photo-1500530855697-b586d89ba3ee'), heroUrl: img('photo-1500530855697-b586d89ba3ee', 1800, 620), searchQuery: 'ambient' },
  { name: 'Blues', slug: 'blues', color: '#0d72ea', coverUrl: img('photo-1510915361894-db8b60106cb1'), heroUrl: img('photo-1510915361894-db8b60106cb1', 1800, 620), searchQuery: 'blues' },
  { name: 'Metal', slug: 'metal', color: '#424242', coverUrl: img('photo-1498038432885-c6f3f1b912ee'), heroUrl: img('photo-1498038432885-c6f3f1b912ee', 1800, 620), searchQuery: 'metal' },
  { name: 'Jazz', slug: 'jazz', color: '#8d67ab', coverUrl: img('photo-1511192336575-5a79af67a629'), heroUrl: img('photo-1511192336575-5a79af67a629', 1800, 620), searchQuery: 'jazz' },
  { name: 'Classical', slug: 'classical', color: '#81472b', coverUrl: img('photo-1507838153414-b4b713384a76'), heroUrl: img('photo-1507838153414-b4b713384a76', 1800, 620), searchQuery: 'classical' },
]

export const fallbackBrowseColor = '#477d95'

export function getBrowseCategoryBySlug(slug: string) {
  return curatedBrowseCategories.find((category) => category.slug === slug)
}

export function getBrowseCoverUrl(slug: string, imageUrl?: string | null) {
  const category = getBrowseCategoryBySlug(slug)
  return category?.coverUrl ?? imageUrl ?? square(slug)
}

export function getBrowseHeroUrl(slug: string, imageUrl?: string | null) {
  const category = getBrowseCategoryBySlug(slug)
  return category?.heroUrl ?? imageUrl ?? category?.coverUrl ?? hero(slug)
}

export function getBrowseSearchQuery(slug: string, name: string) {
  return getBrowseCategoryBySlug(slug)?.searchQuery ?? name
}

export function getBrowseChips(slug: string) {
  return getBrowseCategoryBySlug(slug)?.chips ?? []
}

export function getBrowseFallbackRows(slug: string, name: string): BrowseFeatureRow[] {
  const category = getBrowseCategoryBySlug(slug)
  if (category?.rows?.length) return category.rows

  return [
    {
      title: `${name} playlists`,
      href: `/genres/${slug}`,
      items: [
        card(slug, `${name} Essentials`, `The core sounds and standout moments in ${name}.`, getBrowseCoverUrl(slug)),
        card(slug, `Best of ${name}`, `A polished set of favorite ${name} tracks.`, square(`${slug}-best`)),
        card(slug, `${name} Mix`, `A varied mix for when you want more ${name}.`, square(`${slug}-mix`)),
        card(slug, `Fresh ${name}`, `New and recent sounds from the ${name} lane.`, square(`${slug}-fresh`)),
      ],
    },
  ]
}
