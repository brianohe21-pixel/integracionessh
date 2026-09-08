"use client";

import { useState, type ComponentType } from "react";
import {
  SERVICE_CATEGORIES,
  SERVICE_LIMIT_KEYS,
  SERVICE_NAV_KEYS,
  UNLIMITED_LIMIT_VALUE,
  getServiceLimitMode,
  type BagLimitKey,
  type ResellerBag,
  type ServiceLimitMode,
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
  Link2,
  Mail,
  Megaphone,
  MessageSquare,
  PhoneCall,
  SendHorizonal,
  UserPlus,
  Users,
  TrendingUp,
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
  sales: TrendingUp,
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
  integrations: Link2,
};

const SUBACCOUNT_ORDER: SubaccountServiceId[] = SERVICE_CATEGORIES.flatMap(
  (category) => category.services
);

function quotaModeButtonClass(active: boolean): string {
  return cn(
    "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
    active
      ? "border-accent bg-accent text-white"
      : "border-default bg-surface text-secondary hover:border-accent/40 hover:text-primary"
  );
}

function SubaccountLimitField({
  limitKey,
  serviceLimits,
  bagUnlimited,
  available,
  onModeChange,
  onCustomChange,
  t,
}: {
  limitKey: BagLimitKey;
  serviceLimits: ResellerLimitsOverride;
  bagUnlimited: boolean;
  available: number | null;
  onModeChange: (mode: ServiceLimitMode) => void;
  onCustomChange: (value: number) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const mode = getServiceLimitMode(serviceLimits, limitKey);
  const customValue = serviceLimits[limitKey];
  const numericCustom =
    mode === "custom" && typeof customValue === "number" ? customValue : 1;
  const pct =
    mode === "custom" && available && available > 0
      ? Math.min(100, (numericCustom / available) * 100)
      : 0;

  const modeHint =
    mode === "default"
      ? t("reseller.quotaDefaultHint")
      : mode === "unlimited"
        ? t("reseller.quotaUnlimitedHint")
        : t("reseller.quotaCustomHint");

  return (
    <div className="space-y-1.5 rounded-lg border border-default/80 bg-surface p-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium text-primary">{t(`reseller.limits.${limitKey}`)}</span>
        {bagUnlimited ? (
          <span className="shrink-0 text-[10px] text-accent">{t("reseller.unlimitedGroup")}</span>
        ) : available !== null ? (
          <span className="shrink-0 text-[10px] text-secondary">
            {t("reseller.availableShort", { remaining: String(available) })}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className={quotaModeButtonClass(mode === "default")}
          onClick={() => onModeChange("default")}
        >
          {t("reseller.quotaModeDefault")}
        </button>
        {bagUnlimited ? (
          <button
            type="button"
            className={quotaModeButtonClass(mode === "unlimited")}
            onClick={() => onModeChange("unlimited")}
          >
            {t("reseller.quotaModeUnlimited")}
          </button>
        ) : null}
        <button
          type="button"
          className={quotaModeButtonClass(mode === "custom")}
          onClick={() => onModeChange("custom")}
        >
          {t("reseller.quotaModeCustom")}
        </button>
      </div>

      {mode === "custom" ? (
        <>
          <input
            type="number"
            min={1}
            max={available ?? undefined}
            value={numericCustom}
            onChange={(e) => onCustomChange(Number(e.target.value))}
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
        </>
      ) : mode === "unlimited" ? (
        <Badge variant="accent">{t("reseller.unlimited")}</Badge>
      ) : null}

      <p className="text-[10px] leading-relaxed text-secondary">{modeHint}</p>
    </div>
  );
}

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

  function setLimitMode(key: BagLimitKey, mode: ServiceLimitMode) {
    const next = { ...serviceLimits };
    if (mode === "default") {
      delete next[key];
    } else if (mode === "unlimited") {
      next[key] = UNLIMITED_LIMIT_VALUE;
    } else {
      const current = next[key];
      next[key] =
        typeof current === "number" && current > 0 && current < UNLIMITED_LIMIT_VALUE / 2
          ? current
          : 1;
    }
    emit(enabledServices, next);
  }

  function setCustomLimit(key: BagLimitKey, value: number, max: number | null) {
    const capped =
      max !== null && Number.isFinite(max)
        ? Math.min(max, Math.max(1, Math.floor(value)))
        : Math.max(1, Math.floor(value));
    emit(enabledServices, {
      ...serviceLimits,
      [key]: Number.isFinite(capped) ? capped : 1,
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
                <div className="grid gap-2 border-t border-accent/15 px-3 py-3 sm:grid-cols-1">
                  {keys.map((key) => {
                    const remaining = bag?.remaining[key];
                    const current = currentLimits?.[key] ?? 0;
                    const bagUnlimited = Boolean(bag && remaining === null);
                    const available =
                      typeof remaining === "number"
                        ? remaining + (typeof current === "number" ? current : 0)
                        : null;
                    return (
                      <SubaccountLimitField
                        key={key}
                        limitKey={key}
                        serviceLimits={serviceLimits}
                        bagUnlimited={bagUnlimited}
                        available={available}
                        onModeChange={(mode) => setLimitMode(key, mode)}
                        onCustomChange={(value) => setCustomLimit(key, value, available)}
                        t={t}
                      />
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
