import type { ReactNode } from "react";

export function ManualFigure({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-default bg-surface-elevated shadow-sm">
      <div className="flex items-center gap-2 border-b border-default bg-surface-muted/60 px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
        </span>
        <span className="truncate text-xs font-medium text-secondary">{title}</span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
      {caption ? (
        <figcaption className="border-t border-subtle px-4 py-2.5 text-xs text-muted">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
