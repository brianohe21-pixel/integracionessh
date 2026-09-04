import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, children, className }: FormFieldProps) {
  return (
    <div className={cn("block text-sm", className)}>
      <span className="mb-1 block font-medium text-secondary">{label}</span>
      {children}
    </div>
  );
}
