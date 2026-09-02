import { Check, CircleDot } from "lucide-react";
import { useT } from "@/i18n/context";

export function OnboardingMockup() {
  const t = useT();
  const steps = [
    { key: "whatsapp", done: true },
    { key: "createBot", done: true },
    { key: "testMessage", done: false, current: true },
    { key: "activateFlow", done: false },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-primary">{t("userManual.mockups.onboarding.title")}</p>
        <span className="rounded-md bg-accent-muted px-2 py-0.5 text-[11px] font-medium text-accent">
          2 / 4
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full w-1/2 rounded-full bg-accent" />
      </div>
      <ul className="space-y-2">
        {steps.map((step) => (
          <li
            key={step.key}
            className={
              "current" in step && step.current
                ? "rounded-xl border border-accent/40 bg-accent-muted/30 p-3"
                : "rounded-xl border border-default bg-surface p-3"
            }
          >
            <div className="flex items-start gap-2.5">
              {step.done ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              ) : "current" in step && step.current ? (
                <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              ) : (
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full border border-muted" />
              )}
              <div>
                <p className="text-xs font-medium text-primary">
                  {t(`userManual.mockups.onboarding.steps.${step.key}.title`)}
                </p>
                <p className="mt-0.5 text-[11px] text-secondary">
                  {t(`userManual.mockups.onboarding.steps.${step.key}.hint`)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="rounded-xl border border-dashed border-default bg-surface-muted/50 px-4 py-3 text-center">
        <p className="text-[11px] text-secondary">{t("userManual.mockups.onboarding.action")}</p>
        <div className="mt-2 inline-flex rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white">
          {t("userManual.mockups.onboarding.cta")}
        </div>
      </div>
    </div>
  );
}
