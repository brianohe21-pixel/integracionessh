"use client";

import { useT } from "@/i18n/context";
import type { OutreachChannel } from "@/types";

interface OutreachChannelSelectProps {
  value: OutreachChannel;
  onChange: (value: OutreachChannel) => void;
  disabled?: boolean;
  className?: string;
}

export function OutreachChannelSelect({
  value,
  onChange,
  disabled,
  className,
}: OutreachChannelSelectProps) {
  const t = useT();

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as OutreachChannel)}
      disabled={disabled}
      className={className ?? "w-full px-3 py-2 border border-default rounded-lg text-sm bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"}
    >
      <option value="whatsapp">{t("outreach.channelWhatsapp")}</option>
      <option value="sms">{t("outreach.channelSms")}</option>
    </select>
  );
}
