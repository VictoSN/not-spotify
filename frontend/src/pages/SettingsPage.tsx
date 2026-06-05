import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowTopRightOnSquareIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useThemeStore } from '@/stores/themeStore'
import { usePlayerStore } from '@/stores/playerStore'
import { cn } from '@/utils/cn'

/** Tiny localStorage-backed preference (no effects → lint-clean). */
function usePref<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw != null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  const set = (next: T) => {
    setValue(next)
    try {
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }
  return [value, set]
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-page',
        checked ? 'border-accent bg-accent' : 'border-secondary/20 bg-elevated',
      )}
    >
      <span
        className={cn(
          'absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  label: string
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="shrink-0 rounded-md border border-secondary/20 bg-elevated px-3 py-2 text-sm font-medium text-primary outline-none transition-colors hover:border-secondary/40 focus:border-accent"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-elevated/40 py-6 first:border-t-0">
      <h2 className="mb-2 text-xl font-bold text-primary">{title}</h2>
      <div className="divide-y divide-elevated/20">{children}</div>
    </section>
  )
}

function Row({
  label,
  sub,
  control,
}: {
  label: string
  sub?: string
  control: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-primary">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-secondary">{sub}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

export function SettingsPage() {
  const { theme, setTheme } = useThemeStore()
  const isNowPlayingOpen = usePlayerStore((s) => s.isNowPlayingOpen)
  const toggleNowPlaying = usePlayerStore((s) => s.toggleNowPlaying)

  const [language, setLanguage] = usePref('ns-pref-language', 'en')
  const [streamingQuality, setStreamingQuality] = usePref('ns-pref-quality', 'auto')
  const [normalizeVolume, setNormalizeVolume] = usePref('ns-pref-normalize', false)
  const [compactLibrary, setCompactLibrary] = usePref('ns-pref-compact', false)
  const [autoplay, setAutoplay] = usePref('ns-pref-autoplay', true)
  const [crossfade, setCrossfade] = usePref('ns-pref-crossfade', false)

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-primary">Settings</h1>
        <MagnifyingGlassIcon className="h-5 w-5 text-secondary" />
      </div>

      <Section title="Account">
        <Row
          label="Edit login methods"
          sub="Manage your account, plan, payment and security"
          control={
            <Link
              to="/account"
              className="inline-flex items-center gap-2 rounded-full border border-secondary/50 px-4 py-1.5 text-sm font-bold text-primary transition-all hover:scale-105 hover:border-primary active:scale-95"
            >
              Edit
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </Link>
          }
        />
      </Section>

      <Section title="Appearance">
        <Row
          label="Theme"
          sub="Dark and light use the same music-first green accent"
          control={
            <Select
              label="Theme"
              value={theme}
              onChange={(v) => setTheme(v as 'dark' | 'light')}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
            />
          }
        />
      </Section>

      <Section title="Language">
        <Row
          label="Choose language"
          sub="Changes will be applied after restarting the app"
          control={
            <Select
              label="Language"
              value={language}
              onChange={setLanguage}
              options={[
                { value: 'en', label: 'English (English)' },
                { value: 'es', label: 'Español (Spanish)' },
                { value: 'fr', label: 'Français (French)' },
                { value: 'ja', label: '日本語 (Japanese)' },
                { value: 'ko', label: '한국어 (Korean)' },
              ]}
            />
          }
        />
      </Section>

      <Section title="Audio quality">
        <Row
          label="Streaming quality"
          control={
            <Select
              label="Streaming quality"
              value={streamingQuality}
              onChange={setStreamingQuality}
              options={[
                { value: 'auto', label: 'Automatic' },
                { value: 'low', label: 'Low' },
                { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'High' },
                { value: 'veryhigh', label: 'Very High' },
              ]}
            />
          }
        />
        <Row
          label="Normalize volume"
          sub="Set the same volume level for all songs and podcasts"
          control={<Switch label="Normalize volume" checked={normalizeVolume} onChange={setNormalizeVolume} />}
        />
      </Section>

      <Section title="Your Library">
        <Row
          label="Use compact library layout"
          control={<Switch label="Use compact library layout" checked={compactLibrary} onChange={setCompactLibrary} />}
        />
      </Section>

      <Section title="Display">
        <Row
          label="Show the now-playing panel"
          sub="Open the right panel with what's currently playing"
          control={
            <Switch
              label="Show the now-playing panel"
              checked={isNowPlayingOpen}
              onChange={() => toggleNowPlaying()}
            />
          }
        />
      </Section>

      <Section title="Playback">
        <Row
          label="Autoplay similar content when your music ends"
          control={<Switch label="Autoplay" checked={autoplay} onChange={setAutoplay} />}
        />
        <Row
          label="Crossfade songs"
          sub="Allow you to crossfade between songs"
          control={<Switch label="Crossfade songs" checked={crossfade} onChange={setCrossfade} />}
        />
      </Section>
    </div>
  )
}
