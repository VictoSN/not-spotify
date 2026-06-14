export interface AppNotification {
  id: string
  type: string
  title: string
  body: string | null
  linkUrl: string | null
  imageUrl: string | null
  isRead: boolean
  createdAt: string
}

export interface NotificationList {
  unreadCount: number
  items: AppNotification[]
}
