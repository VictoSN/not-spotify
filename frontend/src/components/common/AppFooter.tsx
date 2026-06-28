import { Link } from 'react-router-dom'

const columns = [
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Jobs', to: '/support' },
      { label: 'For the Record', to: '/support' },
    ],
  },
  {
    title: 'Communities',
    links: [
      { label: 'For Artists', to: '/artist-dashboard' },
      { label: 'Developers', to: '/support' },
      { label: 'Advertising', to: '/support' },
      { label: 'Investors', to: '/support' },
      { label: 'Vendors', to: '/support' },
    ],
  },
  {
    title: 'Useful links',
    links: [
      { label: 'Support', to: '/support' },
      { label: 'Free Mobile App', to: '/support' },
      { label: 'Popular by Country', to: '/search' },
      { label: 'Import your music', to: '/uploads' },
    ],
  },
  {
    title: 'Spotify Plans',
    links: [
      { label: 'Premium Individual', to: '/premium' },
      { label: 'Premium Duo', to: '/premium' },
      { label: 'Premium Family', to: '/premium' },
      { label: 'Premium Student', to: '/premium' },
      { label: 'Spotify Free', to: '/premium' },
    ],
  },
]

const legalLinks = [
  { label: 'Legal', to: '/legal' },
  { label: 'Safety & Privacy Center', to: '/privacy' },
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Cookies', to: '/legal' },
  { label: 'About Ads', to: '/legal' },
  { label: 'Accessibility', to: '/about' },
]

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M4.2 3.5h4.5l4.05 5.42 4.7-5.42h2.15l-5.88 6.79 6.08 8.21h-4.48l-4.3-5.78-5 5.78H3.87l6.18-7.15L4.2 3.5Zm3.42 1.7 8.55 11.6h1.87L9.5 5.2H7.62Z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M13.6 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.25-1.5 1.55-1.5h1.65V3.6c-.29-.04-1.27-.12-2.42-.12-2.4 0-4.05 1.47-4.05 4.16V9.9H7.6V13h2.73v8h3.27Z" />
    </svg>
  )
}

export function AppFooter() {
  return (
    <footer className="mx-4 mt-16 border-t border-primary/10 px-2 pb-8 pt-14 sm:mx-6 sm:px-0 lg:mx-8">
      <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(130px,1fr))_auto]">
        {columns.map((column) => (
          <div key={column.title}>
            <h2 className="mb-3 text-sm font-bold text-primary">{column.title}</h2>
            <ul className="space-y-2.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-sm text-secondary transition-colors hover:text-primary hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="flex gap-3 xl:justify-self-end">
          {[
            { label: 'Instagram', href: 'https://www.instagram.com/spotify', Icon: InstagramIcon },
            { label: 'X', href: 'https://x.com/spotify', Icon: XIcon },
            { label: 'Facebook', href: 'https://www.facebook.com/Spotify', Icon: FacebookIcon },
          ].map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={label}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-primary transition-colors hover:bg-primary/20"
            >
              <Icon />
            </a>
          ))}
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-6 border-t border-primary/10 pt-8 text-xs text-secondary sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-x-5 gap-y-3" aria-label="Legal">
          {legalLinks.map(({ label, to }) => (
            <Link key={label} to={to} className="transition-colors hover:text-primary">
              {label}
            </Link>
          ))}
        </nav>
        <p className="shrink-0">© 2026 not-spotify</p>
      </div>
    </footer>
  )
}
