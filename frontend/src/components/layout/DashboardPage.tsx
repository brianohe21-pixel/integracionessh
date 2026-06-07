import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const MAX_WIDTH_CLASS = {
  none: "",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
} as const;

type DashboardPageProps = {
  children: ReactNode;
  maxWidth?: keyof typeof MAX_WIDTH_CLASS;
  className?: string;
};

export function DashboardPage({
  children,
  maxWidth = "none",
  className,
}: DashboardPageProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8",
        MAX_WIDTH_CLASS[maxWidth],
        className
      )}
    >
      {children}
    </div>
  );
}
