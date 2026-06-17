"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Palette, Upload, Trash2 } from "lucide-react";
import { useT } from "@/i18n/context";
import {
  useTenantBranding,
  useUpdateTenantBranding,
  useUploadTenantLogo,
  useDeleteTenantLogo,
} from "@/hooks/useTenantBranding";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/brand-colors";

export function BrandingSettingsCard() {
  const t = useT();
  const { data, isLoading } = useTenantBranding();
  const updateBranding = useUpdateTenantBranding();
  const uploadLogo = useUploadTenantLogo();
  const deleteLogo = useDeleteTenantLogo();

  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setBrandName(data.brandName);
    setPrimaryColor(data.primaryColor);
  }, [data]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  const canCustomize = data?.canCustomize ?? false;

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
    try {
      await uploadLogo.mutateAsync(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.brandingLogoError"));
    }
  }

  async function handleRemoveLogo() {
    setError(null);
    try {
      await deleteLogo.mutateAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.brandingLogoError"));
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-2">
        <Palette className="w-4 h-4 text-gray-500" />
        <h2 className="font-semibold text-gray-900 text-sm">{t("settings.brandingTitle")}</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">{t("settings.brandingDescription")}</p>

      {!canCustomize && (
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
          <img src={data.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover bg-white/20" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-sm font-bold">
            {brandName.slice(0, 1).toUpperCase() || "?"}
          </div>
        )}
        <span className="font-semibold">{brandName || t("settings.brandingPreviewFallback")}</span>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("settings.brandingName")}
          </label>
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            disabled={!canCustomize}
            maxLength={128}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("settings.brandingColor")}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              disabled={!canCustomize}
              className="h-10 w-14 cursor-pointer rounded border border-gray-200 disabled:cursor-not-allowed"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              disabled={!canCustomize}
              pattern="^#[0-9A-Fa-f]{6}$"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono disabled:bg-gray-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("settings.brandingLogo")}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium ${
                canCustomize ? "cursor-pointer hover:bg-gray-50" : "cursor-not-allowed opacity-50"
              }`}
            >
              <Upload className="w-4 h-4" />
              {t("settings.brandingLogoUpload")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                disabled={!canCustomize || uploadLogo.isPending}
                onChange={(e) => void handleLogoChange(e.target.files?.[0] ?? null)}
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
        {saved && <p className="text-sm text-green-600">{t("settings.brandingSaved")}</p>}

        {canCustomize && (
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={updateBranding.isPending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-primary, #4f46e5)" }}
          >
            {updateBranding.isPending ? t("auth.saving") : t("settings.brandingSave")}
          </button>
        )}
      </div>
    </div>
  );
}
