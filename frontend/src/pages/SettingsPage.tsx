import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowTopRightOnSquareIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useThemeStore } from '@/stores/themeStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useLocaleStore } from '@/stores/localeStore'
import { useTranslation } from '@/i18n/useTranslation'
import { LANGUAGES } from '@/i18n/translations'
import { OfflineDownloads } from '@/components/settings/OfflineDownloads'
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
      window.dispatchEvent(new CustomEvent('ns-pref-change', { detail: { key, value: next } }))
    } catch {
      /* ignore */
    }
  }
  return [value, set]
}

function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-page',
        checked ? 'border-accent bg-accent' : 'border-secondary/20 bg-elevated',
        disabled && 'cursor-not-allowed opacity-50',
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
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  label: string
  disabled?: boolean
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'shrink-0 rounded-md border border-secondary/20 bg-elevated px-3 py-2 text-sm font-medium text-primary outline-none transition-colors hover:border-secondary/40 focus:border-accent',
        disabled && 'cursor-not-allowed opacity-50 hover:border-secondary/20',
      )}
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
  badge,
}: {
  label: string
  sub?: string
  control: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-primary">{label}</p>
          {badge}
        </div>
        {sub && <p className="mt-0.5 text-xs text-secondary">{sub}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const { theme, setTheme } = useThemeStore()
  const language = useLocaleStore((s) => s.language)
  const setLanguage = useLocaleStore((s) => s.setLanguage)
  const isNowPlayingOpen = usePlayerStore((s) => s.isNowPlayingOpen)
  const toggleNowPlaying = usePlayerStore((s) => s.toggleNowPlaying)

  // Live, wired preferences.
  const [compactLibrary, setCompactLibrary] = usePref('ns-pref-compact', false)
  const [autoplay, setAutoplay] = usePref('ns-pref-autoplay', true)
  // Read live by the two-deck audioEngine's Web Audio graph.
  const [normalizeVolume, setNormalizeVolume] = usePref('ns-pref-normalize', false)
  // Crossfade length in seconds (0 = off); read live by the two-deck audioEngine.
  // Back-compat: the old toggle stored a boolean.
  const [crossfadeRaw, setCrossfadeRaw] = usePref<number | boolean>('ns-pref-crossfade', 0)
  const crossfade = typeof crossfadeRaw === 'boolean' ? (crossfadeRaw ? 6 : 0) : crossfadeRaw
  // Streaming quality is live: read by the two-deck audioEngine, which rolls off
  // the highs at lower tiers (and caps adaptive/HLS levels where present).
  const [streamingQuality, setStreamingQuality] = usePref('ns-pref-quality', 'auto')

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-primary">{t('settings.title')}</h1>
        <MagnifyingGlassIcon className="h-5 w-5 text-secondary" />
      </div>

      <Section title={t('settings.account')}>
        <Row
          label={t('settings.account.edit')}
          sub={t('settings.account.editSub')}
          control={
            <Link
              to="/account"
              className="inline-flex items-center gap-2 rounded-full border border-secondary/50 px-4 py-1.5 text-sm font-bold text-primary transition-all hover:scale-105 hover:border-primary active:scale-95"
            >
              {t('common.edit')}
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </Link>
          }
        />
      </Section>

      <Section title={t('settings.appearance')}>
        <Row
          label={t('settings.theme')}
          sub={t('settings.theme.sub')}
          control={
            <Select
              label={t('settings.theme')}
              value={theme}
              onChange={(v) => setTheme(v as 'dark' | 'light')}
              options={[
                { value: 'dark', label: t('theme.dark') },
                { value: 'light', label: t('theme.light') },
              ]}
            />
          }
        />
      </Section>

      <Section title={t('settings.language')}>
        <Row
          label={t('settings.language.choose')}
          sub={t('settings.language.sub')}
          control={
            <Select
              label={t('settings.language')}
              value={language}
              onChange={(v) => setLanguage(v as (typeof LANGUAGES)[number]['code'])}
              options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
            />
          }
        />
      </Section>

      <Section title={t('settings.audio')}>
        <Row
          label={t('settings.audio.streaming')}
          sub={t('settings.audio.streamingSub')}
          control={
            <Select
              label={t('settings.audio.streaming')}
              value={streamingQuality}
              onChange={setStreamingQuality}
              options={[
                { value: 'auto', label: t('quality.auto') },
                { value: 'low', label: t('quality.low') },
                { value: 'normal', label: t('quality.normal') },
                { value: 'high', label: t('quality.high') },
                { value: 'veryhigh', label: t('quality.veryhigh') },
              ]}
            />
          }
        />
        <Row
          label={t('settings.audio.normalize')}
          sub={t('settings.audio.normalizeSub')}
          control={<Switch label={t('settings.audio.normalize')} checked={normalizeVolume} onChange={setNormalizeVolume} />}
        />
      </Section>

      <Section title={t('settings.library')}>
        <Row
          label={t('settings.library.compact')}
          sub={t('settings.library.compactSub')}
          control={<Switch label={t('settings.library.compact')} checked={compactLibrary} onChange={setCompactLibrary} />}
        />
      </Section>

      <Section title={t('settings.display')}>
        <Row
          label={t('settings.display.nowPlaying')}
          sub={t('settings.display.nowPlayingSub')}
          control={
            <Switch
              label={t('settings.display.nowPlaying')}
              checked={isNowPlayingOpen}
              onChange={() => toggleNowPlaying()}
            />
          }
        />
      </Section>

      <Section title={t('settings.playback')}>
        <Row
          label={t('settings.playback.autoplay')}
          control={<Switch label={t('settings.playback.autoplay')} checked={autoplay} onChange={setAutoplay} />}
        />
        <Row
          label={t('settings.playback.crossfade')}
          sub={t('settings.playback.crossfadeSub')}
          control={
            <Select
              label={t('settings.playback.crossfade')}
              value={String(crossfade)}
              onChange={(v) => setCrossfadeRaw(Number(v))}
              options={[
                { value: '0', label: t('crossfade.off') },
                { value: '3', label: t('crossfade.seconds', { n: 3 }) },
                { value: '6', label: t('crossfade.seconds', { n: 6 }) },
                { value: '9', label: t('crossfade.seconds', { n: 9 }) },
                { value: '12', label: t('crossfade.seconds', { n: 12 }) },
              ]}
            />
          }
        />
      </Section>

      <OfflineDownloads />
    </div>
  )
}
