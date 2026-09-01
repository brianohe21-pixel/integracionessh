export type NotificationType = "message" | "handoff";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  conversationId: string;
  createdAt: string;
  read: boolean;
}
