import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type DashboardPageProps = {
  children: ReactNode;
  maxWidth?: "none" | "3xl" | "4xl" | "5xl" | "6xl";
  className?: string;
};

export function DashboardPage({
  children,
  maxWidth: _maxWidth,
  className,
}: DashboardPageProps) {
  return (
    <div
      className={cn(
        "page-enter flex h-full min-h-full w-full max-w-none flex-1 flex-col px-5 py-5 lg:px-6 lg:py-6",
        className
      )}
    >
      {children}
    </div>
  );
}
