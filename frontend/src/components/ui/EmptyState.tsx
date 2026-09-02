import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-default bg-surface-elevated/50 px-6 py-16 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted text-accent ring-2 ring-accent/20">
          {icon}
        </div>
      )}
      <h3 className="mb-1.5 text-base font-semibold text-primary">{title}</h3>
      {description && (
        <p className="mb-6 max-w-sm text-sm leading-relaxed text-secondary">{description}</p>
      )}
      {action}
    </div>
  );
}
