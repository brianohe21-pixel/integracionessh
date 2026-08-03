import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type CardVariant = "default" | "elevated" | "glass" | "interactive";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: "none" | "sm" | "md" | "lg";
}

const variants: Record<CardVariant, string> = {
  default: "content-card",
  elevated: "content-card shadow-[var(--shadow-md)]",
  glass: "bg-surface-elevated/80 border border-default backdrop-blur-md rounded-xl shadow-[var(--shadow-card)]",
  interactive: "content-card content-card-interactive",
};

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Card({
  className,
  variant = "default",
  padding = "none",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(variants[variant], paddings[padding], className)}
      {...props}
    />
  );
}
