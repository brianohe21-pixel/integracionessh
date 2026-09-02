"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SideDrawer({
  title,
  onClose,
  children,
  footer,
  widthClass = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l border-default bg-surface-elevated shadow-xl",
          widthClass
        )}
      >
        <div className="flex items-center justify-between border-b border-default px-5 py-4">
          <h2 className="truncate pr-2 font-semibold text-primary">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <div className="border-t border-default px-5 py-4">{footer}</div>
        ) : null}
      </aside>
    </>,
    document.body
  );
}
