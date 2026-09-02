"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import type { FlowNodeType } from "@/types";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

type PopoverSide = "right" | "top";

interface NodeHelpPopoverProps {
  type: FlowNodeType;
  children: ReactNode;
  side?: PopoverSide;
  showAddAction?: boolean;
  onAdd?: () => void;
  className?: string;
}

type PopoverCoords = {
  top: number;
  left: number;
  width: number;
};

const GAP_PX = 8;

export function NodeHelpPopover({
  type,
  children,
  side = "right",
  showAddAction = false,
  onAdd,
  className,
}: NodeHelpPopoverProps) {
  const t = useT();
  const description = t(`flows.nodeHelp.${type}.description`);
  const usage = t(`flows.nodeHelp.${type}.usage`);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
    };
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    if (side === "right") {
      setCoords({
        top: rect.top,
        left: rect.right + GAP_PX,
        width: 240,
      });
      return;
    }
    setCoords({
      top: rect.top - GAP_PX,
      left: rect.left,
      width: rect.width,
    });
  }, [side]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  function show() {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    updatePosition();
    setOpen(true);
  }

  function hide() {
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOpen(false), 80);
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    const next = event.relatedTarget as Node | null;
    if (triggerRef.current?.contains(next) || popoverRef.current?.contains(next)) return;
    hide();
  }

  const popover =
    open && coords ? (
      <div
        ref={popoverRef}
        role="tooltip"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={handleBlur}
        className={cn("fixed z-[60]", side === "right" ? "w-60" : undefined)}
        style={
          side === "right"
            ? { top: coords.top, left: coords.left, width: coords.width }
            : {
                top: coords.top,
                left: coords.left,
                width: coords.width,
                transform: "translateY(-100%)",
              }
        }
      >
        <div className="rounded-lg border border-default bg-surface-elevated p-3 shadow-xl">
          <p className="text-xs font-semibold text-primary">{t(`flows.nodeTypes.${type}`)}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-secondary">{description}</p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
            {t("flows.nodeHelp.usageLabel")}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-secondary">{usage}</p>
          {showAddAction && onAdd ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAdd();
              }}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
            >
              <Plus className="h-3 w-3" />
              {t("flows.nodeHelp.addAction")}
            </button>
          ) : null}
        </div>
      </div>
    ) : null;

  return (
    <div
      ref={triggerRef}
      className={cn("relative", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={handleBlur}
    >
      {children}
      {mounted && popover ? createPortal(popover, document.body) : null}
    </div>
  );
}
