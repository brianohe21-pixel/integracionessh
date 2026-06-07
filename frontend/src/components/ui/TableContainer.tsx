import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type TableContainerProps = {
  children: ReactNode;
  className?: string;
};

export function TableContainer({ children, className }: TableContainerProps) {
  return (
    <div
      className={cn(
        "-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0",
        className
      )}
    >
      {children}
    </div>
  );
}
