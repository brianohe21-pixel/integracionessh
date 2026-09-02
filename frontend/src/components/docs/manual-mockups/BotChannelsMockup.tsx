import {
  Camera,
  Globe,
  Mail,
  MessagesSquare,
  Phone,
  Send,
  Settings,
} from "lucide-react";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "general", icon: Settings, active: false },
  { id: "whatsapp", icon: Phone, active: true },
  { id: "instagram", icon: Camera, active: false },
  { id: "webchat", icon: Globe, active: false },
  { id: "telegram", icon: Send, active: false },
  { id: "messenger", icon: MessagesSquare, active: false },
  { id: "sms", icon: Phone, active: false },
  { id: "email", icon: Mail, active: false },
] as const;

export function BotChannelsMockup() {
  const t = useT();

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex shrink-0 flex-row gap-1 overflow-x-auto sm:w-36 sm:flex-col sm:overflow-visible">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <div
              key={tab.id}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px]",
                tab.active
                  ? "bg-accent-muted font-medium text-accent"
                  : "text-secondary"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(`userManual.mockups.channels.tabs.${tab.id}`)}
            </div>
          );
        })}
      </div>
      <div className="min-w-0 flex-1 space-y-3 rounded-xl border border-default bg-surface p-3">
        <p className="text-xs font-semibold text-primary">
          {t("userManual.mockups.channels.panelTitle")}
        </p>
        <p className="text-[11px] leading-relaxed text-secondary">
          {t("userManual.mockups.channels.panelBody")}
        </p>
        <div className="rounded-lg border border-dashed border-default bg-surface-muted/50 px-3 py-4 text-center">
          <div className="mx-auto inline-flex rounded-lg bg-accent px-3 py-1.5 text-[11px] font-medium text-white">
            {t("userManual.mockups.channels.connectCta")}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["whatsapp", "webchat", "telegram"] as const).map((channel) => (
            <div key={channel} className="rounded-lg border border-subtle bg-surface-muted/40 p-2.5">
              <p className="text-[11px] font-medium text-primary">
                {t(`userManual.mockups.channels.cards.${channel}.title`)}
              </p>
              <p className="mt-0.5 text-[10px] text-muted">
                {t(`userManual.mockups.channels.cards.${channel}.hint`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
