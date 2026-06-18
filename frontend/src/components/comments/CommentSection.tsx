import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { TrashIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline'
import type { TrackComment } from '@/types/track'
import { trackService } from '@/services/trackService'
import { useAuthStore } from '@/stores/authStore'
import { useAuthPromptStore } from '@/stores/authPromptStore'
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
              Reply
            </button>
            {isOwner && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-xs text-secondary hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1"
                aria-label="Delete comment"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                Delete
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
          {repliesOpen ? 'Hide replies' : `View replies`}
        </button>
        {repliesOpen && (
          <div className="border-l-2 border-elevated pl-4">
            {loadingReplies ? (
              <Spinner size="sm" className="py-2" />
            ) : replies.length === 0 ? (
              <p className="text-xs text-secondary py-2">No replies yet.</p>
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
      openAuthPrompt({ title: 'Sign in to leave a comment' })
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
        // Refresh the parent's replies — simpler to just re-fetch all
        setComments((prev) => [...prev])
        setReplyingTo(null)
      } else {
        setComments((prev) => [newComment, ...prev])
      }
      setBody('')
      notify.success(replyingTo ? 'Reply posted' : 'Comment posted')
    } catch (err: any) {
      notify.error(err?.response?.data?.message || 'Could not post comment')
    } finally {
      setPosting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    try {
      await trackService.deleteComment(trackId, commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      notify.success('Comment deleted')
    } catch (err: any) {
      notify.error(err?.response?.data?.message || 'Could not delete comment')
    }
  }

  const handleReply = (parent: TrackComment) => {
    if (!isAuthenticated) {
      openAuthPrompt({ title: 'Sign in to reply' })
      return
    }
    setReplyingTo(parent)
    // Focus the input
    const input = document.getElementById('comment-input')
    input?.focus()
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-primary mb-4">Comments</h2>

      {/* Comment form */}
      <div className="mb-6">
        {replyingTo && (
          <div className="flex items-center gap-2 mb-2 text-sm text-secondary">
            <span>Replying to</span>
            <span className="font-semibold text-primary">{replyingTo.user.name}</span>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-accent hover:underline text-xs"
            >
              Cancel
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
                    ? 'Write a reply...'
                    : `What do you think of "${trackTitle}"?`
                  : 'Sign in to leave a comment'
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
                {posting ? 'Posting...' : replyingTo ? 'Reply' : 'Comment'}
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
          No comments yet. Be the first to share your thoughts!
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
