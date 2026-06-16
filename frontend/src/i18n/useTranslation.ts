import { useLocaleStore } from '@/stores/localeStore'
import { translations } from '@/i18n/translations'

/**
 * Tiny translation hook. `t('settings.title')` returns the string for the active
 * language, falling back to English and then to the raw key. Pass vars to fill
 * `{name}` placeholders: `t('crossfade.seconds', { n: 3 })`.
 */
export function useTranslation() {
  const language = useLocaleStore((s) => s.language)

  const t = (key: string, vars?: Record<string, string | number>): string => {
    let str = translations[language]?.[key] ?? translations.en[key] ?? key
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        str = str.replace(`{${name}}`, String(value))
      }
    }
    return str
  }

  return { t, language }
}
