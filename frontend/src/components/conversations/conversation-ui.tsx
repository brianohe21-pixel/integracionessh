import {
  Camera,
  Globe,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  type LucideIcon,
} from "lucide-react";
import type { Channel } from "@/types";
import { cn } from "@/lib/utils";

const NEUTRAL_AVATAR = "bg-accent-muted text-accent";
const NEUTRAL_CHIP = "text-secondary";

export type ChannelMeta = {
  icon: LucideIcon;
  bg: string;
  iconColor: string;
  chipClass: string;
  label: string;
};

function channelMeta(icon: LucideIcon, label: string): ChannelMeta {
  return {
    icon,
    bg: NEUTRAL_AVATAR,
    iconColor: "text-accent",
    chipClass: NEUTRAL_CHIP,
    label,
  };
}

export function getChannelMeta(channel?: Channel): ChannelMeta {
  switch (channel) {
    case "instagram":
      return channelMeta(Camera, "instagram");
    case "email":
      return channelMeta(Mail, "email");
    case "telegram":
      return channelMeta(Send, "telegram");
    case "messenger":
      return channelMeta(MessageCircle, "messenger");
    case "sms":
      return channelMeta(MessageSquare, "sms");
    case "webchat":
      return channelMeta(Globe, "webchat");
    case "voicebot":
    case "phone":
      return channelMeta(Phone, channel ?? "phone");
    default:
      return channelMeta(MessageSquare, "whatsapp");
  }
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

const channelBadgeSizes = {
  sm: "h-4 w-4 -bottom-0.5 -right-0.5",
  md: "h-4 w-4 -bottom-0.5 -right-0.5",
  lg: "h-5 w-5 bottom-0 right-0",
};

export function ChannelAvatar({ channel, size = "sm", unread, className }: ChannelAvatarProps) {
  const meta = getChannelMeta(channel);
  const Icon = meta.icon;

  return (
    <div className={cn("relative flex-shrink-0", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full ring-2 ring-surface-elevated",
          avatarSizes[size],
          meta.bg
        )}
      >
        <Icon className={cn(iconSizes[size], meta.iconColor)} />
      </div>
      <div
        className={cn(
          "absolute flex items-center justify-center rounded-full bg-surface-elevated ring-1 ring-default",
          channelBadgeSizes[size]
        )}
      >
        <Icon className="h-2.5 w-2.5 text-accent" />
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
