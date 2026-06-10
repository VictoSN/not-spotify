import { Spinner } from '@/components/ui/Spinner'

interface LyricsViewProps {
  lyrics?: string | null
  loading?: boolean
}

export function LyricsView({ lyrics, loading }: LyricsViewProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="md" />
      </div>
    )
  }

  if (!lyrics) {
    return (
      <p className="py-10 text-sm text-secondary italic">
        No lyrics available for this song.
      </p>
    )
  }

  return (
    <div className="whitespace-pre-wrap text-sm leading-8 text-primary">
      {lyrics}
    </div>
  )
}
