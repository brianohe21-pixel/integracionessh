"use client";

import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldLabelProps {
  label: string;
  tooltip: string;
  htmlFor?: string;
  className?: string;
}

export function FieldLabel({ label, tooltip, htmlFor, className }: FieldLabelProps) {
  return (
    <span className={cn("mb-1 flex items-center gap-1.5 text-secondary", className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="font-medium">
          {label}
        </label>
      ) : (
        <span className="font-medium">{label}</span>
      )}
      <span className="group relative inline-flex shrink-0" title={tooltip}>
        <CircleHelp
          tabIndex={0}
          className="h-4 w-4 cursor-help text-muted outline-none focus:text-secondary"
          aria-label={tooltip}
        />
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 hidden w-56 -translate-x-1/2 rounded-lg bg-surface px-2.5 py-2 text-xs font-normal leading-snug text-primary shadow-lg ring-1 ring-default group-hover:block group-focus-within:block"
        >
          {tooltip}
        </span>
      </span>
    </span>
  );
}
