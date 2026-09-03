"use client";

import type { ReactNode } from "react";
import { NotificationsPanel } from "@/components/notifications/NotificationsPanel";
import { NotificationsProvider } from "@/components/notifications/NotificationsProvider";
import { useTenantRole } from "@/hooks/useTenantRole";

export function NotificationsMount({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useTenantRole();

  if (loading) return <>{children}</>;

  return (
    <NotificationsProvider>
      {children}
      {!isAdmin ? <NotificationsPanel /> : null}
    </NotificationsProvider>
  );
}
