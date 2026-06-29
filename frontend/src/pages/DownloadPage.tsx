import { useState } from 'react'
import {
  ArrowDownToLine,
  BellRing,
  Check,
  Download,
  Laptop,
  MonitorDown,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from 'lucide-react'
import { SpotifyMark } from '@/components/common/SpotifyMark'
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
import { cn } from '@/utils/cn'

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
          'inline-flex items-center justify-center gap-2 rounded-full bg-accent/15 px-6 py-3 font-bold text-accent',
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
        'inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 font-bold text-black transition hover:scale-[1.02] hover:bg-accent-dark disabled:cursor-wait disabled:opacity-70',
        className,
      )}
    >
      <ArrowDownToLine className="h-5 w-5" aria-hidden="true" />
      {isPrompting
        ? 'Opening installer…'
        : canPrompt
          ? 'Install web app'
          : 'Show install steps'}
    </button>
  )
}

function WindowsDownloadButton({ className }: { className?: string }) {
  return (
    <a
      href={WINDOWS_SETUP_URL}
      download={WINDOWS_SETUP_FILENAME}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 font-bold text-black transition hover:scale-[1.02] hover:bg-accent-dark',
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
    <div className="relative isolate overflow-hidden px-4 pb-8 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem] bg-[radial-gradient(circle_at_50%_10%,rgba(30,215,96,0.28),transparent_42%),linear-gradient(to_bottom,rgba(30,215,96,0.08),transparent_78%)]" />

      <section className="mx-auto flex max-w-5xl flex-col items-center px-2 pb-12 pt-16 text-center sm:pt-24">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">
          <SpotifyMark className="h-5 w-5" />
          Made for {platformLabel}
        </span>
        <h1 className="max-w-4xl text-4xl font-black tracking-[-0.045em] text-primary sm:text-6xl lg:text-7xl">
          Your music, one click away.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-secondary sm:text-lg">
          Install not-spotify for a focused, app-like player with offline saves,
          native notifications, and no browser-tab clutter.
        </p>

        <div className="mt-9 flex w-full max-w-xl flex-col items-center gap-3 sm:w-auto sm:flex-row">
          {recommendsWindowsInstaller ? (
            <WindowsDownloadButton className="w-full sm:w-auto" />
          ) : (
            <WebAppInstallButton
              className="w-full sm:w-auto"
              onInstructions={() => setShowInstructions(true)}
            />
          )}
          {!recommendsWindowsInstaller && (
            <WindowsDownloadButton className="w-full border border-primary/15 bg-elevated text-primary hover:bg-primary/15 sm:w-auto" />
          )}
        </div>

        <p className="mt-3 text-xs text-muted">
          {recommendsWindowsInstaller
            ? 'Windows 10 or 11 · 64-bit · version 0.1.0'
            : 'The installable web app is the supported app for macOS, Linux, iPhone, iPad, and Android.'}
        </p>
      </section>

      <section
        className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2"
        aria-label="Download options"
      >
        <article className="rounded-3xl border border-primary/10 bg-surface/90 p-6 shadow-xl shadow-black/10 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <MonitorDown className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-secondary">
              Windows 10/11
            </span>
          </div>
          <h2 className="mt-6 text-2xl font-black text-primary">
            Desktop setup
          </h2>
          <p className="mt-2 leading-relaxed text-secondary">
            The native 64-bit Tauri client, packaged as a standard Windows setup
            executable. It connects to the production service out of the box.
          </p>
          <div className="mt-7 flex flex-col items-start gap-3">
            <WindowsDownloadButton />
            <a
              href={WINDOWS_MSI_URL}
              download={WINDOWS_MSI_FILENAME}
              className="text-sm font-bold text-secondary underline decoration-secondary/40 underline-offset-4 transition hover:text-primary"
            >
              Download the MSI package instead
            </a>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Windows may show an “Unknown publisher” warning because this
            academic build is not code-signed.
          </p>
        </article>

        <article className="rounded-3xl border border-primary/10 bg-surface/90 p-6 shadow-xl shadow-black/10 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7c5cff]/15 text-[#9a83ff]">
              <Smartphone className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-secondary">
              macOS &amp; mobile
            </span>
          </div>
          <h2 className="mt-6 text-2xl font-black text-primary">
            Installable web app
          </h2>
          <p className="mt-2 leading-relaxed text-secondary">
            Add the full app to your Dock or home screen. It opens in its own
            window, receives updates automatically, and needs no separate
            package file.
          </p>
          <div className="mt-7">
            <WebAppInstallButton
              onInstructions={() => setShowInstructions(true)}
            />
          </div>

          {(showInstructions || platform !== 'windows') && (
            <div
              className="mt-6 rounded-2xl bg-primary/5 p-4"
              aria-live="polite"
              data-testid="manual-install-steps"
            >
              <p className="text-sm font-bold text-primary">
                Install on {platformLabel}
              </p>
              <ol className="mt-3 space-y-2 text-sm leading-relaxed text-secondary">
                {MANUAL_INSTALL_STEPS[platform].map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-black text-accent">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </article>
      </section>

      <section
        className="mx-auto mt-5 grid max-w-5xl gap-4 rounded-3xl border border-primary/10 bg-elevated/55 p-6 sm:grid-cols-3 sm:p-8"
        aria-label="App benefits"
      >
        {[
          {
            Icon: WifiOff,
            title: 'Offline saves',
            copy: 'Keep saved media ready when your connection drops.',
          },
          {
            Icon: BellRing,
            title: 'Native alerts',
            copy: 'See messages and listening updates outside the browser.',
          },
          {
            Icon: ShieldCheck,
            title: 'Verified source',
            copy: 'Built directly from this repository with the Tauri toolchain.',
          },
        ].map(({ Icon, title, copy }) => (
          <div key={title} className="flex gap-4">
            <Icon
              className="mt-0.5 h-5 w-5 shrink-0 text-accent"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-bold text-primary">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-secondary">
                {copy}
              </p>
            </div>
          </div>
        ))}
      </section>

      <div className="mx-auto mt-6 flex max-w-5xl items-center gap-3 rounded-2xl border border-primary/10 px-5 py-4 text-sm text-secondary">
        <Laptop className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
        Already installed? The app updates when a new release is deployed; your
        library and account stay synced across devices.
      </div>
    </div>
  )
}
