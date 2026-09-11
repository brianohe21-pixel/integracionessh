import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const maxWidthClasses: Record<NonNullable<DashboardPageProps["maxWidth"]>, string> = {
  none: "max-w-none",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
};

type DashboardPageProps = {
  children: ReactNode;
  maxWidth?: "none" | "3xl" | "4xl" | "5xl" | "6xl";
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
        "page-enter flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto px-5 py-5 lg:px-6 lg:py-6",
        maxWidthClasses[maxWidth],
        className
      )}
    >
      {children}
    </div>
  );
}
