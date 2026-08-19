"use client";

import { useState, type ComponentType } from "react";
import {
  SERVICE_CATEGORIES,
  SERVICE_LIMIT_KEYS,
  SERVICE_NAV_KEYS,
  type BagLimitKey,
  type ResellerBag,
  type SubaccountServiceId,
} from "@/lib/subaccount-services";
import type { ResellerLimitsOverride } from "@/types";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import {
  BarChart3,
  BookUser,
  BotMessageSquare,
  GitBranch,
  Headphones,
  KeyRound,
  LayoutGrid,
  LayoutTemplate,
  Mail,
  Megaphone,
  MessageSquare,
  PhoneCall,
  SendHorizonal,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

const SERVICE_ICONS: Record<SubaccountServiceId, ComponentType<{ className?: string }>> = {
  bots: BotMessageSquare,
  voiceAgents: PhoneCall,
  contactCenter: Headphones,
  conversations: MessageSquare,
  supervisor: LayoutGrid,
  contacts: BookUser,
  leads: UserPlus,
  advisors: Users,
  automations: Zap,
  flows: GitBranch,
  templates: LayoutTemplate,
  bulkSend: SendHorizonal,
  campaigns: Megaphone,
  emailMarketing: Mail,
  metrics: BarChart3,
  apps: LayoutGrid,
  developer: KeyRound,
};

const SUBACCOUNT_ORDER: SubaccountServiceId[] = SERVICE_CATEGORIES.flatMap(
  (category) => category.services
);

export function SubaccountServicesFields({
  enabledServices,
  serviceLimits,
  bag,
  currentLimits,
  showHeader = true,
  onChange,
}: {
  enabledServices: SubaccountServiceId[];
  serviceLimits: ResellerLimitsOverride;
  bag?: ResellerBag;
  currentLimits?: ResellerLimitsOverride;
  showHeader?: boolean;
  onChange: (next: {
    enabledServices: SubaccountServiceId[];
    serviceLimits: ResellerLimitsOverride;
  }) => void;
}) {
  const t = useT();
  const [tab, setTab] = useState(SERVICE_CATEGORIES[0]!.id);
  const enabled = new Set(enabledServices);
  const category =
    SERVICE_CATEGORIES.find((item) => item.id === tab) ?? SERVICE_CATEGORIES[0]!;
  const onCount = category.services.filter((id) => enabled.has(id)).length;
  const allOn = onCount === category.services.length;

  function emit(nextEnabled: SubaccountServiceId[], nextLimits: ResellerLimitsOverride) {
    onChange({ enabledServices: nextEnabled, serviceLimits: nextLimits });
  }

  function toggle(service: SubaccountServiceId, checked: boolean) {
    const nextEnabled = checked
      ? SUBACCOUNT_ORDER.filter((id) => enabled.has(id) || id === service)
      : enabledServices.filter((id) => id !== service);
    const nextLimits = { ...serviceLimits };
    if (!checked) {
      for (const key of SERVICE_LIMIT_KEYS[service]) {
        delete nextLimits[key];
      }
    }
    emit(nextEnabled, nextLimits);
  }

  function setLimit(key: BagLimitKey, value: number) {
    emit(enabledServices, {
      ...serviceLimits,
      [key]: Number.isFinite(value) ? Math.max(0, value) : 0,
    });
  }

  function setCategory(services: SubaccountServiceId[], checked: boolean) {
    const keep = enabledServices.filter((id) => !services.includes(id));
    const nextEnabled = checked
      ? SUBACCOUNT_ORDER.filter((id) => keep.includes(id) || services.includes(id))
      : keep;
    const nextLimits = { ...serviceLimits };
    if (!checked) {
      for (const service of services) {
        for (const key of SERVICE_LIMIT_KEYS[service]) {
          delete nextLimits[key];
        }
      }
    }
    emit(nextEnabled, nextLimits);
  }

  return (
    <div className="space-y-4">
      {showHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-primary">{t("reseller.servicesTitle")}</h3>
            <p className="mt-1 text-xs leading-relaxed text-secondary">{t("reseller.servicesHint")}</p>
          </div>
          <Badge variant="accent" dot>
            {t("reseller.enabledOf", {
              count: String(enabledServices.length),
              total: String(SUBACCOUNT_ORDER.length),
            })}
          </Badge>
        </div>
      ) : null}

      <Tabs
        className="w-full"
        items={SERVICE_CATEGORIES.map((item) => ({
          id: item.id,
          label: t(item.labelKey),
          count: item.services.filter((id) => enabled.has(id)).length,
        }))}
        value={tab}
        onChange={setTab}
      />

      <div className="flex justify-end">
        <button
          type="button"
          className="text-xs font-medium text-accent hover:underline"
          onClick={() => setCategory(category.services, !allOn)}
        >
          {allOn ? t("reseller.selectNone") : t("reseller.selectAll")}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {category.services.map((service) => {
          const keys = SERVICE_LIMIT_KEYS[service];
          const isOn = enabled.has(service);
          const Icon = SERVICE_ICONS[service];
          return (
            <div
              key={service}
              className={cn(
                "rounded-xl border transition-colors",
                isOn
                  ? "border-accent/35 bg-accent/[0.06]"
                  : "border-default bg-surface"
              )}
            >
              <button
                type="button"
                role="switch"
                aria-checked={isOn}
                onClick={() => toggle(service, !isOn)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    isOn ? "bg-accent text-white" : "bg-surface-muted text-secondary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-primary">
                    {t(SERVICE_NAV_KEYS[service])}
                  </span>
                  <span className="block text-[11px] text-secondary">
                    {keys.length > 0 ? t("reseller.hasQuotas") : t("reseller.noQuota")}
                  </span>
                </span>
                <span
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                    isOn ? "bg-accent" : "bg-surface-muted ring-1 ring-default"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                      isOn ? "translate-x-4" : "translate-x-0.5"
                    )}
                  />
                </span>
              </button>
              {isOn && keys.length > 0 ? (
                <div className="grid gap-2 border-t border-accent/15 px-3 py-3 sm:grid-cols-2">
                  {keys.map((key) => {
                    const remaining = bag?.remaining[key];
                    const current = currentLimits?.[key] ?? 0;
                    const available =
                      remaining === null || remaining === undefined
                        ? null
                        : remaining + (typeof current === "number" ? current : 0);
                    const value = serviceLimits[key] ?? 0;
                    const pct =
                      available && available > 0
                        ? Math.min(100, (value / available) * 100)
                        : 0;
                    return (
                      <label key={key} className="space-y-1.5">
                        <span className="flex items-center justify-between gap-2 text-[11px] text-secondary">
                          <span>{t(`reseller.limits.${key}`)}</span>
                          {available === null ? (
                            <span className="text-accent">{t("reseller.unlimited")}</span>
                          ) : (
                            <span>
                              {t("reseller.availableShort", {
                                remaining: String(available),
                              })}
                            </span>
                          )}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={available ?? undefined}
                          value={value}
                          onChange={(e) => setLimit(key, Number(e.target.value))}
                          className="w-full rounded-lg border border-default bg-surface px-2.5 py-1.5 text-sm text-primary"
                        />
                        {available !== null ? (
                          <span className="block h-1 overflow-hidden rounded-full bg-surface-muted">
                            <span
                              className={cn(
                                "block h-full rounded-full",
                                pct >= 90 ? "bg-warning" : "bg-accent"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
