interface Props {
  action: 'approve' | 'reject'
  note: string
  saving: boolean
  onNoteChange: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export function ReviewNoteForm({ action, note, saving, onNoteChange, onConfirm, onCancel }: Props) {
  return (
    <div className="flex flex-col gap-2 p-3 bg-elevated/30 rounded-lg border border-elevated/40">
      <p className="text-xs font-semibold text-secondary">
        {action === 'approve' ? 'Approval note (optional)' : 'Rejection reason (optional)'}
      </p>
      <textarea
        autoFocus
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Add a note for the artist…"
        rows={2}
        className="w-full bg-elevated border border-elevated/50 focus:border-accent text-primary placeholder:text-muted rounded-md px-3 py-2 text-sm focus:outline-none resize-none"
      />
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-1.5 rounded text-xs font-semibold text-secondary hover:text-primary hover:bg-elevated/60 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors disabled:opacity-50 ${
            action === 'approve'
              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          }`}
        >
          {saving ? 'Saving…' : action === 'approve' ? 'Confirm approve' : 'Confirm reject'}
        </button>
      </div>
    </div>
  )
}
