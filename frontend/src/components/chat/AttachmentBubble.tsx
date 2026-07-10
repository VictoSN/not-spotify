import type { ReactNode } from 'react'
import { DocumentIcon, PhotoIcon, VideoCameraIcon } from '@heroicons/react/24/solid'
import { cn } from '@/utils/cn'
import { formatBytes, type ParsedAttachment } from '@/utils/chatAttachment'

interface Props {
  attachment: ParsedAttachment
  mine: boolean
  time: string
  ticks?: ReactNode
}

/** A file/photo attachment rendered in place of a plain chat bubble. */
export function AttachmentBubble({ attachment, mine, time, ticks }: Props) {
  const shell = cn(
    'overflow-hidden rounded-2xl',
    mine ? 'chat-bubble-outgoing rounded-br-md' : 'chat-bubble-incoming rounded-bl-md',
  )

  // Photo with an inline preview → show the image, timestamp floated over it.
  if (attachment.kind === 'image' && attachment.dataUrl) {
    return (
      <div className={cn(shell, 'p-1')}>
        <div className="relative overflow-hidden rounded-xl">
          <img
            src={attachment.dataUrl}
            alt={attachment.name}
            className="block max-h-80 w-full max-w-[240px] object-cover"
          />
          <span className="pointer-events-none absolute bottom-1 right-1.5 flex items-center gap-0.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] text-white">
            {time}
            {ticks}
          </span>
        </div>
      </div>
    )
  }

  // Video / document / preview-less image → a compact metadata card.
  const Icon = attachment.kind === 'video' ? VideoCameraIcon : attachment.kind === 'image' ? PhotoIcon : DocumentIcon
  const typeLabel = attachment.kind === 'video' ? 'Video' : attachment.kind === 'image' ? 'Photo' : 'Document'
  const meta = [typeLabel, formatBytes(attachment.size)].filter(Boolean).join(' · ')

  return (
    <div className={cn(shell, 'w-60 max-w-full px-2.5 py-2')}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/15">
          <Icon className="h-5 w-5 opacity-80" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{attachment.name}</p>
          <p className={cn('truncate text-xs leading-tight', mine ? 'chat-meta-outgoing' : 'chat-meta-incoming')}>
            {meta}
          </p>
        </div>
      </div>
      <div className={cn('mt-1 flex items-center justify-end gap-0.5 text-[10px]', mine ? 'chat-meta-outgoing' : 'chat-meta-incoming')}>
        {time}
        {ticks}
      </div>
    </div>
  )
}
