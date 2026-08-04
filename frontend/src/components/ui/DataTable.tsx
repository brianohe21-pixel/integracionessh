import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

type DataTableProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  minWidth?: string;
};

export function DataTable({ children, className, minWidth = "560px", ...props }: DataTableProps) {
  return (
    <div className={cn("content-card overflow-hidden", className)} {...props}>
      <div className="-mx-px overflow-x-auto">
        <table
          className="data-table w-full text-sm"
          style={{ minWidth }}
        >
          {children}
        </table>
      </div>
    </div>
  );
}

type DataTableHeadProps = {
  children: ReactNode;
  className?: string;
};

export function DataTableHead({ children, className }: DataTableHeadProps) {
  return (
    <thead className={cn("text-left", className)}>
      {children}
    </thead>
  );
}

type DataTableBodyProps = {
  children: ReactNode;
  className?: string;
};

export function DataTableBody({ children, className }: DataTableBodyProps) {
  return <tbody className={className}>{children}</tbody>;
}

type DataTableRowProps = {
  children: ReactNode;
  className?: string;
};

export function DataTableRow({ children, className }: DataTableRowProps) {
  return <tr className={className}>{children}</tr>;
}

type DataTableCellProps = {
  children: ReactNode;
  className?: string;
  header?: boolean;
};

export function DataTableCell({ children, className, header }: DataTableCellProps) {
  const Tag = header ? "th" : "td";
  return (
    <Tag className={cn("px-4 py-3", header && "font-semibold", className)}>
      {children}
    </Tag>
  );
}
