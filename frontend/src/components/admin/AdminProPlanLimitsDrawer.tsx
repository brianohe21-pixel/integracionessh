"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SideDrawer } from "@/components/ui/SideDrawer";
import { useT } from "@/i18n/context";
import {
  PRO_PLAN_LIMIT_KEYS,
  getAdminQuotaCatalog,
  isUnlimitedPlanLimit,
  type ProPlanLimitKey,
} from "@/lib/plan-config";
import { normalizeTenantPlan } from "@/lib/normalize-plan";
import type { ResellerLimitsOverride, Tenant } from "@/types";

function hasCustomLimits(
  override: ResellerLimitsOverride | undefined,
  catalog: Record<ProPlanLimitKey, number>
): boolean {
  if (!override) return false;
  return PRO_PLAN_LIMIT_KEYS.some((key) => {
    const value = override[key];
    return typeof value === "number" && value !== catalog[key];
  });
}

function buildFormValues(
  override: ResellerLimitsOverride | undefined,
  catalog: Record<ProPlanLimitKey, number>
): Record<ProPlanLimitKey, string> {
  const values = {} as Record<ProPlanLimitKey, string>;
  for (const key of PRO_PLAN_LIMIT_KEYS) {
    const value = override?.[key];
    const resolved = typeof value === "number" ? value : catalog[key];
    values[key] = isUnlimitedPlanLimit(resolved) ? "" : String(resolved);
  }
  return values;
}

function buildOverrideFromValues(
  values: Record<ProPlanLimitKey, string>,
  catalog: Record<ProPlanLimitKey, number>
): { override: ResellerLimitsOverride | null; error: boolean } {
  const next: ResellerLimitsOverride = {};
  let differsFromCatalog = false;

  for (const key of PRO_PLAN_LIMIT_KEYS) {
    const raw = values[key].trim();
    const catalogValue = catalog[key];
    let parsed: number;
    if (!raw) {
      if (isUnlimitedPlanLimit(catalogValue)) {
        parsed = Number.MAX_SAFE_INTEGER;
      } else {
        return { override: null, error: true };
      }
    } else {
      parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 0) {
        return { override: null, error: true };
      }
    }
    next[key] = parsed;
    if (parsed !== catalogValue) {
      differsFromCatalog = true;
    }
  }

  return { override: differsFromCatalog ? next : null, error: false };
}

function resolveTenantQuotaOverride(tenant: Tenant): ResellerLimitsOverride | undefined {
  const plan = normalizeTenantPlan(tenant.plan);
  if (plan === "reseller") {
    return tenant.resellerConfig?.limitsOverride ?? undefined;
  }
  return tenant.planLimitsOverride;
}

export function AdminProPlanLimitsDrawer({
  tenant,
  saving,
  onClose,
  onSave,
}: {
  tenant: Tenant;
  saving: boolean;
  onClose: () => void;
  onSave: (planLimitsOverride: ResellerLimitsOverride | null) => Promise<void>;
}) {
  const t = useT();
  const plan = normalizeTenantPlan(tenant.plan);
  const catalog = useMemo(() => getAdminQuotaCatalog(plan), [plan]);
  const currentOverride = resolveTenantQuotaOverride(tenant);
  const [values, setValues] = useState(() => buildFormValues(currentOverride, catalog));
  const [error, setError] = useState<string | null>(null);
  const hasCustom = useMemo(
    () => hasCustomLimits(currentOverride, catalog),
    [currentOverride, catalog]
  );
  const titleKey = plan === "reseller" ? "admin.users.resellerLimitsTitle" : "admin.users.proLimitsTitle";
  const hintKey = plan === "reseller" ? "admin.users.resellerLimitsHint" : "admin.users.proLimitsHint";

  async function handleSave() {
    const { override, error: invalid } = buildOverrideFromValues(values, catalog);
    if (invalid) {
      setError(t("admin.users.proLimitsInvalid"));
      return;
    }
    setError(null);
    try {
      await onSave(override);
    } catch {
      setError(t("admin.users.proLimitsSaveError"));
    }
  }

  async function handleReset() {
    setError(null);
    setValues(buildFormValues(undefined, catalog));
    try {
      await onSave(null);
    } catch {
      setError(t("admin.users.proLimitsSaveError"));
    }
  }

  return (
    <SideDrawer
      title={t(titleKey, { name: tenant.name })}
      onClose={onClose}
      widthClass="max-w-xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {hasCustom ? (
            <Button type="button" variant="ghost" onClick={() => void handleReset()} disabled={saving}>
              {t("admin.users.proLimitsReset")}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-5">
        <p className="text-sm text-secondary">{t(hintKey)}</p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {PRO_PLAN_LIMIT_KEYS.map((key) => {
            const catalogValue = catalog[key];
            const unlimitedCatalog = isUnlimitedPlanLimit(catalogValue);
            return (
              <label key={key} className="space-y-1 text-sm">
                <span className="text-secondary">{t(`reseller.limits.${key}`)}</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={values[key]}
                  placeholder={unlimitedCatalog ? t("admin.users.limitsUnlimitedPlaceholder") : undefined}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [key]: event.target.value }))
                  }
                  className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-primary"
                />
                <span className="block text-xs text-muted">
                  {t("admin.users.proLimitsCatalog", {
                    value: unlimitedCatalog
                      ? t("admin.users.limitsUnlimitedPlaceholder")
                      : String(catalogValue),
                  })}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </SideDrawer>
  );
}

export function tenantHasProPlanLimits(tenant: Tenant): boolean {
  const plan = normalizeTenantPlan(tenant.plan);
  const catalog = getAdminQuotaCatalog(plan);
  return hasCustomLimits(resolveTenantQuotaOverride(tenant), catalog);
}
