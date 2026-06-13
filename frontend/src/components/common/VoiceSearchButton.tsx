import { useEffect, useRef, useState } from 'react'
import { MicrophoneIcon } from '@heroicons/react/24/outline'
import { MicrophoneIcon as MicrophoneSolid } from '@heroicons/react/24/solid'
import { cn } from '@/utils/cn'

// The Web Speech API isn't in the standard TS lib; access it loosely.
type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null
}

interface VoiceSearchButtonProps {
  onResult: (text: string) => void
  className?: string
}

/**
 * Mic button that runs a one-shot Web Speech recognition and hands the
 * transcript to onResult. Renders nothing when the browser lacks the API
 * (e.g. Firefox), so the layout is unaffected there.
 */
export function VoiceSearchButton({ onResult, className }: VoiceSearchButtonProps) {
  const Ctor = getRecognitionCtor()
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => () => { try { recRef.current?.abort() } catch { /* ignore */ } }, [])

  if (!Ctor) return null

  const start = () => {
    if (listening) {
      try { recRef.current?.stop() } catch { /* ignore */ }
      return
    }
    const rec = new Ctor()
    rec.lang = navigator.language || 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript?.trim()
      if (transcript) onResult(transcript)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label={listening ? 'Listening… click to stop' : 'Search by voice'}
      aria-pressed={listening}
      title="Search by voice"
      className={cn(
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-elevated transition-all hover:scale-105 hover:bg-elevated/70',
        listening ? 'text-red-500 animate-pulse' : 'text-secondary hover:text-primary',
        className,
      )}
    >
      {listening ? <MicrophoneSolid className="h-5 w-5" /> : <MicrophoneIcon className="h-5 w-5" />}
    </button>
  )
}
