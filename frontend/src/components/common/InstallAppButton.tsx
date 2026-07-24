import { Link } from 'react-router-dom'
import { ArrowDownCircleIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { useInstallApp } from '@/hooks/useInstallApp'
import { useTranslation } from '@/i18n/useTranslation'
import { notify } from '@/utils/toast'
import { isDesktop } from '@/utils/platform'
import { cn } from '@/utils/cn'

/**
 * Route link for the top bar and public support header. The destination keeps
 * the visitor inside the music-app shell and presents both the native Windows
 * installer and the real PWA prompt in a full install page.
 */
export function InstallAppButton({ className }: { className?: string }) {
  const { isStandalone } = useInstallApp()
  const { t } = useTranslation()

  // Nothing to install when we ARE the installed app: the Tauri desktop shell (and an
  // installed PWA) is already the app, so an "Install app" entry there is nonsense.
  if (isStandalone || isDesktop()) return null

  return (
    <Link to="/install-app" className={cn('inline-flex items-center gap-2', className)}>
      <ArrowDownCircleIcon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span>{t('topbar.installApp')}</span>
    </Link>
  )
}

/** Variant with a trailing external-link arrow, for the user menu. `onSelect` closes the menu. */
export function InstallAppMenuItem({ className, label, onSelect }: { className?: string; label?: string; onSelect?: () => void }) {
  const { isStandalone, promptInstall } = useInstallApp()
  const { t } = useTranslation()

  if (isStandalone || isDesktop()) return null

  const handleClick = async () => {
    onSelect?.()
    const shown = await promptInstall()
    if (!shown) notify.info(t('topbar.installHint'))
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {label ?? t('topbar.installApp')}
      <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0 text-secondary" />
    </button>
  )
}
