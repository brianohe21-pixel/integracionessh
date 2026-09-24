"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  CheckSquare,
  ExternalLink,
  Headphones,
  MoreVertical,
  Phone,
  RotateCcw,
  Trash2,
  Eraser,
} from "lucide-react";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";

type MenuItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  disabled?: boolean;
  variant?: "default" | "danger" | "warning";
};

type Props = {
  conversation: Conversation;
  advisorMode: boolean;
  isHuman: boolean;
  needsClaim: boolean;
  claimPending: boolean;
  releasePending: boolean;
  callPermissionPending: boolean;
  callPermissionDisabled?: boolean;
  canRequestCallPermission: boolean;
  onClaim: () => void;
  onClear: () => void;
  onDelete: () => void;
  onTransfer: () => void;
  onRequestCallPermission: () => void;
  onResolve: () => void;
  onOpenWhatsApp: string | null;
  onRelease: () => void;
  onOpenTask?: () => void;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

export function ConversationHeaderMenu({
  conversation,
  advisorMode,
  isHuman,
  needsClaim,
  claimPending,
  releasePending,
  callPermissionPending,
  callPermissionDisabled = false,
  canRequestCallPermission,
  onClaim,
  onClear,
  onDelete,
  onTransfer,
  onRequestCallPermission,
  onResolve,
  onOpenWhatsApp,
  onRelease,
  onOpenTask,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuWidth = 224;
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8
      );
      setMenuPosition({
        top: rect.bottom + 8,
        left,
        width: menuWidth,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const items: MenuItem[] = [];

  if (needsClaim) {
    items.push({
      id: "claim",
      label: t("conversations.takeConversation"),
      icon: Headphones,
      onClick: onClaim,
      disabled: claimPending,
    });
  }

  if (onOpenTask) {
    items.push({
      id: "task",
      label: t("tasks.createFromConversation"),
      icon: CheckSquare,
      onClick: onOpenTask,
    });
  }

  if (!advisorMode && !isHuman) {
    items.push({
      id: "transfer",
      label: t("conversations.transfer"),
      icon: Headphones,
      onClick: onTransfer,
      variant: "warning",
    });
  }

  if (!advisorMode && conversation.botId && canRequestCallPermission) {
    items.push({
      id: "call-permission",
      label: t("conversations.requestCallPermission"),
      icon: Phone,
      onClick: onRequestCallPermission,
      disabled: callPermissionPending || callPermissionDisabled,
    });
  }

  if (isHuman) {
    items.push({
      id: "resolve",
      label: t("conversations.resolve"),
      icon: CheckCircle2,
      onClick: onResolve,
    });

    if (onOpenWhatsApp) {
      items.push({
        id: "open-whatsapp",
        label: t("conversations.openWhatsApp"),
        icon: ExternalLink,
        href: onOpenWhatsApp,
        external: true,
      });
    }

    items.push({
      id: "release",
      label: t("conversations.release"),
      icon: RotateCcw,
      onClick: onRelease,
      disabled: releasePending,
    });
  }

  if (conversation.botId) {
    items.push({
      id: "clear",
      label: t("conversations.clear"),
      icon: Eraser,
      onClick: onClear,
    });

    items.push({
      id: "delete",
      label: t("conversations.delete"),
      icon: Trash2,
      onClick: onDelete,
      variant: "danger",
    });
  }

  if (items.length === 0) return null;

  function handleSelect(item: MenuItem) {
    if (item.disabled) return;
    setOpen(false);
    item.onClick?.();
  }

  const menu =
    open && menuPosition && mounted ? (
      <div
        ref={rootRef}
        role="menu"
        aria-label={t("conversations.actionsMenu")}
        style={{
          top: menuPosition.top,
          left: menuPosition.left,
          width: menuPosition.width,
        }}
        className="fixed z-[200] overflow-hidden rounded-xl border border-default bg-surface-elevated p-1 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const className = cn(
            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
            item.disabled && "cursor-not-allowed opacity-50",
            item.variant === "danger"
              ? "text-danger hover:bg-danger/10"
              : item.variant === "warning"
                ? "text-warning hover:bg-warning/10"
                : "text-primary hover:bg-surface-muted"
          );

          if (item.href) {
            return (
              <a
                key={item.id}
                role="menuitem"
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                onClick={() => setOpen(false)}
                className={className}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </a>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => handleSelect(item)}
              className={className}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("conversations.actionsMenu")}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-default bg-surface-muted text-secondary transition-colors hover:bg-surface-elevated hover:text-primary",
          open && "border-accent/30 bg-accent-muted text-accent"
        )}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
