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
  variant?: "default" | "vibrant";
};

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  variant = "default",
}: TabsProps<T>) {
  const isVibrant = variant === "vibrant";

  return (
    <div
      className={cn(
        "inline-flex gap-1 rounded-xl p-1 shadow-sm",
        isVibrant
          ? "border border-brand-primary/20 bg-gradient-to-r from-brand-primary/10 via-accent-muted/60 to-brand-primary/8"
          : "border border-default bg-surface-muted/60",
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
              ? isVibrant
                ? "bg-gradient-to-br from-brand-primary to-accent text-white shadow-md shadow-brand-primary/25"
                : "bg-surface-elevated text-primary shadow-sm ring-1 ring-default"
              : isVibrant
                ? "text-secondary hover:bg-brand-primary/10 hover:text-accent"
                : "text-secondary hover:text-primary"
          )}
        >
          {item.label}
          {item.count != null && item.count > 0 ? (
            <span
              className={cn(
                "ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                value === item.id && isVibrant
                  ? "bg-white/25 text-white"
                  : "bg-gradient-to-br from-brand-primary to-accent text-white"
              )}
            >
              {item.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
