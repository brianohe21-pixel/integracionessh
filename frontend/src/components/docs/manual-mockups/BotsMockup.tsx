import { Bot, Globe, Phone, Plus } from "lucide-react";
import { useT } from "@/i18n/context";

export function BotsGridMockup() {
  const t = useT();
  const bots = ["support", "sales"] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">{t("userManual.mockups.botsGrid.title")}</p>
          <p className="text-[11px] text-secondary">{t("userManual.mockups.botsGrid.subtitle")}</p>
        </div>
        <div className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-medium text-white">
          <Plus className="h-3.5 w-3.5" />
          {t("userManual.mockups.botsGrid.create")}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {bots.map((bot) => (
          <div
            key={bot}
            className="rounded-xl border border-default bg-surface p-3 shadow-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-muted text-accent">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-primary">
                  {t(`userManual.mockups.botsGrid.cards.${bot}.name`)}
                </p>
                <p className="text-[10px] text-muted">
                  {t(`userManual.mockups.botsGrid.cards.${bot}.mode`)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] text-secondary">
                <Phone className="h-3 w-3" />
                WhatsApp
              </span>
              {bot === "support" ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] text-secondary">
                  <Globe className="h-3 w-3" />
                  Web
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BotCreateMockup() {
  const t = useT();

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-primary">{t("userManual.mockups.botCreate.title")}</p>
      <div className="space-y-2">
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">
            {t("userManual.mockups.botCreate.nameLabel")}
          </p>
          <div className="rounded-lg border border-default bg-surface px-3 py-2 text-xs text-primary">
            {t("userManual.mockups.botCreate.nameValue")}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">
            {t("userManual.mockups.botCreate.modeLabel")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-accent/40 bg-accent-muted/30 px-3 py-2 text-xs font-medium text-accent">
              {t("userManual.mockups.botCreate.modeOpenAi")}
            </div>
            <div className="rounded-lg border border-default bg-surface px-3 py-2 text-xs text-secondary">
              {t("userManual.mockups.botCreate.modeWebhook")}
            </div>
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">
            {t("userManual.mockups.botCreate.templateLabel")}
          </p>
          <div className="rounded-lg border border-default bg-surface px-3 py-2 text-xs text-secondary">
            {t("userManual.mockups.botCreate.templateValue")}
          </div>
        </div>
      </div>
    </div>
  );
}
