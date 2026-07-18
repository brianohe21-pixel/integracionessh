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
    <div className={cn("flex flex-col items-center justify-center px-4 py-16 text-center", className)}>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-muted">
          {icon}
        </div>
      )}
      <h3 className="mb-1 text-base font-semibold text-primary">{title}</h3>
      {description && <p className="mb-6 max-w-sm text-sm text-secondary">{description}</p>}
      {action}
    </div>
  );
}
