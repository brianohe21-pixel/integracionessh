import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white shadow-sm hover:bg-accent-hover hover:shadow-md active:scale-[0.98] disabled:opacity-50",
  secondary:
    "border border-default bg-surface-elevated text-primary shadow-sm hover:bg-surface-muted hover:shadow-md active:scale-[0.98] disabled:opacity-50",
  outline:
    "border border-default bg-transparent text-primary hover:bg-surface-muted active:scale-[0.98] disabled:opacity-50",
  ghost:
    "text-secondary hover:bg-surface-muted hover:text-primary active:scale-[0.98] disabled:opacity-50",
  danger:
    "bg-danger text-white shadow-sm hover:bg-danger/90 hover:shadow-md active:scale-[0.98] disabled:opacity-50",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2 text-sm rounded-lg",
  lg: "px-5 py-2.5 text-base rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
);

Button.displayName = "Button";
