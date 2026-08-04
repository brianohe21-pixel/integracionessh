"use client";

import { cn } from "@/lib/utils";

export type TabItem<T extends string = string> = {
  id: T;
  label: string;
  count?: number;
};

type TabsProps<T extends string> = {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function Tabs<T extends string>({ items, value, onChange, className }: TabsProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex gap-1 rounded-xl border border-default bg-surface-muted/60 p-1 shadow-sm",
        className
      )}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150",
            value === item.id
              ? "bg-surface-elevated text-primary shadow-sm ring-1 ring-default"
              : "text-secondary hover:text-primary"
          )}
        >
          {item.label}
          {item.count != null && item.count > 0 ? (
            <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
              {item.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
