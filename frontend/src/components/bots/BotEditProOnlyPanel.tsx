"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useT } from "@/i18n/context";
import { SALES_WHATSAPP_URL } from "@/lib/plan-config";
import type { BotEditTab } from "@/components/bots/BotEditNav";

const TAB_LABEL_KEY: Partial<Record<BotEditTab, string>> = {
  sms: "bots.tabSms",
  email: "bots.tabEmail",
  voicebot: "bots.tabVoicebot",
  telephony: "bots.tabTelephony",
};

type BotEditProOnlyPanelProps = {
  tab: BotEditTab;
};

export function BotEditProOnlyPanel({ tab }: BotEditProOnlyPanelProps) {
  const t = useT();
  const tabLabelKey = TAB_LABEL_KEY[tab];

  return (
    <div className="content-card p-6 sm:p-8">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-muted text-muted">
          <Lock className="h-6 w-6" />
        </span>
        <span className="mb-3 rounded-md bg-surface-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-secondary">
          {t("nav.proOnly")}
        </span>
        <h2 className="text-lg font-semibold text-primary">
          {tabLabelKey ? t(tabLabelKey) : t("bots.navGroupChannels")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-secondary">{t("bots.proOnlyChannelHint")}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href={SALES_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            {t("bots.proOnlyContactSales")}
          </a>
          <Link
            href="/billing"
            className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-primary hover:bg-surface-muted"
          >
            {t("nav.billing")}
          </Link>
        </div>
      </div>
    </div>
  );
}
