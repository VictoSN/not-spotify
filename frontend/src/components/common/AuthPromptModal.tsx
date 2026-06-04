import { Link } from 'react-router-dom'
import { XMarkIcon, MusicalNoteIcon } from '@heroicons/react/24/outline'
import { useAuthPromptStore } from '@/stores/authPromptStore'

export function AuthPromptModal() {
  const { isOpen, title, imageUrl, close } = useAuthPromptStore()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="relative grid w-full max-w-3xl grid-cols-1 gap-8 rounded-lg bg-gradient-to-b from-elevated to-surface p-8 shadow-2xl sm:grid-cols-[minmax(220px,300px)_1fr] sm:p-10">
        <button
          onClick={close}
          className="absolute right-4 top-4 rounded-full p-1 text-secondary transition-colors hover:bg-surface hover:text-primary"
          aria-label="Close"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <div className="hidden overflow-hidden rounded-md bg-base shadow-xl sm:block">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="aspect-square h-full w-full object-cover" />
          ) : (
            <div className="flex aspect-square h-full w-full items-center justify-center">
              <MusicalNoteIcon className="h-20 w-20 text-secondary" />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center text-center sm:text-left">
          <h2 className="pr-8 text-3xl font-bold leading-tight text-primary sm:pr-0">{title}</h2>
          <div className="mt-8 flex flex-col items-center gap-4 sm:items-start">
            <Link
              to="/signup"
              onClick={close}
              className="rounded-full bg-accent px-9 py-3 text-sm font-bold text-black transition-all hover:scale-105 hover:bg-accent-dark active:scale-95"
            >
              Sign up free
            </Link>
            <button className="rounded-full border border-secondary/60 px-9 py-3 text-sm font-bold text-primary transition-all hover:scale-105 hover:border-primary active:scale-95">
              Download app
            </button>
          </div>
          <p className="mt-8 text-sm font-semibold text-secondary">
            Already have an account?{' '}
            <Link to="/login" onClick={close} className="text-primary underline hover:text-accent">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
