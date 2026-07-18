import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type CardVariant = "default" | "elevated" | "glass";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variants: Record<CardVariant, string> = {
  default: "bg-surface-elevated border border-default",
  elevated: "bg-surface-elevated border border-default shadow-lg shadow-black/5",
  glass: "bg-surface-elevated/80 border border-default backdrop-blur-md",
};

export function Card({ className, variant = "default", ...props }: CardProps) {
  return (
    <div className={cn("rounded-xl", variants[variant], className)} {...props} />
  );
}
