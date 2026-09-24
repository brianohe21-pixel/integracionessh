"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SideDrawer } from "@/components/ui/SideDrawer";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { Tenant, TenantPlan } from "@/types";

const PLAN_OPTIONS: TenantPlan[] = ["free", "starter", "pro", "reseller"];

function planLabel(
  plan: TenantPlan,
  t: (key: string) => string
): string {
  if (plan === "starter") return t("common.planStarter");
  if (plan === "pro") return t("common.planPro");
  if (plan === "reseller") return t("common.planReseller");
  return t("common.planFree");
}

export function AdminTenantPlanDrawer({
  tenant,
  saving,
  onClose,
  onSave,
}: {
  tenant: Tenant;
  saving: boolean;
  onClose: () => void;
  onSave: (plan: TenantPlan) => Promise<void>;
}) {
  const t = useT();
  const [plan, setPlan] = useState<TenantPlan>(tenant.plan);
  const [error, setError] = useState<string | null>(null);
  const dirty = plan !== tenant.plan;

  async function handleSave() {
    if (!dirty) {
      onClose();
      return;
    }
    setError(null);
    try {
      await onSave(plan);
    } catch {
      setError(t("admin.users.planUpdateError"));
    }
  }

  return (
    <SideDrawer
      title={t("admin.users.planDrawerTitle", { name: tenant.name })}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving || !dirty}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-5">
        <p className="text-sm text-secondary">{t("admin.users.planDrawerHint")}</p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="space-y-2">
          {PLAN_OPTIONS.map((option) => {
            const selected = plan === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setPlan(option)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                  selected
                    ? "border-accent bg-accent-muted text-accent"
                    : "border-default bg-surface text-primary hover:border-accent/40"
                )}
              >
                <span className="flex-1 text-sm font-medium">{planLabel(option, t)}</span>
                {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </SideDrawer>
  );
}

export function AdminTenantStatusDrawer({
  tenant,
  saving,
  onClose,
  onSave,
}: {
  tenant: Tenant;
  saving: boolean;
  onClose: () => void;
  onSave: (status: "active" | "suspended") => Promise<void>;
}) {
  const t = useT();
  const [status, setStatus] = useState<"active" | "suspended">(
    tenant.status === "suspended" ? "suspended" : "active"
  );
  const [error, setError] = useState<string | null>(null);
  const current = tenant.status === "suspended" ? "suspended" : "active";
  const dirty = status !== current;

  async function handleSave() {
    if (!dirty) {
      onClose();
      return;
    }
    setError(null);
    try {
      await onSave(status);
    } catch {
      setError(t("admin.users.statusUpdateError"));
    }
  }

  return (
    <SideDrawer
      title={t("admin.users.statusDrawerTitle", { name: tenant.name })}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving || !dirty}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-5">
        <p className="text-sm text-secondary">{t("admin.users.statusDrawerHint")}</p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="space-y-2">
          {(
            [
              { value: "active" as const, label: t("common.active") },
              { value: "suspended" as const, label: t("common.suspended") },
            ] as const
          ).map((option) => {
            const selected = status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                  selected
                    ? "border-accent bg-accent-muted text-accent"
                    : "border-default bg-surface text-primary hover:border-accent/40"
                )}
              >
                <span className="flex-1 text-sm font-medium">{option.label}</span>
                {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </SideDrawer>
  );
}

export function AdminTenantLaw2300Drawer({
  tenant,
  saving,
  onClose,
  onSave,
}: {
  tenant: Tenant;
  saving: boolean;
  onClose: () => void;
  onSave: (law2300Exempt: boolean) => Promise<void>;
}) {
  const t = useT();
  const [exempt, setExempt] = useState(Boolean(tenant.law2300Exempt));
  const [error, setError] = useState<string | null>(null);
  const dirty = exempt !== Boolean(tenant.law2300Exempt);

  async function handleSave() {
    if (!dirty) {
      onClose();
      return;
    }
    setError(null);
    try {
      await onSave(exempt);
    } catch {
      setError(t("admin.users.law2300UpdateError"));
    }
  }

  return (
    <SideDrawer
      title={t("admin.users.law2300DrawerTitle", { name: tenant.name })}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving || !dirty}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-5">
        <p className="text-sm text-secondary">{t("admin.users.law2300DrawerHint")}</p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="space-y-2">
          {(
            [
              { value: false, label: t("admin.users.law2300Applies") },
              { value: true, label: t("admin.users.law2300Exempt") },
            ] as const
          ).map((option) => {
            const selected = exempt === option.value;
            return (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => setExempt(option.value)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                  selected
                    ? "border-accent bg-accent-muted text-accent"
                    : "border-default bg-surface text-primary hover:border-accent/40"
                )}
              >
                <span className="flex-1 text-sm font-medium">{option.label}</span>
                {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </SideDrawer>
  );
}
