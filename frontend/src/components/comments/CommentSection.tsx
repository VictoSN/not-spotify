import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { TrashIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline'
import type { TrackComment } from '@/types/track'
import { trackService } from '@/services/trackService'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
import { useTranslation } from '@/i18n/useTranslation'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/Avatar'
import { notify } from '@/utils/toast'
import { timeAgo } from '@/utils/formatTime'

interface Props {
  trackId: string
  trackTitle: string
}

function CommentRow({
  comment,
  trackId,
  isOwner,
  onDelete,
  onReply,
}: {
  comment: TrackComment
  trackId: string
  isOwner: boolean
  onDelete: (id: string) => void
  onReply: (parent: TrackComment) => void
}) {
  const [replies, setReplies] = useState<TrackComment[]>([])
  const [repliesOpen, setRepliesOpen] = useState(false)
  const [loadingReplies, setLoadingReplies] = useState(false)
  const { t } = useTranslation()

  const loadReplies = useCallback(async () => {
    if (repliesOpen) {
      setRepliesOpen(false)
      return
    }
    setRepliesOpen(true)
    if (replies.length > 0) return
    setLoadingReplies(true)
    try {
      const r = await trackService.getCommentReplies(trackId, comment.id)
      setReplies(r)
    } catch {
      // silently fail
    } finally {
      setLoadingReplies(false)
    }
  }, [trackId, comment.id, repliesOpen, replies.length])

  return (
    <div className="group">
      <div className="flex gap-3 py-3">
        <Link to={`/user/${comment.user.id}`}>
          <Avatar
            src={comment.user.avatarUrl}
            alt={comment.user.name}
            size="sm"
            round
            className="flex-shrink-0 mt-0.5"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/user/${comment.user.id}`}
              className="text-sm font-semibold text-primary hover:underline"
            >
              {comment.user.name}
            </Link>
            <span className="text-xs text-secondary">
              {timeAgo(comment.createdAt)}
            </span>
          </div>
          <p className="text-sm text-primary mt-1 whitespace-pre-wrap break-words">
            {comment.body}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <button
              onClick={() => onReply(comment)}
              className="text-xs text-secondary hover:text-primary transition-colors flex items-center gap-1"
            >
              <ChatBubbleLeftIcon className="w-3.5 h-3.5" />
              {t('track.reply')}
            </button>
            {isOwner && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-xs text-secondary hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1"
                aria-label={t('track.delete')}
              >
                <TrashIcon className="w-3.5 h-3.5" />
                {t('track.delete')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies toggle */}
      <div className="ml-10">
        <button
          onClick={loadReplies}
          className="text-xs text-secondary hover:text-primary transition-colors mb-1"
        >
          {repliesOpen ? t('track.hideReplies') : t('track.viewReplies')}
        </button>
        {repliesOpen && (
          <div className="border-l-2 border-elevated pl-4">
            {loadingReplies ? (
              <Spinner size="sm" className="py-2" />
            ) : replies.length === 0 ? (
              <p className="text-xs text-secondary py-2">{t('track.noReplies')}</p>
            ) : (
              replies.map((r) => (
                <div key={r.id} className="flex gap-3 py-2">
                  <Link to={`/user/${r.user.id}`}>
                    <Avatar
                      src={r.user.avatarUrl}
                      alt={r.user.name}
                      size="sm"
                      round
                      className="flex-shrink-0 mt-0.5"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/user/${r.user.id}`}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        {r.user.name}
                      </Link>
                      <span className="text-xs text-secondary">
                        {timeAgo(r.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-primary mt-0.5 whitespace-pre-wrap break-words">
                      {r.body}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function CommentSection({ trackId, trackTitle }: Props) {
  const [comments, setComments] = useState<TrackComment[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<TrackComment | null>(null)

  const { t } = useTranslation()
  const { isAuthenticated, user } = useAuthStore()
  const openAuthPrompt = useAuthPromptStore((s) => s.open)

  const fetchComments = useCallback(async () => {
    setLoading(true)
    try {
      const c = await trackService.getComments(trackId)
      setComments(c)
    } catch {
      // silently fail — comments are non-critical
    } finally {
      setLoading(false)
    }
  }, [trackId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const handlePost = async () => {
    if (!body.trim()) return
    if (!isAuthenticated) {
      openAuthPrompt({ title: t('track.signInToComment') })
      return
    }
    setPosting(true)
    try {
      const newComment = await trackService.postComment(
        trackId,
        body.trim(),
        replyingTo?.id,
      )
      if (replyingTo) {
        setComments((prev) => [...prev])
        setReplyingTo(null)
      } else {
        setComments((prev) => [newComment, ...prev])
      }
      setBody('')
      notify.success(replyingTo ? t('track.replyPosted') : t('track.commentPosted'))
    } catch (err: any) {
      notify.error(err?.response?.data?.message || t('common.error'))
    } finally {
      setPosting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    try {
      await trackService.deleteComment(trackId, commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      notify.success(t('track.commentDeleted'))
    } catch (err: any) {
      notify.error(err?.response?.data?.message || t('common.error'))
    }
  }

  const handleReply = (parent: TrackComment) => {
    if (!isAuthenticated) {
      openAuthPrompt({ title: t('track.signInToReply') })
      return
    }
    setReplyingTo(parent)
    const input = document.getElementById('comment-input')
    input?.focus()
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-primary mb-4">{t('track.comments')}</h2>

      {/* Comment form */}
      <div className="mb-6">
        {replyingTo && (
          <div className="flex items-center gap-2 mb-2 text-sm text-secondary">
            <span>{t('track.replyTo')}</span>
            <span className="font-semibold text-primary">{replyingTo.user.name}</span>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-accent hover:underline text-xs"
            >
              {t('track.cancelReply')}
            </button>
          </div>
        )}
        <div className="flex gap-3">
          {isAuthenticated && user ? (
            <Avatar
              src={user.avatarUrl}
              alt={user.name}
              size="sm"
              round
              className="flex-shrink-0 mt-1"
            />
          ) : null}
          <div className="flex-1">
            <textarea
              id="comment-input"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                isAuthenticated
                  ? replyingTo
                    ? t('track.reply')
                    : t('track.writeComment', { title: trackTitle })
                  : t('track.signInToComment')
              }
              maxLength={1000}
              rows={3}
              className="w-full bg-elevated border border-elevated focus:border-accent rounded-lg px-4 py-3 text-sm text-primary placeholder:text-secondary resize-none outline-none transition-colors"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  handlePost()
                }
              }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-secondary">{body.length}/1000</span>
              <button
                onClick={handlePost}
                disabled={!body.trim() || posting}
                className="px-4 py-1.5 rounded-full bg-accent hover:bg-accent/80 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {posting ? t('track.posting') : replyingTo ? t('track.reply') : t('track.postComment')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comment list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size="md" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-secondary text-sm py-8 text-center">
          {t('track.noComments')}
        </p>
      ) : (
        <div className="divide-y divide-elevated">
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              trackId={trackId}
              isOwner={user?.id === c.user.id}
              onDelete={handleDelete}
              onReply={handleReply}
            />
          ))}
        </div>
      )}
    </section>
  )
}
