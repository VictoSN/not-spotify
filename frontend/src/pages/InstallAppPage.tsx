import { useState } from 'react'
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  MusicalNoteIcon,
  UserGroupIcon,
  WifiIcon,
} from '@heroicons/react/24/outline'
import { SpotifyMark } from '@/components/common/SpotifyMark'
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

export function InstallAppPage() {
  useDocumentTitle('Install App')
  const [platform] = useState(detectDownloadPlatform)
  const [prompting, setPrompting] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const { canPrompt, isStandalone, promptInstall } = useInstallApp()
  const platformLabel = PLATFORM_LABELS[platform]
  const isWindows = platform === 'windows'

  const installWebApp = async () => {
    setPrompting(true)
    try {
      const shown = await promptInstall()
      if (!shown) setShowInstructions(true)
    } catch {
      setShowInstructions(true)
    } finally {
      setPrompting(false)
    }
  }

  return (
    <div data-testid="install-app-page" className="px-3 pt-3 sm:px-5 sm:pt-5">
      <section className="relative isolate mx-auto min-h-[500px] max-w-[1440px] overflow-hidden rounded-xl bg-[linear-gradient(135deg,#efb3df_0%,#e8bedc_22%,#b8dfe3_56%,#62d5ad_100%)] text-[#151515] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="pointer-events-none absolute -bottom-44 -left-24 h-80 w-80 rounded-full bg-[#4fe0b5]/50 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-white/45 blur-3xl" />

        <div className="relative mx-auto grid min-h-[500px] max-w-[1240px] items-center gap-12 px-7 py-12 sm:px-12 lg:grid-cols-[0.82fr_1.18fr] lg:px-16 lg:py-14">
          <div className="max-w-xl">
            <div className="flex items-center gap-2.5">
              <SpotifyMark className="h-8 w-8 text-black" />
              <span className="text-xl font-black tracking-[-0.035em]">Not Spotify</span>
            </div>

            <p className="mt-10 text-xs font-black uppercase tracking-[0.2em] text-black/55">
              Built for {platformLabel}
            </p>
            <h1 className="mt-3 text-4xl font-black leading-[1.02] tracking-[-0.055em] sm:text-5xl lg:text-[54px]">
              {isWindows ? 'Download Not Spotify for Windows' : `Install Not Spotify on ${platformLabel}`}
            </h1>
            <p className="mt-6 max-w-lg text-base font-semibold leading-7 text-black/72 sm:text-lg">
              Enjoy high-quality audio and offline playback, plus a focused desktop experience and live Friend Activity that keeps your music close.
            </p>

            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap">
              {isWindows ? (
                <a
                  href={WINDOWS_SETUP_URL}
                  download={WINDOWS_SETUP_FILENAME}
                  className="inline-flex items-center gap-3 rounded-md bg-[#171717] px-5 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.02] hover:bg-black"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />
                  Download for Windows
                </a>
              ) : isStandalone ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-black/10 px-5 py-3 text-sm font-black">
                  <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />
                  App installed
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void installWebApp()}
                  disabled={prompting}
                  className="inline-flex items-center gap-3 rounded-md bg-[#171717] px-5 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.02] hover:bg-black disabled:cursor-wait disabled:opacity-65"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />
                  {prompting ? 'Opening installer…' : canPrompt ? 'Install web app' : 'Show install steps'}
                </button>
              )}

              {isWindows && !isStandalone && (
                <button
                  type="button"
                  onClick={() => void installWebApp()}
                  disabled={prompting}
                  className="inline-flex items-center gap-2 rounded-md border border-black/30 bg-white/25 px-4 py-3 text-sm font-black transition hover:bg-white/40 disabled:cursor-wait disabled:opacity-65"
                >
                  <DevicePhoneMobileIcon className="h-5 w-5" aria-hidden="true" />
                  {prompting ? 'Opening…' : canPrompt ? 'Install web app' : 'Web app steps'}
                </button>
              )}
            </div>

            <a
              href={WINDOWS_MSI_URL}
              download={WINDOWS_MSI_FILENAME}
              className="mt-5 inline-block text-sm font-bold underline decoration-black/35 underline-offset-4 transition hover:text-black/65"
            >
              Download the MSI package instead
            </a>

            {showInstructions && (
              <div
                className="mt-6 grid max-w-2xl gap-3 xl:grid-cols-2"
                aria-live="polite"
              >
                {[
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
                ].map(({ heading, steps }) => (
                  <div
                    key={heading}
                    className="rounded-lg border border-black/15 bg-white/35 p-4 text-sm leading-6 backdrop-blur-sm"
                  >
                    <p className="font-black">{heading}</p>
                    <ol className="mt-3 space-y-2">
                      {steps.map((step, index) => (
                        <li key={step} className="flex gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/85 text-[11px] font-black text-white">
                            {index + 1}
                          </span>
                          <span className="font-semibold text-black/80">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/*
            Laptop illustration. Screen + base are stacked in a flex column so they
            stay glued together at every width — the previous absolutely-positioned
            layout let the aspect-ratio screen shrink upward while the base stayed
            pinned to the bottom, creating a visible gap. Hidden below xl because
            the shell's sidebar makes narrower widths too cramped for it to read.
          */}
          <div className="relative mx-auto hidden w-full max-w-[650px] flex-col items-center xl:flex" aria-hidden="true">
            <div className="w-[91%] rounded-[22px] border-[5px] border-[#171717] bg-[#171717] p-2 shadow-[0_28px_55px_rgba(0,0,0,0.32)]">
              <div className="aspect-[16/10] overflow-hidden rounded-[13px] bg-[#121212]">
                <div className="flex h-9 items-center gap-2 border-b border-white/5 bg-black px-3">
                  <SpotifyMark className="h-4 w-4 text-[#1ed760]" />
                  <div className="ml-auto h-4 w-44 rounded-full bg-white/10" />
                  <div className="h-4 w-4 rounded-full bg-white/15" />
                </div>
                <div className="grid h-[calc(100%-2.25rem)] grid-cols-[52px_1fr]">
                  <div className="space-y-2 border-r border-white/5 bg-[#0d0d0d] p-2">
                    {['#c176ed', '#7bc7e8', '#f6ca60', '#1ed760', '#f07c9f'].map((color) => (
                      <div key={color} className="aspect-square rounded-md" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <div className="p-4">
                    <div className="flex gap-2">
                      {['All', 'Music', 'Podcasts'].map((label, index) => (
                        <span key={label} className={`rounded-full px-3 py-1 text-[8px] font-black ${index === 0 ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>
                          {label}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      {[
                        ['#f38aaa', 'Daily Mix'],
                        ['#6c50d9', 'For You'],
                        ['#2aaf73', 'New Music'],
                        ['#e3a42e', 'Charts'],
                        ['#337cc8', 'Podcasts'],
                        ['#d84e58', 'Videos'],
                      ].map(([color, label]) => (
                        <div key={label}>
                          <div className="aspect-square rounded-md shadow-lg" style={{ background: `linear-gradient(145deg, ${color}, #171717)` }} />
                          <p className="mt-1.5 truncate text-[9px] font-bold text-white">{label}</p>
                          <div className="mt-1 h-1.5 w-2/3 rounded bg-white/15" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative w-full">
              <div className="h-6 w-full rounded-b-[48px] bg-[linear-gradient(to_bottom,#d8d8d8,#8c8c8c)] shadow-xl" />
              <div className="absolute left-1/2 top-0 h-1.5 w-28 -translate-x-1/2 rounded-b-full bg-[#666]" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1180px] gap-4 px-2 pb-2 pt-10 sm:grid-cols-3 sm:px-4">
        {[
          {
            Icon: MusicalNoteIcon,
            title: 'High-quality listening',
            copy: 'Use the full player, queue, lyrics, equalizer, crossfade, and Premium quality options.',
          },
          {
            Icon: WifiIcon,
            title: 'Ready offline',
            copy: 'Premium listeners can keep supported music available through downloads and offline audio storage.',
          },
          {
            Icon: UserGroupIcon,
            title: 'Friends in real time',
            copy: 'See Friend Activity, exchange messages, build a Blend, and listen together in a Jam.',
          },
        ].map(({ Icon, title, copy }) => (
          <article key={title} className="rounded-xl border border-primary/10 bg-surface p-5">
            <Icon className="h-6 w-6 text-accent" aria-hidden="true" />
            <h2 className="mt-4 text-base font-black text-primary">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-secondary">{copy}</p>
          </article>
        ))}
      </section>

      <div className="mx-auto mt-4 flex max-w-[1180px] items-center gap-3 rounded-xl border border-primary/10 bg-elevated/50 px-5 py-4 text-sm text-secondary">
        <ComputerDesktopIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
        The native Windows app and installed web app use the same account, library, and backend as the browser player.
      </div>
    </div>
  )
}
