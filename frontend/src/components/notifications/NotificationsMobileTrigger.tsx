"use client";

import { NotificationsButton } from "@/components/notifications/NotificationsButton";
import { useTenantRole } from "@/hooks/useTenantRole";

export function NotificationsMobileTrigger() {
  const { isMember, loading } = useTenantRole();

  if (loading || !isMember) return null;

  return <NotificationsButton />;
}
