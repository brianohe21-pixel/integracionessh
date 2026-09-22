"use client";

import { useEffect, useState } from "react";
import { Building2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useFormatters } from "@/hooks/useFormatters";
import { useTenant, useUpdateTenant } from "@/hooks/useTenant";
import { useT } from "@/i18n/context";
import {
  SettingsCard,
  SettingsCardSkeleton,
  SettingsInfoGrid,
  SettingsInfoTile,
} from "@/components/settings/SettingsCard";

export function CompanySettingsCard() {
  const t = useT();
  const { formatDate, planLabel } = useFormatters();
  const { data: tenant, isLoading } = useTenant();
  const updateTenant = useUpdateTenant();
  const [editing, setEditing] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setCompanyName(tenant.name ?? "");
  }, [tenant]);

  function startEditing() {
    setCompanyName(tenant?.name ?? "");
    setError("");
    setSaved(false);
    setEditing(true);
  }

  function cancelEditing() {
    setCompanyName(tenant?.name ?? "");
    setError("");
    setEditing(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);

    const trimmed = companyName.trim();
    if (!trimmed) {
      setError(t("settings.companyNameRequired"));
      return;
    }

    if (trimmed === tenant?.name) {
      setEditing(false);
      return;
    }

    try {
      await updateTenant.mutateAsync({ name: trimmed });
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.companySaveError"));
    }
  }

  if (isLoading) {
    return <SettingsCardSkeleton lines={3} />;
  }

  if (!tenant) {
    return null;
  }

  const dirty = companyName.trim() !== tenant.name;

  return (
    <SettingsCard icon={<Building2 className="h-4 w-4" />} title={t("settings.accountInfo")}>
      <div className="space-y-5">
        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-secondary">{t("settings.company")}</span>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={t("auth.companyPlaceholder")}
                maxLength={128}
                required
                autoFocus
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={!dirty || updateTenant.isPending}>
                {updateTenant.isPending ? t("common.loading") : t("common.save")}
              </Button>
              <Button type="button" variant="secondary" onClick={cancelEditing} disabled={updateTenant.isPending}>
                {t("common.cancel")}
              </Button>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </form>
        ) : (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-subtle bg-surface px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-secondary">{t("settings.company")}</p>
              <p className="mt-1 text-sm font-medium text-primary">{tenant.name}</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={startEditing}>
              <Pencil className="h-3.5 w-3.5" />
              {t("common.edit")}
            </Button>
          </div>
        )}

        {saved ? <p className="text-sm text-green-700">{t("settings.companySaved")}</p> : null}

        <SettingsInfoGrid>
          <SettingsInfoTile
            label={t("common.email")}
            value={<span className="truncate">{tenant.email}</span>}
          />
          <SettingsInfoTile
            label={t("settings.plan")}
            value={<Badge variant="info">{planLabel(tenant.plan)}</Badge>}
          />
          <SettingsInfoTile
            label={t("common.status")}
            value={
              <Badge variant={tenant.status === "active" ? "success" : "warning"}>
                {tenant.status === "active" ? t("common.active") : t("common.suspended")}
              </Badge>
            }
          />
          <SettingsInfoTile
            className="sm:col-span-2"
            label={t("settings.memberSince")}
            value={formatDate(tenant.createdAt)}
          />
        </SettingsInfoGrid>
      </div>
    </SettingsCard>
  );
}
