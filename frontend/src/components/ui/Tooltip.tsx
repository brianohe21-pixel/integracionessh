"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type TooltipSide = "top" | "bottom" | "left" | "right";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  className?: string;
  contentClassName?: string;
};

const sideClasses: Record<TooltipSide, string> = {
  top: "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-1.5 -translate-x-1/2",
  left: "right-full top-1/2 mr-1.5 -translate-y-1/2",
  right: "left-full top-1/2 ml-1.5 -translate-y-1/2",
};

export function Tooltip({
  content,
  children,
  side = "bottom",
  className,
  contentClassName,
}: TooltipProps) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 hidden w-56 rounded-lg bg-surface-elevated px-2.5 py-2 text-xs font-normal leading-snug text-primary shadow-lg ring-1 ring-default group-hover:block group-focus-within:block",
          sideClasses[side],
          contentClassName
        )}
      >
        {content}
      </span>
    </span>
  );
}
