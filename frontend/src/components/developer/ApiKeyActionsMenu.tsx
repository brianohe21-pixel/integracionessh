"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, PauseCircle, PlayCircle, Shield, Trash2 } from "lucide-react";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

type MenuItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

type ApiKeyActionsMenuProps = {
  enabled: boolean;
  busy?: boolean;
  onEditScopes: () => void;
  onToggleEnabled: () => void;
  onRevoke: () => void;
};

export function ApiKeyActionsMenu({
  enabled,
  busy = false,
  onEditScopes,
  onToggleEnabled,
  onRevoke,
}: ApiKeyActionsMenuProps) {
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
      const menuWidth = 220;
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

  const items: MenuItem[] = [
    {
      id: "scopes",
      label: t("developer.editScopes"),
      icon: Shield,
      onClick: onEditScopes,
      disabled: busy,
    },
    {
      id: "toggle",
      label: enabled ? t("developer.disableKey") : t("developer.enableKey"),
      icon: enabled ? PauseCircle : PlayCircle,
      onClick: onToggleEnabled,
      disabled: busy,
    },
    {
      id: "revoke",
      label: t("developer.revokeKey"),
      icon: Trash2,
      onClick: onRevoke,
      disabled: busy,
      variant: "danger",
    },
  ];

  function handleSelect(item: MenuItem) {
    if (item.disabled) return;
    setOpen(false);
    item.onClick();
  }

  const menu =
    open && menuPosition && mounted ? (
      <div
        ref={rootRef}
        role="menu"
        aria-label={t("developer.actionsMenu")}
        style={{
          top: menuPosition.top,
          left: menuPosition.left,
          width: menuPosition.width,
        }}
        className="fixed z-[200] overflow-hidden rounded-xl border border-default bg-surface-elevated p-1 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        {items.map((menuItem) => {
          const Icon = menuItem.icon;
          return (
            <button
              key={menuItem.id}
              type="button"
              role="menuitem"
              disabled={menuItem.disabled}
              onClick={() => handleSelect(menuItem)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                menuItem.disabled && "cursor-not-allowed opacity-50",
                menuItem.variant === "danger"
                  ? "text-danger hover:bg-danger/10"
                  : "text-primary hover:bg-surface-muted"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{menuItem.label}</span>
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
        aria-label={t("developer.actionsMenu")}
        disabled={busy}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-default text-secondary transition-colors hover:bg-surface-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-accent/30 bg-accent-muted text-accent"
        )}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
