"use client";

import { SoftphoneToolbarTrigger } from "@/components/contact-center/SoftphoneToolbarTrigger";
import { NotificationsDesktopTrigger } from "@/components/notifications/NotificationsDesktopTrigger";

export function PlatformToolbar() {
  return (
    <div
      className="sticky top-0 z-30 hidden shrink-0 items-center justify-end gap-2 border-b border-default bg-surface-elevated/95 px-6 py-2.5 backdrop-blur-md lg:flex"
    >
      <NotificationsDesktopTrigger />
      <SoftphoneToolbarTrigger />
    </div>
  );
}
