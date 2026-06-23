import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { useInstallApp } from '@/hooks/useInstallApp'
import { useTranslation } from '@/i18n/useTranslation'
import { notify } from '@/utils/toast'

/**
 * "Install app" link for the top bar (sits beside Premium / Support). Triggers
 * the native PWA install prompt where available (Chromium); on browsers that
 * don't expose it (Firefox / Safari) it falls back to a short instructional
 * toast. Renders nothing once the app is already installed / running standalone.
 */
export function InstallAppButton({ className }: { className?: string }) {
  const { isStandalone, promptInstall } = useInstallApp()
  const { t } = useTranslation()

  if (isStandalone) return null

  const handleClick = async () => {
    const shown = await promptInstall()
    if (!shown) notify.info(t('topbar.installHint'))
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {t('topbar.installApp')}
    </button>
  )
}

/** Variant with a trailing external-link arrow, for the user menu. `onSelect` closes the menu. */
export function InstallAppMenuItem({ className, onSelect }: { className?: string; onSelect?: () => void }) {
  const { isStandalone, promptInstall } = useInstallApp()
  const { t } = useTranslation()

  if (isStandalone) return null

  const handleClick = async () => {
    onSelect?.()
    const shown = await promptInstall()
    if (!shown) notify.info(t('topbar.installHint'))
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {t('topbar.installApp')}
      <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0 text-secondary" />
    </button>
  )
}
