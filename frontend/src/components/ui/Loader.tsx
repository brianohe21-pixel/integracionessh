import { cn } from "@/lib/utils";

type SpinnerSize = "sm" | "md" | "lg";

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "h-5 w-5 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-10 w-10 border-[2.5px]",
};

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-default border-t-accent",
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

interface PageLoaderProps {
  className?: string;
  label?: string;
}

export function PageLoader({ className, label }: PageLoaderProps) {
  return (
    <div className={cn("flex min-h-screen items-center justify-center bg-surface", className)}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-accent-muted opacity-40" />
          <Spinner size="lg" className="relative" />
        </div>
        {label ? <p className="text-sm text-secondary">{label}</p> : null}
      </div>
    </div>
  );
}

interface ContentLoaderProps {
  className?: string;
  label?: string;
}

export function ContentLoader({ className, label }: ContentLoaderProps) {
  return (
    <div className={cn("flex min-h-[50vh] flex-1 items-center justify-center", className)}>
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        {label ? <p className="text-sm text-secondary">{label}</p> : null}
      </div>
    </div>
  );
}
