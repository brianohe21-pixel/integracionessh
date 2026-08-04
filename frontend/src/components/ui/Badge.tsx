import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "accent";
  className?: string;
  dot?: boolean;
}

const variants = {
  default: "bg-surface-muted text-secondary ring-1 ring-default",
  success: "bg-success/15 text-success ring-1 ring-success/25",
  warning: "bg-warning/15 text-warning ring-1 ring-warning/25",
  danger: "bg-danger/15 text-danger ring-1 ring-danger/25",
  info: "bg-info/15 text-info ring-1 ring-info/25",
  accent: "bg-accent-muted text-accent ring-1 ring-accent/30",
};

export function Badge({ children, variant = "default", className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "success" && "bg-success",
            variant === "warning" && "bg-warning",
            variant === "danger" && "bg-danger",
            variant === "info" && "bg-info",
            variant === "accent" && "bg-accent",
            variant === "default" && "bg-muted"
          )}
        />
      )}
      {children}
    </span>
  );
}
