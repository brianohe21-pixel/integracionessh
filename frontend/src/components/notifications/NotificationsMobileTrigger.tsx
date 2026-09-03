"use client";

import { NotificationsButton } from "@/components/notifications/NotificationsButton";
import { useTenantRole } from "@/hooks/useTenantRole";

export function NotificationsMobileTrigger() {
  const { isAdmin, loading } = useTenantRole();

  if (loading || isAdmin) return null;

  return <NotificationsButton />;
}
