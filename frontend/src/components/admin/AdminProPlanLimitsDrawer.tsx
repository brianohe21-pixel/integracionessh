"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SideDrawer } from "@/components/ui/SideDrawer";
import { useT } from "@/i18n/context";
import {
  PRO_PLAN_CATALOG_LIMITS,
  PRO_PLAN_LIMIT_KEYS,
  type ProPlanLimitKey,
} from "@/lib/plan-config";
import type { ResellerLimitsOverride, Tenant } from "@/types";

function hasCustomLimits(override: ResellerLimitsOverride | undefined): boolean {
  if (!override) return false;
  return PRO_PLAN_LIMIT_KEYS.some((key) => typeof override[key] === "number");
}

function buildFormValues(
  override: ResellerLimitsOverride | undefined
): Record<ProPlanLimitKey, string> {
  const values = {} as Record<ProPlanLimitKey, string>;
  for (const key of PRO_PLAN_LIMIT_KEYS) {
    const value = override?.[key];
    values[key] =
      typeof value === "number" ? String(value) : String(PRO_PLAN_CATALOG_LIMITS[key]);
  }
  return values;
}

function buildOverrideFromValues(
  values: Record<ProPlanLimitKey, string>
): { override: ResellerLimitsOverride | null; error: boolean } {
  const next: ResellerLimitsOverride = {};
  let differsFromCatalog = false;

  for (const key of PRO_PLAN_LIMIT_KEYS) {
    const raw = values[key].trim();
    if (!raw) {
      return { override: null, error: true };
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return { override: null, error: true };
    }
    next[key] = parsed;
    if (parsed !== PRO_PLAN_CATALOG_LIMITS[key]) {
      differsFromCatalog = true;
    }
  }

  return { override: differsFromCatalog ? next : null, error: false };
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
  const [values, setValues] = useState(() => buildFormValues(tenant.planLimitsOverride));
  const [error, setError] = useState<string | null>(null);
  const hasCustom = useMemo(
    () => hasCustomLimits(tenant.planLimitsOverride),
    [tenant.planLimitsOverride]
  );

  async function handleSave() {
    const { override, error: invalid } = buildOverrideFromValues(values);
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
    setValues(buildFormValues(undefined));
    try {
      await onSave(null);
    } catch {
      setError(t("admin.users.proLimitsSaveError"));
    }
  }

  return (
    <SideDrawer
      title={t("admin.users.proLimitsTitle", { name: tenant.name })}
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
        <p className="text-sm text-secondary">{t("admin.users.proLimitsHint")}</p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {PRO_PLAN_LIMIT_KEYS.map((key) => (
            <label key={key} className="space-y-1 text-sm">
              <span className="text-secondary">{t(`reseller.limits.${key}`)}</span>
              <input
                type="number"
                min={0}
                step={1}
                value={values[key]}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [key]: event.target.value }))
                }
                className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-primary"
              />
            </label>
          ))}
        </div>
      </div>
    </SideDrawer>
  );
}

export function tenantHasProPlanLimits(tenant: Tenant): boolean {
  return hasCustomLimits(tenant.planLimitsOverride);
}
