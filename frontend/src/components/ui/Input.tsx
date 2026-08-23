import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const inputBase =
  "w-full rounded-lg border border-field-border bg-surface-elevated px-3 py-2 text-sm text-primary shadow-sm transition-shadow placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:shadow-md";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(inputBase, className)}
      {...props}
    />
  )
);

Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(inputBase, className)}
      {...props}
    />
  )
);

Select.displayName = "Select";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(inputBase, "resize-y", className)}
    {...props}
  />
));

Textarea.displayName = "Textarea";
