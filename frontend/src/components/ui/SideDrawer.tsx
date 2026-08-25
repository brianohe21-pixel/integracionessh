"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

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
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div
        className={`flex h-full w-full ${widthClass} flex-col bg-surface-elevated shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-default px-5 py-4">
          <h2 className="font-semibold text-primary truncate pr-2">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <div className="border-t border-default px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
