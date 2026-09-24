"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  CheckSquare,
  Eraser,
  ExternalLink,
  Headphones,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";

export type ConversationContextMenuState = {
  x: number;
  y: number;
  conversation: Conversation;
};

type MenuItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger" | "warning";
};

type Props = {
  state: ConversationContextMenuState | null;
  onClose: () => void;
  advisorMode: boolean;
  claimPending?: boolean;
  releasePending?: boolean;
  onCreateTask: (conversation: Conversation) => void;
  onTransfer: (conversation: Conversation) => void;
  onResolve: (conversation: Conversation) => void;
  onClaim: (conversation: Conversation) => void;
  onRelease: (conversation: Conversation) => void;
  onClear: (conversation: Conversation) => void;
  onDelete: (conversation: Conversation) => void;
  onOpenWhatsApp: (conversation: Conversation) => void;
};

const MENU_WIDTH = 224;

export function ConversationContextMenu({
  state,
  onClose,
  advisorMode,
  claimPending = false,
  releasePending = false,
  onCreateTask,
  onTransfer,
  onResolve,
  onClaim,
  onRelease,
  onClear,
  onDelete,
  onOpenWhatsApp,
}: Props) {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!state) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function onScroll() {
      onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [state, onClose]);

  if (!state || !mounted) return null;

  const conversation = state.conversation;
  const isHuman = (conversation.handoffMode ?? "bot") === "human";
  const needsClaim = advisorMode && isHuman && !conversation.assignedAdvisorId;
  const canOpenWhatsApp =
    isHuman && (conversation.channel ?? "whatsapp") === "whatsapp" && Boolean(conversation.phoneNumber);

  const items: MenuItem[] = [
    {
      id: "task",
      label: t("tasks.createFromConversation"),
      icon: CheckSquare,
      onClick: () => onCreateTask(conversation),
    },
  ];

  if (needsClaim) {
    items.push({
      id: "claim",
      label: t("conversations.takeConversation"),
      icon: Headphones,
      onClick: () => onClaim(conversation),
      disabled: claimPending,
    });
  }

  if (!advisorMode && !isHuman) {
    items.push({
      id: "transfer",
      label: t("conversations.transfer"),
      icon: Headphones,
      onClick: () => onTransfer(conversation),
      variant: "warning",
    });
  }

  if (isHuman) {
    items.push({
      id: "resolve",
      label: t("conversations.resolve"),
      icon: CheckCircle2,
      onClick: () => onResolve(conversation),
    });

    if (canOpenWhatsApp) {
      items.push({
        id: "whatsapp",
        label: t("conversations.openWhatsApp"),
        icon: ExternalLink,
        onClick: () => onOpenWhatsApp(conversation),
      });
    }

    items.push({
      id: "release",
      label: t("conversations.release"),
      icon: RotateCcw,
      onClick: () => onRelease(conversation),
      disabled: releasePending,
    });
  }

  if (conversation.botId) {
    items.push({
      id: "clear",
      label: t("conversations.clear"),
      icon: Eraser,
      onClick: () => onClear(conversation),
    });
    items.push({
      id: "delete",
      label: t("conversations.delete"),
      icon: Trash2,
      onClick: () => onDelete(conversation),
      variant: "danger",
    });
  }

  const left = Math.min(Math.max(8, state.x), window.innerWidth - MENU_WIDTH - 8);
  const top = Math.min(Math.max(8, state.y), window.innerHeight - items.length * 44 - 16);

  return createPortal(
    <div
      ref={rootRef}
      role="menu"
      aria-label={t("conversations.actionsMenu")}
      style={{ top, left, width: MENU_WIDTH }}
      className="fixed z-[220] overflow-hidden rounded-xl border border-default bg-surface-elevated p-1 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              onClose();
              item.onClick();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
              item.disabled && "cursor-not-allowed opacity-50",
              item.variant === "danger"
                ? "text-danger hover:bg-danger/10"
                : item.variant === "warning"
                  ? "text-warning hover:bg-warning/10"
                  : "text-primary hover:bg-surface-muted"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>,
    document.body
  );
}
