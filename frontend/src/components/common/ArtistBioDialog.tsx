import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { CheckBadgeIcon } from '@heroicons/react/24/solid'
import type { Artist } from '@/types/artist'
import { useTranslation } from '@/i18n/useTranslation'

interface ArtistBioDialogProps {
  artist: Artist
  open: boolean
  onClose: () => void
}

export function ArtistBioDialog({ artist, open, onClose }: ArtistBioDialogProps) {
  const { t } = useTranslation()
  const imageUrl = artist.imageUrl ?? artist.headerImageUrl
  const paragraphs = (artist.bio ?? '').split(/\n+/).map((p) => p.trim()).filter(Boolean)

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[70]">
      <div className="fixed inset-0 bg-black/80" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto px-4 py-6 sm:py-10">
        <DialogPanel className="spotify-scrollbar relative max-h-[min(820px,calc(100vh-4rem))] w-full max-w-2xl overflow-y-auto overflow-x-hidden rounded-lg bg-[#181818] text-primary shadow-2xl ring-1 ring-white/10">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-secondary transition-colors hover:bg-black/70 hover:text-primary"
            aria-label={t('common.close')}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>

          {imageUrl && (
            <div className="relative h-72 bg-black sm:h-[385px]">
              <img src={imageUrl} alt={artist.name} className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#181818] to-transparent" />
            </div>
          )}

          <div className="p-5 sm:p-7">
            <div className="grid gap-6 sm:grid-cols-[160px_minmax(0,1fr)]">
              <aside className="space-y-4">
                <DialogTitle className="text-2xl font-black leading-tight text-primary">{artist.name}</DialogTitle>
                {artist.verified && (
                  <div className="flex items-center gap-2 text-sm font-black text-primary">
                    <CheckBadgeIcon className="h-6 w-6 shrink-0 text-accent" />
                    <span>{t('artist.badges.verifiedTitle')}</span>
                  </div>
                )}
              </aside>

              <div className="space-y-4 text-sm font-semibold leading-6 text-secondary">
                {paragraphs.length > 0 ? (
                  paragraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))
                ) : (
                  <p>{t('artist.bio.empty')}</p>
                )}
              </div>
            </div>

            <div className="mt-7 space-y-3">
              <div className="flex items-center gap-3 text-sm font-bold text-secondary">
                {imageUrl && (
                  <img src={imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                )}
                <span>{t('artist.bio.postedBy', { name: artist.name })}</span>
              </div>

              {artist.verified && (
                <div className="rounded-md bg-elevated px-4 py-4">
                  <div className="flex items-center gap-3">
                    <CheckBadgeIcon className="h-8 w-8 shrink-0 text-[#b7f7c1]" />
                    <h3 className="text-base font-black text-primary">{t('artist.badges.verifiedTitle')}</h3>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-secondary">
                    {t('artist.badges.verifiedDescription')}{' '}
                    <span className="underline decoration-secondary/70 underline-offset-2">
                      {t('artist.bio.learnMore')}
                    </span>
                  </p>
                </div>
              )}

              <div className="rounded-md bg-elevated px-4 py-4">
                <h3 className="text-base font-black text-primary">{t('artist.bio.registeredTitle')}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-secondary">
                  {t('artist.bio.registeredDescription')}
                </p>
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
