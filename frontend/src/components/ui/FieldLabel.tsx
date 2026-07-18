"use client";

import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";

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
      <Tooltip content={tooltip}>
        <span title={tooltip}>
          <CircleHelp
            tabIndex={0}
            className="h-4 w-4 cursor-help text-muted outline-none focus:text-secondary"
            aria-label={tooltip}
          />
        </span>
      </Tooltip>
    </span>
  );
}
