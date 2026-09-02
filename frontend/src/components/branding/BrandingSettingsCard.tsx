"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Palette, Upload, Trash2, RotateCcw } from "lucide-react";
import { useT } from "@/i18n/context";
import { useAuthSession } from "@/hooks/useAuthSession";
import { api } from "@/lib/api";
import {
  useTenantBranding,
  useUpdateTenantBranding,
  useUploadTenantLogo,
  useDeleteTenantLogo,
  useResetTenantBranding,
} from "@/hooks/useTenantBranding";
import { useDialog } from "@/components/ui/DialogProvider";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/brand-colors";
import type { Tenant } from "@/types";

function planAllowsBranding(plan: string | undefined): boolean {
  return plan === "scale" || plan === "enterprise" || plan === "reseller";
}

export function BrandingSettingsCard() {
  const t = useT();
  const { isAuthenticated, loading: authLoading } = useAuthSession();
  const brandingEnabled = isAuthenticated && !authLoading;
  const { data: tenant } = useQuery({
    queryKey: ["tenants", "me"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
    enabled: brandingEnabled,
  });
  const { data, isLoading, isError, error: queryError } = useTenantBranding(brandingEnabled);
  const updateBranding = useUpdateTenantBranding();
  const uploadLogo = useUploadTenantLogo();
  const deleteLogo = useDeleteTenantLogo();
  const resetBranding = useResetTenantBranding();
  const { confirm } = useDialog();

  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [logoSaved, setLogoSaved] = useState(false);
  const [resetSaved, setResetSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setBrandName(data.brandName ?? "");
    setPrimaryColor(data.primaryColor ?? DEFAULT_PRIMARY_COLOR);
  }, [data]);

  if (isLoading) {
    return (
      <div className="bg-surface-elevated rounded-xl border border-default p-6">
        <div className="h-24 bg-surface-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  const canCustomize =
    data?.canCustomize === true || planAllowsBranding(tenant?.plan);

  const hasCustomBranding = Boolean(
    tenant?.branding?.brandName ||
      tenant?.branding?.primaryColor ||
      tenant?.branding?.logoS3Key
  );

  async function handleSave() {
    setError(null);
    setSaved(false);
    try {
      await updateBranding.mutateAsync({
        brandName: brandName.trim() || undefined,
        primaryColor,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.brandingSaveError"));
    }
  }

  async function handleLogoChange(file: File | null) {
    if (!file) return;
    setError(null);
    setLogoSaved(false);
    try {
      await uploadLogo.mutateAsync(file);
      setLogoSaved(true);
      setTimeout(() => setLogoSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.brandingLogoError"));
    }
  }

  async function handleRemoveLogo() {
    setError(null);
    setLogoSaved(false);
    try {
      await deleteLogo.mutateAsync();
      setLogoSaved(true);
      setTimeout(() => setLogoSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.brandingLogoError"));
    }
  }

  async function handleResetBranding() {
    const confirmed = await confirm({
      title: t("settings.brandingReset"),
      description: t("settings.brandingResetConfirm"),
      confirmLabel: t("settings.brandingReset"),
      tone: "warning",
    });
    if (!confirmed) return;
    setError(null);
    setSaved(false);
    setLogoSaved(false);
    setResetSaved(false);
    try {
      const result = await resetBranding.mutateAsync();
      setBrandName(result.brandName ?? tenant?.name ?? "");
      setPrimaryColor(result.primaryColor ?? DEFAULT_PRIMARY_COLOR);
      setResetSaved(true);
      setTimeout(() => setResetSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.brandingResetError"));
    }
  }

  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-6">
      <div className="flex items-center gap-2 mb-2">
        <Palette className="w-4 h-4 text-secondary" />
        <h2 className="font-semibold text-primary text-sm">{t("settings.brandingTitle")}</h2>
      </div>
      <p className="text-sm text-secondary mb-4">{t("settings.brandingDescription")}</p>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {queryError instanceof Error ? queryError.message : t("settings.brandingSaveError")}
        </div>
      )}

      {!canCustomize && !isError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("settings.brandingUpgrade")}{" "}
          <Link href="/billing" className="font-medium underline">
            {t("settings.brandingUpgradeLink")}
          </Link>
        </div>
      )}

      <div
        className="mb-4 flex items-center gap-3 rounded-lg px-4 py-3 text-white"
        style={{ backgroundColor: primaryColor }}
      >
        {data?.logoUrl ? (
          <Image
            key={data.logoUrl}
            src={data.logoUrl}
            alt=""
            width={32}
            height={32}
            unoptimized
            className="h-8 w-8 rounded-lg object-cover bg-surface-elevated/20"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-elevated/20 text-sm font-bold">
            {(brandName.trim().charAt(0) || "?").toUpperCase()}
          </div>
        )}
        <span className="font-semibold">{brandName || t("settings.brandingPreviewFallback")}</span>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">
            {t("settings.brandingName")}
          </label>
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            disabled={!canCustomize}
            maxLength={128}
            className="w-full rounded-lg border border-default px-3 py-2 text-sm disabled:bg-surface"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-1">
            {t("settings.brandingColor")}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              disabled={!canCustomize}
              className="h-10 w-14 cursor-pointer rounded border border-default disabled:cursor-not-allowed"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              disabled={!canCustomize}
              pattern="^#[0-9A-Fa-f]{6}$"
              className="flex-1 rounded-lg border border-default px-3 py-2 text-sm font-mono disabled:bg-surface"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-1">
            {t("settings.brandingLogo")}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-2 text-sm font-medium ${
                canCustomize && !uploadLogo.isPending
                  ? "cursor-pointer hover:bg-surface"
                  : "cursor-not-allowed opacity-50"
              }`}
            >
              <Upload className="w-4 h-4" />
              {uploadLogo.isPending
                ? t("auth.saving")
                : t("settings.brandingLogoUpload")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                disabled={!canCustomize || uploadLogo.isPending}
                onChange={(e) => {
                  const input = e.currentTarget;
                  const file = input.files?.[0] ?? null;
                  input.value = "";
                  void handleLogoChange(file);
                }}
              />
            </label>
            {data?.logoUrl && canCustomize && (
              <button
                type="button"
                onClick={() => void handleRemoveLogo()}
                disabled={deleteLogo.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                {t("settings.brandingLogoRemove")}
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {logoSaved && <p className="text-sm text-green-600">{t("settings.brandingLogoSaved")}</p>}
        {saved && <p className="text-sm text-green-600">{t("settings.brandingSaved")}</p>}
        {resetSaved && <p className="text-sm text-green-600">{t("settings.brandingResetSaved")}</p>}

        {canCustomize && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={updateBranding.isPending || resetBranding.isPending}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-primary, #128C7E)" }}
            >
              {updateBranding.isPending ? t("auth.saving") : t("settings.brandingSave")}
            </button>
            <button
              type="button"
              onClick={() => void handleResetBranding()}
              disabled={!hasCustomBranding || resetBranding.isPending || updateBranding.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-default px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              {resetBranding.isPending ? t("auth.saving") : t("settings.brandingReset")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
