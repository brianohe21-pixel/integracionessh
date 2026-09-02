import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

type CardVariant = "default" | "elevated" | "glass" | "interactive";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: "none" | "sm" | "md" | "lg";
}

const variants: Record<CardVariant, string> = {
  default: "content-card",
  elevated: "content-card shadow-[var(--shadow-md)]",
  glass: "bg-surface-elevated/80 backdrop-blur-md rounded-xl shadow-[var(--shadow-card)]",
  interactive: "content-card content-card-interactive",
};

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Card({
  className,
  variant = "default",
  padding = "none",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(variants[variant], paddings[padding], className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("section-header", className)} {...props} />;
}

export function CardTitle({
  className,
  as: Tag = "h3",
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" | "p" | "span" }) {
  return <Tag className={cn("section-header-title", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("section-header-subtitle", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card-body", className)} {...props} />;
}

type CardIconHeaderProps = HTMLAttributes<HTMLDivElement> & {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

export function CardIconHeader({
  icon,
  title,
  description,
  actions,
  className,
  ...props
}: CardIconHeaderProps) {
  return (
    <div className={cn("card-icon-header flex-wrap justify-between", className)} {...props}>
      <div className="flex min-w-0 items-center gap-3">
        {icon ? <span className="card-icon-header-icon">{icon}</span> : null}
        <div className="min-w-0">
          <div className="card-icon-header-title">{title}</div>
          {description ? <div className="card-icon-header-subtitle">{description}</div> : null}
        </div>
      </div>
      {actions}
    </div>
  );
}

type ContentCardSectionProps = {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function ContentCardSection({
  title,
  children,
  className,
  bodyClassName,
}: ContentCardSectionProps) {
  return (
    <section className={cn("content-card overflow-hidden", className)}>
      <CardHeader className="py-3">
        <CardTitle as="h3" className="text-xs uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("!py-4", bodyClassName)}>{children}</CardContent>
    </section>
  );
}
