export type NotificationType = "message" | "handoff" | "task";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  conversationId?: string;
  taskId?: string;
  createdAt: string;
  read: boolean;
}
