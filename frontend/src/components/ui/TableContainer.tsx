import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type TableContainerProps = {
  children: ReactNode;
  className?: string;
  card?: boolean;
};

export function TableContainer({ children, className, card = true }: TableContainerProps) {
  return (
    <div
      className={cn(
        "w-full min-w-0 overflow-x-auto",
        card && "content-card",
        className
      )}
    >
      {children}
    </div>
  );
}
