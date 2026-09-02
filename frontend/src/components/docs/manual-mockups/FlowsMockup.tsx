import { useT } from "@/i18n/context";

export function FlowsMockup() {
  const t = useT();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-primary">{t("userManual.mockups.flows.title")}</p>
          <p className="text-[11px] text-secondary">{t("userManual.mockups.flows.subtitle")}</p>
        </div>
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
          {t("userManual.mockups.flows.enabled")}
        </span>
      </div>
      <div className="relative min-h-[180px] overflow-hidden rounded-xl border border-default bg-[linear-gradient(var(--surface-muted)_1px,transparent_1px),linear-gradient(90deg,var(--surface-muted)_1px,transparent_1px)] bg-[size:16px_16px] p-4">
        <div className="absolute left-6 top-8 w-28 rounded-lg border border-default bg-surface-elevated p-2 shadow-sm">
          <p className="text-[10px] font-semibold text-primary">
            {t("userManual.mockups.flows.nodes.trigger")}
          </p>
          <p className="text-[9px] text-muted">{t("userManual.mockups.flows.nodes.triggerHint")}</p>
        </div>
        <div className="absolute left-[9.5rem] top-8 h-0.5 w-12 bg-accent/50" />
        <div className="absolute left-[12.5rem] top-6 w-32 rounded-lg border border-default bg-surface-elevated p-2 shadow-sm">
          <p className="text-[10px] font-semibold text-primary">
            {t("userManual.mockups.flows.nodes.message")}
          </p>
          <p className="text-[9px] text-muted">{t("userManual.mockups.flows.nodes.messageHint")}</p>
        </div>
        <div className="absolute left-[12.5rem] top-[5.5rem] h-8 w-0.5 bg-accent/50" />
        <div className="absolute left-[11.75rem] top-[7.5rem] w-36 rounded-lg border border-default bg-surface-elevated p-2 shadow-sm">
          <p className="text-[10px] font-semibold text-primary">
            {t("userManual.mockups.flows.nodes.buttons")}
          </p>
          <div className="mt-1 space-y-1">
            <div className="rounded bg-surface-muted px-1.5 py-0.5 text-[9px] text-secondary">
              {t("userManual.mockups.flows.nodes.buttonA")}
            </div>
            <div className="rounded bg-surface-muted px-1.5 py-0.5 text-[9px] text-secondary">
              {t("userManual.mockups.flows.nodes.buttonB")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
