"use client";

import Link from "next/link";
import { Megaphone, SendHorizonal, Settings, ShieldCheck } from "lucide-react";
import { useT } from "@/i18n/context";

export function SmsShortcuts() {
  const t = useT();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/sms?tab=config&section=otp"
        className="inline-flex items-center gap-2 rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-surface-muted"
      >
        <ShieldCheck className="h-4 w-4" />
        {t("smsDashboard.shortcuts.otp")}
      </Link>
      <Link
        href="/bulk-send"
        className="inline-flex items-center gap-2 rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-surface-muted"
      >
        <SendHorizonal className="h-4 w-4" />
        {t("smsDashboard.shortcuts.bulkSend")}
      </Link>
      <Link
        href="/campaigns/new"
        className="inline-flex items-center gap-2 rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-surface-muted"
      >
        <Megaphone className="h-4 w-4" />
        {t("smsDashboard.shortcuts.newCampaign")}
      </Link>
      <Link
        href="/bots"
        className="inline-flex items-center gap-2 rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-surface-muted"
      >
        <Settings className="h-4 w-4" />
        {t("smsDashboard.shortcuts.botSettings")}
      </Link>
    </div>
  );
}
