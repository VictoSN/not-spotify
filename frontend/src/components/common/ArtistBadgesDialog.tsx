import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { CheckBadgeIcon } from '@heroicons/react/24/solid'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useTranslation } from '@/i18n/useTranslation'

interface ArtistBadgesDialogProps {
  open: boolean
  onClose: () => void
}

export function ArtistBadgesDialog({ open, onClose }: ArtistBadgesDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[70]">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center p-4 pt-16 sm:items-center sm:pt-4">
        <DialogPanel className="w-full max-w-xl rounded-lg bg-surface p-5 shadow-2xl ring-1 ring-primary/10 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-lg font-black text-primary">
              {t('artist.badges.title')}
            </DialogTitle>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:bg-elevated hover:text-primary"
              aria-label={t('common.close')}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="mt-5 rounded-md bg-elevated/60 p-4">
            <div className="flex items-start gap-3">
              <CheckBadgeIcon className="mt-0.5 h-7 w-7 shrink-0 text-accent" />
              <div className="min-w-0">
                <h3 className="text-sm font-black text-primary">{t('artist.badges.verifiedTitle')}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-secondary">
                  {t('artist.badges.verifiedDescription')}
                </p>
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
