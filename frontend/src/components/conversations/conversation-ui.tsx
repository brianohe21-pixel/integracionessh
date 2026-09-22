import type { Channel } from "@/types";
import {
  ChannelBrandIcon,
  getChannelBrandStyle,
} from "@/components/channels/ChannelBrandIcon";
import { cn } from "@/lib/utils";

export function getChannelMeta(channel?: Channel) {
  return getChannelBrandStyle(channel);
}

type ChannelAvatarProps = {
  channel?: Channel;
  size?: "sm" | "md" | "lg";
  unread?: boolean;
  className?: string;
};

const avatarSizes = {
  sm: "h-11 w-11",
  md: "h-10 w-10",
  lg: "h-20 w-20",
};

const iconSizes = {
  sm: "h-5 w-5",
  md: "h-5 w-5",
  lg: "h-8 w-8",
};

export function ChannelAvatar({ channel, size = "sm", unread, className }: ChannelAvatarProps) {
  const brand = getChannelBrandStyle(channel);

  return (
    <div className={cn("relative flex-shrink-0", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full text-white shadow-sm ring-2 ring-surface-elevated",
          avatarSizes[size],
          brand.bgClass
        )}
      >
        <ChannelBrandIcon channel={channel} className={iconSizes[size]} />
      </div>
      {unread ? (
        <span
          className="absolute left-0 top-0 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface-elevated"
          aria-hidden
        />
      ) : null}
    </div>
  );
}

export function ConversationDateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-4">
      <span className="rounded-full bg-surface-elevated px-3 py-1 text-[11px] font-medium text-secondary shadow-sm ring-1 ring-default">
        {label}
      </span>
    </div>
  );
}
