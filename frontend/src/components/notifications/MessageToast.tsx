"use client";

import Link from "next/link";
import { MessageSquare, X } from "lucide-react";
import { useT } from "@/i18n/context";
import type { MessageToastState } from "@/components/notifications/UnreadMessagesProvider";

type MessageToastProps = {
  toast: MessageToastState;
  onDismiss: () => void;
};

export function MessageToast({ toast, onDismiss }: MessageToastProps) {
  const t = useT();

  return (
    <div
      className="pointer-events-auto fixed bottom-4 right-4 z-[120] w-[min(100vw-2rem,22rem)]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 rounded-xl border border-default bg-surface-elevated p-4 shadow-lg">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent">
          <MessageSquare className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary line-clamp-1">{toast.title}</p>
          <p className="mt-0.5 text-sm text-secondary line-clamp-2">{toast.body}</p>
          <Link
            href={toast.href}
            onClick={onDismiss}
            className="mt-2 inline-flex text-xs font-medium text-accent hover:underline"
          >
            {t("notifications.viewConversation")}
          </Link>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1.5 text-secondary hover:bg-surface-muted hover:text-primary"
          aria-label={t("notifications.close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
