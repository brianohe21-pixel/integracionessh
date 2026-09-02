import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const inputBase =
  "w-full rounded-lg border border-field-border bg-surface-elevated px-3 py-2 text-sm text-primary shadow-sm transition-shadow placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:shadow-md";

const selectBase = cn(
  inputBase,
  "cursor-pointer appearance-none pr-10 hover:border-accent/40 focus:border-accent"
);

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

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(selectBase, className)}
      {...props}
    />
  )
);

Select.displayName = "Select";

export function SelectControl({
  className,
  selectClassName,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  className?: string;
  selectClassName?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Select className={selectClassName} {...props}>
        {children}
      </Select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </div>
  );
}

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
