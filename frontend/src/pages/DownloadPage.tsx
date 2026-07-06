import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  Download,
  Headphones,
  LogOut,
  MonitorDown,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { Avatar } from '@/components/ui/Avatar'
import { APP_PREVIEW_URL } from '@/config/assets'
import {
  detectDownloadPlatform,
  PLATFORM_LABELS,
  WINDOWS_MSI_FILENAME,
  WINDOWS_MSI_URL,
  WINDOWS_SETUP_FILENAME,
  WINDOWS_SETUP_URL,
} from '@/config/downloads'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useInstallApp } from '@/hooks/useInstallApp'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'

// Shown in the "Listen on mobile and tablet, too" section, which is about phones/tablets
// specifically — so the steps stay mobile-focused regardless of the visitor's desktop OS.
const MOBILE_INSTALL_STEPS: Array<{ heading: string; steps: string[] }> = [
  {
    heading: 'On iPhone or iPad',
    steps: [
      'Open this page in Safari on your device.',
      'Tap the Share button, then choose “Add to Home Screen”.',
      'Tap Add — Not Spotify appears on your home screen.',
    ],
  },
  {
    heading: 'On Android tablet or phone',
    steps: [
      'Open this page in Chrome on your device.',
      'Open the browser menu (⋮) and choose “Install app” or “Add to Home screen”.',
      'Confirm to install — Not Spotify appears in your app drawer.',
    ],
  },
]

function DownloadHeader() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    const closeMenu = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-white/10 bg-black text-white">
      <div className="mx-auto flex h-full max-w-[1180px] items-center px-5 sm:px-7">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Not Spotify home">
          <SpotifyMark className="h-8 w-8" />
          <span className="hidden text-[18px] font-black tracking-[-0.03em] sm:block">
            Not Spotify
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-8 md:flex" aria-label="Main navigation">
          <Link to="/premium" className="text-[13px] font-bold transition hover:text-accent">
            Premium plans
          </Link>
          <Link to="/support" className="text-[13px] font-bold transition hover:text-accent">
            Support
          </Link>
          <span className="text-[13px] font-bold text-accent" aria-current="page">
            Download
          </span>
        </nav>

        <div className="ml-auto flex items-center md:ml-7">
          <div className="mr-5 hidden h-6 w-px bg-white/25 md:block" />
          {isAuthenticated ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full px-2 py-1.5 transition hover:bg-white/10"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <Avatar
                  src={user?.avatarUrl}
                  alt={user?.name ?? 'Profile'}
                  size="sm"
                  round
                  className="bg-[#282828] text-white"
                />
                <span className="hidden max-w-32 truncate text-[13px] font-bold sm:block">
                  {user?.name ?? 'Profile'}
                </span>
                <ChevronDown
                  className={cn('hidden h-4 w-4 transition-transform sm:block', menuOpen && 'rotate-180')}
                  aria-hidden="true"
                />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-lg bg-[#282828] py-1 shadow-2xl ring-1 ring-white/10"
                  role="menu"
                >
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-[13px] font-bold hover:bg-white/10"
                    role="menuitem"
                  >
                    <UserRound className="h-4 w-4 text-white/70" aria-hidden="true" />
                    Profile
                  </Link>
                  <Link
                    to="/account"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-[13px] font-bold hover:bg-white/10"
                    role="menuitem"
                  >
                    <ShieldCheck className="h-4 w-4 text-white/70" aria-hidden="true" />
                    Account
                  </Link>
                  <div className="border-t border-white/10" />
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] font-bold hover:bg-white/10"
                    role="menuitem"
                  >
                    <LogOut className="h-4 w-4 text-white/70" aria-hidden="true" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4 text-[13px] font-bold">
              <Link to="/signup" className="hidden transition hover:text-accent sm:inline">
                Sign up
              </Link>
              <Link
                to="/login"
                className="rounded-full bg-white px-5 py-2.5 text-black transition hover:scale-105"
              >
                Log in
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function WebAppInstallButton({
  className,
  onInstructions,
}: {
  className?: string
  onInstructions: () => void
}) {
  const { canPrompt, isStandalone, promptInstall } = useInstallApp()
  const [isPrompting, setIsPrompting] = useState(false)

  if (isStandalone) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full bg-accent/15 px-6 py-3 font-bold text-[#117a37]',
          className,
        )}
        role="status"
      >
        <Check className="h-5 w-5" aria-hidden="true" />
        App installed
      </span>
    )
  }

  const install = async () => {
    setIsPrompting(true)
    try {
      const shown = await promptInstall()
      if (!shown) onInstructions()
    } catch {
      onInstructions()
    } finally {
      setIsPrompting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={install}
      disabled={isPrompting}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full bg-black px-6 py-3 font-bold text-white transition hover:scale-[1.02] hover:bg-[#242424] disabled:cursor-wait disabled:opacity-70',
        className,
      )}
    >
      <ArrowDownToLine className="h-5 w-5" aria-hidden="true" />
      {isPrompting ? 'Opening installer…' : canPrompt ? 'Install web app' : 'Show install steps'}
    </button>
  )
}

function WindowsDownloadButton({ className }: { className?: string }) {
  return (
    <a
      href={WINDOWS_SETUP_URL}
      download={WINDOWS_SETUP_FILENAME}
      className={cn(
        'inline-flex items-center justify-center gap-3 rounded-full bg-accent px-7 py-3.5 font-black text-black transition hover:scale-[1.02] hover:bg-[#3be477]',
        className,
      )}
    >
      <Download className="h-5 w-5" aria-hidden="true" />
      Download for Windows
    </a>
  )
}

export function DownloadPage() {
  useDocumentTitle('Download')
  const [platform] = useState(detectDownloadPlatform)
  const platformLabel = PLATFORM_LABELS[platform]
  const recommendsWindowsInstaller = platform === 'windows'
  // Mobile/tablet steps are always visible now, so the button's fallback for
  // "prompt not available" has nowhere to send the user — treat it as a no-op.
  const openSteps = () => {}

  return (
    <div className="min-h-screen bg-white text-black antialiased">
      <DownloadHeader />

      <main>
        <section className="relative isolate overflow-hidden bg-[#121212] text-white">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_76%_30%,rgba(30,215,96,0.3),transparent_25%),radial-gradient(circle_at_18%_120%,rgba(124,92,255,0.38),transparent_43%)]" />
          <div className="mx-auto grid min-h-[500px] max-w-[1180px] items-center gap-12 px-5 py-16 sm:px-7 lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
            <div className="relative z-10 max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em]">
                <SpotifyMark className="h-5 w-5 text-accent" />
                Built for {platformLabel}
              </span>
              <h1 className="mt-6 text-5xl font-black leading-[0.98] tracking-[-0.055em] sm:text-6xl">
                Download Not Spotify
              </h1>
              <p className="mt-6 max-w-lg text-lg font-bold leading-relaxed text-white/78 sm:text-xl">
                Millions of songs, one focused app. Take your library, playlists, and listening history with you.
              </p>

              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                {recommendsWindowsInstaller ? (
                  <WindowsDownloadButton />
                ) : (
                  <>
                    <WebAppInstallButton
                      className="bg-accent text-black hover:bg-[#3be477]"
                      onInstructions={openSteps}
                    />
                    <WindowsDownloadButton className="border border-white/20 bg-white/10 text-white hover:bg-white/15" />
                  </>
                )}
              </div>
              <p className="mt-4 text-xs font-bold text-white/55">
                {recommendsWindowsInstaller
                  ? 'Windows 10 or 11 · 64-bit · version 0.1.0'
                  : 'No package needed — install the web app directly from your browser.'}
              </p>
              <a
                href={WINDOWS_MSI_URL}
                download={WINDOWS_MSI_FILENAME}
                className="mt-3 inline-block text-xs font-bold text-white/70 underline decoration-white/30 underline-offset-4 transition hover:text-white"
              >
                Download the MSI package instead
              </a>
            </div>

            {/*
              Real screenshot of the Not Spotify desktop app, shown inside a laptop
              frame. Scales fluidly (w-full up to a max) so it reads on mobile, tablet
              and desktop; the SVG source stays crisp at any size.
            */}
            <div className="relative z-10 mx-auto w-full max-w-[560px]">
              <div className="overflow-hidden rounded-t-[16px] border border-b-0 border-white/12 bg-[#161616] p-2 shadow-2xl shadow-black/60 sm:p-2.5">
                <img
                  src={APP_PREVIEW_URL}
                  alt="Screenshot of the Not Spotify desktop app showing the Home screen with your library, personalized “Made for you” playlists, and the now-playing bar."
                  width={1024}
                  height={640}
                  decoding="async"
                  fetchPriority="high"
                  className="block aspect-[16/10] w-full rounded-md object-cover"
                />
              </div>
              <div className="h-3 rounded-b-[12px] bg-gradient-to-b from-[#3a3a3a] to-[#181818] shadow-xl sm:h-4" />
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-16 sm:px-7 sm:py-20">
          <div className="mx-auto max-w-[980px] text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#16883e]">Every screen, same library</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Listen on mobile and tablet, too
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-neutral-600">
              Add the installable web app to your home screen or Dock. It opens in its own window and updates automatically.
            </p>

            <div
              id="manual-install-steps"
              data-testid="manual-install-steps"
              className="mx-auto mt-10 grid max-w-3xl gap-4 text-left sm:grid-cols-2"
            >
              {MOBILE_INSTALL_STEPS.map(({ heading, steps }) => (
                <div key={heading} className="rounded-2xl bg-[#f2f2f2] p-5">
                  <p className="font-black">{heading}</p>
                  <ol className="mt-4 space-y-3 text-sm leading-relaxed text-[#555]">
                    {steps.map((step, index) => (
                      <li key={step} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent font-black text-black">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#4b00e6] px-5 py-16 text-white sm:px-7 sm:py-20">
          <div className="pointer-events-none absolute -left-20 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full border-[50px] border-[#ff3158]/80" />
          <div className="pointer-events-none absolute -right-20 top-5 h-72 w-72 rounded-full border-[58px] border-accent/70" />
          <div className="relative mx-auto max-w-[980px] text-center">
            <Headphones className="mx-auto h-12 w-12" aria-hidden="true" />
            <h2 className="mt-5 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              One account, listen everywhere
            </h2>
            <p className="mx-auto mt-4 max-w-xl font-bold text-white/75">
              Your library and listening history stay synced across every supported device.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-x-7 gap-y-3 text-sm font-black">
              <span>Mobile</span>
              <span>Computer</span>
              <span>Tablet</span>
              <span>Web Player</span>
            </div>
          </div>
        </section>

        <section className="bg-[#121212] px-5 py-8 text-white sm:px-7">
          <div className="mx-auto flex max-w-[980px] flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex items-center gap-3">
              <MonitorDown className="h-5 w-5 text-accent" aria-hidden="true" />
              <p className="text-sm font-bold text-white/65">
                Windows may show an “Unknown publisher” notice because this academic build is not code-signed.
              </p>
            </div>
            <Link to="/support?topic=web-player-help" className="shrink-0 text-sm font-black underline underline-offset-4 hover:text-accent">
              Get help
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
