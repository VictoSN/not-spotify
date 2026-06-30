import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  Download,
  Headphones,
  Laptop,
  LogOut,
  MonitorDown,
  Music2,
  ShieldCheck,
  Smartphone,
  Tablet,
  UserRound,
} from 'lucide-react'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { Avatar } from '@/components/ui/Avatar'
import {
  detectDownloadPlatform,
  PLATFORM_LABELS,
  WINDOWS_MSI_FILENAME,
  WINDOWS_MSI_URL,
  WINDOWS_SETUP_FILENAME,
  WINDOWS_SETUP_URL,
  type DownloadPlatform,
} from '@/config/downloads'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useInstallApp } from '@/hooks/useInstallApp'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'
import { IndependentSiteLink } from '@/components/common/IndependentSiteLink'
import { mainAppUrl } from '@/utils/independentSites'

const MANUAL_INSTALL_STEPS: Record<DownloadPlatform, string[]> = {
  windows: [
    'Open this page in Chrome or Edge.',
    'Select the install icon in the address bar, or open the browser menu and choose “Install not-spotify”.',
  ],
  macos: [
    'In Safari, choose File → Add to Dock. In Chrome, select the install icon in the address bar.',
    'Confirm Add or Install when your browser asks.',
  ],
  ios: [
    'Open this page in Safari and tap the Share button.',
    'Choose “Add to Home Screen”, then tap Add.',
  ],
  android: [
    'Open this page in Chrome and open the browser menu.',
    'Choose “Install app” or “Add to Home screen”, then confirm.',
  ],
  linux: [
    'Open this page in Chrome or Edge.',
    'Select the install icon in the address bar, or choose “Install not-spotify” from the browser menu.',
  ],
  other: [
    'Open your browser menu and look for “Install app” or “Add to Home Screen”.',
    'If that option is unavailable, keep using not-spotify in this browser.',
  ],
}

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
        <a href={mainAppUrl('/')} className="flex shrink-0 items-center gap-2" aria-label="Not Spotify home">
          <SpotifyMark className="h-8 w-8" />
          <span className="hidden text-[18px] font-black tracking-[-0.03em] sm:block">
            Not Spotify
          </span>
        </a>

        <nav className="ml-auto hidden items-center gap-8 md:flex" aria-label="Main navigation">
          <a href={mainAppUrl('/premium')} className="text-[13px] font-bold transition hover:text-accent">
            Premium plans
          </a>
          <IndependentSiteLink site="support" className="text-[13px] font-bold transition hover:text-accent">
            Support
          </IndependentSiteLink>
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
                  <a
                    href={mainAppUrl('/profile')}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-[13px] font-bold hover:bg-white/10"
                    role="menuitem"
                  >
                    <UserRound className="h-4 w-4 text-white/70" aria-hidden="true" />
                    Profile
                  </a>
                  <IndependentSiteLink
                    site="account"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-[13px] font-bold hover:bg-white/10"
                    role="menuitem"
                  >
                    <ShieldCheck className="h-4 w-4 text-white/70" aria-hidden="true" />
                    Account
                  </IndependentSiteLink>
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
              <a href={mainAppUrl('/signup')} className="hidden transition hover:text-accent sm:inline">
                Sign up
              </a>
              <a
                href={mainAppUrl('/login')}
                className="rounded-full bg-white px-5 py-2.5 text-black transition hover:scale-105"
              >
                Log in
              </a>
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
  const [showInstructions, setShowInstructions] = useState(false)
  const platformLabel = PLATFORM_LABELS[platform]
  const recommendsWindowsInstaller = platform === 'windows'

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
                      onInstructions={() => setShowInstructions(true)}
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

            <div className="relative mx-auto hidden h-[370px] w-full max-w-[570px] lg:block" aria-hidden="true">
              <div className="absolute left-4 top-4 h-32 w-32 rounded-full bg-accent/25 blur-3xl" />
              <div className="absolute bottom-2 right-6 h-40 w-40 rounded-full bg-[#7c5cff]/45 blur-3xl" />
              <div className="absolute left-1/2 top-4 w-[92%] -translate-x-1/2 rotate-[-2deg] rounded-[26px] border border-white/20 bg-[#242424] p-3 shadow-2xl shadow-black/60">
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#1a3d2b_0%,#142019_46%,#2c1741_100%)]">
                  <div className="absolute inset-x-0 top-0 flex h-10 items-center gap-2 bg-black/45 px-4">
                    <SpotifyMark className="h-5 w-5 text-accent" />
                    <div className="h-2 w-20 rounded-full bg-white/25" />
                  </div>
                  <div className="absolute bottom-6 left-6 h-28 w-28 rotate-6 rounded-xl bg-[linear-gradient(135deg,#1ed760,#177e3a)] shadow-xl" />
                  <div className="absolute bottom-8 left-40 space-y-3">
                    <div className="h-4 w-44 rounded-full bg-white/75" />
                    <div className="h-3 w-28 rounded-full bg-white/30" />
                    <div className="mt-5 flex gap-2">
                      <div className="h-9 w-9 rounded-full bg-accent" />
                      <div className="h-9 w-24 rounded-full border border-white/30" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-1 left-1/2 h-5 w-[103%] -translate-x-1/2 rounded-b-[28px] bg-[#444] shadow-2xl" />
              <div className="absolute -bottom-4 right-3 w-28 rotate-6 rounded-[22px] border-[5px] border-[#333] bg-[#191919] p-2 shadow-2xl">
                <div className="aspect-[9/17] rounded-[14px] bg-[linear-gradient(160deg,#225a37,#171717_58%)] p-3">
                  <SpotifyMark className="h-5 w-5 text-accent" />
                  <Music2 className="mx-auto mt-10 h-10 w-10 text-white/70" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-16 sm:px-7 sm:py-20">
          <div className="mx-auto max-w-[980px] text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#16883e]">Every screen, same library</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Listen on mobile and tablet, too
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#5f5f5f]">
              Add the installable web app to your home screen or Dock. It opens in its own window and updates automatically.
            </p>

            <div className="mt-8 flex justify-center">
              <WebAppInstallButton onInstructions={() => setShowInstructions(true)} />
            </div>

            {(showInstructions || platform !== 'windows') && (
              <div
                className="mx-auto mt-8 max-w-xl rounded-2xl bg-[#f2f2f2] p-5 text-left"
                aria-live="polite"
                data-testid="manual-install-steps"
              >
                <p className="font-black">Install on {platformLabel}</p>
                <ol className="mt-4 space-y-3 text-sm leading-relaxed text-[#555]">
                  {MANUAL_INSTALL_STEPS[platform].map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent font-black text-black">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-4" aria-label="Supported devices">
              {[
                { Icon: Smartphone, label: 'Mobile' },
                { Icon: Tablet, label: 'Tablet' },
                { Icon: Laptop, label: 'Computer' },
              ].map(({ Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-3 rounded-2xl bg-[#f7f7f7] px-3 py-5">
                  <Icon className="h-7 w-7" aria-hidden="true" />
                  <span className="text-sm font-black">{label}</span>
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
            <IndependentSiteLink site="support" path="/support?topic=web-player-help" className="shrink-0 text-sm font-black underline underline-offset-4 hover:text-accent">
              Get help
            </IndependentSiteLink>
          </div>
        </section>
      </main>
    </div>
  )
}
