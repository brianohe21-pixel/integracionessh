"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckSquare, MoreVertical } from "lucide-react";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

type Props = {
  text: string;
  align: "left" | "right";
  onCreateTask: (text: string) => void;
};

type MenuPosition = {
  top: number;
  left: number;
};

const MENU_WIDTH = 220;

export function MessageTaskActions({ text, align, onCreateTask }: Props) {
  const t = useT();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const left =
        align === "left"
          ? Math.min(Math.max(8, rect.left), window.innerWidth - MENU_WIDTH - 8)
          : Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
      setMenuPosition({
        top: Math.min(rect.bottom + 8, window.innerHeight - 56),
        left,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
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

  function resolveTaskText(): string {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      const selected = selection.toString().trim();
      if (selected) return selected;
    }
    return text.trim();
  }

  function handleCreateTask() {
    const value = resolveTaskText();
    setOpen(false);
    window.getSelection()?.removeAllRanges();
    if (!value) return;
    onCreateTask(value);
  }

  const menu =
    open && menuPosition && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        aria-label={t("tasks.createFromMessage")}
        style={{ top: menuPosition.top, left: menuPosition.left, width: MENU_WIDTH }}
        className="fixed z-[220] overflow-hidden rounded-xl border border-default bg-surface-elevated p-1 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        <button
          type="button"
          role="menuitem"
          onClick={handleCreateTask}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-primary transition-colors hover:bg-surface-muted"
        >
          <CheckSquare className="h-4 w-4 shrink-0 text-accent" />
          <span>{t("tasks.createFromConversation")}</span>
        </button>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={!text.trim()}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("tasks.createFromMessage")}
        title={t("tasks.createFromMessage")}
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded text-muted transition-colors hover:text-primary",
          open && "text-accent"
        )}
      >
        <MoreVertical className="h-3 w-3" />
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
