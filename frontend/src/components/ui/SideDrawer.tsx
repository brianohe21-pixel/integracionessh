"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SideDrawer({
  title,
  subtitle,
  onClose,
  children,
  footer,
  widthClass = "max-w-lg",
  contentClassName,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
  contentClassName?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => setVisible(true));

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 top-14 z-[45] bg-black/35 transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "fixed bottom-0 right-0 top-14 z-[45] flex w-full flex-col border-l border-default bg-surface-elevated shadow-2xl transition-transform duration-300 ease-out",
          visible ? "translate-x-0" : "translate-x-full",
          widthClass
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-default px-5 py-4">
          <div className="min-w-0 pr-2">
            <h2 className="truncate text-lg font-semibold text-primary">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-sm leading-snug text-secondary">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-secondary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={cn("flex-1 overflow-y-auto", contentClassName)}>{children}</div>
        {footer ? (
          <div className="border-t border-default bg-surface-elevated/95 px-5 py-4 backdrop-blur">
            {footer}
          </div>
        ) : null}
      </aside>
    </>,
    document.body
  );
}
