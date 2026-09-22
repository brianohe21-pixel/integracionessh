import { cn } from "@/lib/utils";

type BotAvatarProps = {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "ai" | "webhook";
};

const containerSizes = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
};

function getVariantStyle(variant: BotAvatarProps["variant"]) {
  if (variant === "webhook") {
    return "bg-gradient-to-br from-[#F97316] to-[#EA580C]";
  }
  return "bg-gradient-to-br from-[#6366F1] to-[#8B5CF6]";
}

export function botInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return "?";
}

export function BotAvatar({
  name,
  className,
  size = "md",
  variant = "ai",
}: BotAvatarProps) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight text-white shadow-sm ring-2 ring-surface-elevated",
        containerSizes[size],
        getVariantStyle(variant),
        className
      )}
      aria-hidden
    >
      {botInitials(name)}
    </span>
  );
}
