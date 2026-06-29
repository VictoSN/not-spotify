import type { ChatMessage, Conversation } from '@/types/chat'
import { useAuthStore } from '@/stores/authStore'

export const CHAT_PREFERENCES_KEY = 'ns-chat-preferences'
export const CHAT_PREFERENCES_EVENT = 'ns-chat-preferences-change'

interface ChatPreferences {
  historyCutoffs: Record<string, string>
  deletedChatIds: string[]
}

const EMPTY_PREFERENCES: ChatPreferences = { historyCutoffs: {}, deletedChatIds: [] }

function storageKey(): string {
  const userId = useAuthStore.getState().user?.id
  return userId ? `${CHAT_PREFERENCES_KEY}:${userId}` : CHAT_PREFERENCES_KEY
}

function readPreferences(): ChatPreferences {
  if (typeof window === 'undefined') return EMPTY_PREFERENCES
  try {
    const raw = window.localStorage.getItem(storageKey())
    if (!raw) return EMPTY_PREFERENCES
    const parsed = JSON.parse(raw) as Partial<ChatPreferences>
    const historyCutoffs = parsed.historyCutoffs && typeof parsed.historyCutoffs === 'object'
      ? Object.fromEntries(
          Object.entries(parsed.historyCutoffs).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        )
      : {}
    const deletedChatIds = Array.isArray(parsed.deletedChatIds)
      ? parsed.deletedChatIds.filter((id): id is string => typeof id === 'string')
      : []
    return { historyCutoffs, deletedChatIds }
  } catch {
    return EMPTY_PREFERENCES
  }
}

function writePreferences(preferences: ChatPreferences) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(preferences))
    window.dispatchEvent(new CustomEvent(CHAT_PREFERENCES_EVENT))
  } catch {
    /* Device storage may be unavailable; the in-memory store still updates. */
  }
}

export function clearChatOnDevice(partnerId: string, clearedAt = new Date().toISOString()) {
  const preferences = readPreferences()
  writePreferences({
    historyCutoffs: { ...preferences.historyCutoffs, [partnerId]: clearedAt },
    deletedChatIds: preferences.deletedChatIds.filter((id) => id !== partnerId),
  })
}

export function deleteChatOnDevice(partnerId: string, deletedAt = new Date().toISOString()) {
  const preferences = readPreferences()
  writePreferences({
    historyCutoffs: { ...preferences.historyCutoffs, [partnerId]: deletedAt },
    deletedChatIds: [partnerId, ...preferences.deletedChatIds.filter((id) => id !== partnerId)],
  })
}

export function isChatDeletedOnDevice(partnerId: string): boolean {
  return readPreferences().deletedChatIds.includes(partnerId)
}

export function isMessageVisibleOnDevice(partnerId: string, message: ChatMessage): boolean {
  const cutoff = readPreferences().historyCutoffs[partnerId]
  if (!cutoff) return true
  return new Date(message.sentAt).getTime() > new Date(cutoff).getTime()
}

export function filterThreadForDevice(partnerId: string, messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((message) => isMessageVisibleOnDevice(partnerId, message))
}

/** Applies per-device clear/delete cutoffs without changing the other participant's copy. */
export function applyChatPreferences(conversations: Conversation[]): Conversation[] {
  const preferences = readPreferences()
  return conversations.flatMap((conversation) => {
    const cutoff = preferences.historyCutoffs[conversation.userId]
    const hasNewMessage = Boolean(
      conversation.lastMessage
      && (!cutoff || new Date(conversation.lastMessage.sentAt).getTime() > new Date(cutoff).getTime()),
    )

    if (preferences.deletedChatIds.includes(conversation.userId) && !hasNewMessage) return []
    if (cutoff && !hasNewMessage) {
      return [{ ...conversation, lastMessage: null, unreadCount: 0 }]
    }
    return [conversation]
  })
}
