import type { Channel } from "@/types";
import {
  ChannelBrandIcon,
  getChannelBrandStyle,
} from "@/components/channels/ChannelBrandIcon";
import { cn } from "@/lib/utils";

export function getChannelMeta(channel?: Channel) {
  return getChannelBrandStyle(channel);
}

export function conversationInitials(
  contactName?: string,
  phoneNumber?: string,
  participantId?: string
): string {
  if (contactName?.trim()) {
    const parts = contactName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return contactName.slice(0, 2).toUpperCase();
  }
  const fallback = phoneNumber || participantId;
  return fallback?.slice(-2).toUpperCase() ?? "?";
}

const AVATAR_PALETTE = [
  { bg: "bg-[#25D366]", text: "text-white" },
  { bg: "bg-[#128C7E]", text: "text-white" },
  { bg: "bg-[#0084FF]", text: "text-white" },
  { bg: "bg-[#26A5E4]", text: "text-white" },
  { bg: "bg-[#DD2A7B]", text: "text-white" },
  { bg: "bg-[#8134AF]", text: "text-white" },
  { bg: "bg-[#F58529]", text: "text-white" },
  { bg: "bg-[#EA4335]", text: "text-white" },
  { bg: "bg-[#7C3AED]", text: "text-white" },
  { bg: "bg-[#0EA5E9]", text: "text-white" },
  { bg: "bg-[#14B8A6]", text: "text-white" },
  { bg: "bg-[#F59E0B]", text: "text-white" },
] as const;

export function conversationAvatarColor(
  contactName?: string,
  phoneNumber?: string,
  participantId?: string
): (typeof AVATAR_PALETTE)[number] {
  const seed = (contactName?.trim() || phoneNumber || participantId || "?").toLowerCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

type ChannelAvatarProps = {
  channel?: Channel;
  size?: "sm" | "md" | "lg";
  unread?: boolean;
  className?: string;
};

type ConversationAvatarProps = {
  contactName?: string;
  phoneNumber?: string;
  participantId?: string;
  channel?: Channel;
  size?: "sm" | "md" | "lg";
  unread?: boolean;
  className?: string;
};

const avatarSizes = {
  sm: "h-11 w-11 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-20 w-20 text-xl",
};

const iconSizes = {
  sm: "h-5 w-5",
  md: "h-5 w-5",
  lg: "h-8 w-8",
};

const channelBadgeSizes = {
  sm: { container: "h-4 w-4", icon: "h-2.5 w-2.5" },
  md: { container: "h-5 w-5", icon: "h-3 w-3" },
  lg: { container: "h-6 w-6", icon: "h-3.5 w-3.5" },
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

export function ConversationAvatar({
  contactName,
  phoneNumber,
  participantId,
  channel,
  size = "sm",
  unread,
  className,
}: ConversationAvatarProps) {
  const initials = conversationInitials(contactName, phoneNumber, participantId);
  const color = conversationAvatarColor(contactName, phoneNumber, participantId);
  const brand = getChannelBrandStyle(channel);
  const badge = channelBadgeSizes[size];

  return (
    <div className={cn("relative flex-shrink-0", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full font-semibold shadow-sm ring-2 ring-surface-elevated",
          avatarSizes[size],
          color.bg,
          color.text
        )}
      >
        {initials}
      </div>
      <div
        className={cn(
          "absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full text-white shadow-sm ring-2 ring-surface-elevated",
          badge.container,
          brand.bgClass
        )}
        aria-hidden
      >
        <ChannelBrandIcon channel={channel} className={badge.icon} />
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
