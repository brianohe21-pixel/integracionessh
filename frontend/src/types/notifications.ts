export type NotificationType = "message" | "handoff" | "task" | "ops";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  conversationId?: string;
  taskId?: string;
  alertId?: string;
  createdAt: string;
  read: boolean;
}
