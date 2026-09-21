"use client";

import { useState } from "react";
import Image from "next/image";
import { Trash2, Upload, User as UserIcon } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  useDeleteProfilePhoto,
  useUploadProfilePhoto,
  useUserProfile,
} from "@/hooks/useUserProfile";
import { useT } from "@/i18n/context";
import { SettingsCard, SettingsCardSkeleton } from "@/components/settings/SettingsCard";

function accountInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function ProfileSettingsCard() {
  const t = useT();
  const { user } = useCurrentUser();
  const { data: profile, isLoading } = useUserProfile();
  const uploadPhoto = useUploadProfilePhoto();
  const deletePhoto = useDeleteProfilePhoto();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const displayName = profile?.name || user?.name || user?.email || "";
  const email = profile?.email || user?.email || "";
  const photoUrl = profile?.profilePhotoUrl;

  async function handlePhotoChange(file: File | null) {
    if (!file) return;
    setError(null);
    setSaved(false);
    try {
      await uploadPhoto.mutateAsync(file);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.profilePhotoError"));
    }
  }

  async function handleRemovePhoto() {
    setError(null);
    setSaved(false);
    try {
      await deletePhoto.mutateAsync();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.profilePhotoError"));
    }
  }

  if (isLoading) {
    return <SettingsCardSkeleton lines={2} />;
  }

  return (
    <SettingsCard
      icon={<UserIcon className="h-4 w-4" />}
      title={t("settings.profilePhotoTitle")}
      description={t("settings.profilePhotoDescription")}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-muted text-xl font-semibold text-accent ring-2 ring-default">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt=""
              width={96}
              height={96}
              unoptimized
              className="h-full w-full object-cover"
              key={photoUrl}
            />
          ) : (
            accountInitials(displayName || "?")
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="text-sm font-semibold text-primary">{displayName}</p>
            {email ? <p className="text-sm text-secondary">{email}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-2 text-sm font-medium ${
                uploadPhoto.isPending
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:bg-surface-muted"
              }`}
            >
              <Upload className="h-4 w-4" />
              {uploadPhoto.isPending ? t("auth.saving") : t("settings.profilePhotoUpload")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploadPhoto.isPending}
                onChange={(e) => {
                  const input = e.currentTarget;
                  const file = input.files?.[0] ?? null;
                  input.value = "";
                  void handlePhotoChange(file);
                }}
              />
            </label>
            {photoUrl ? (
              <button
                type="button"
                onClick={() => void handleRemovePhoto()}
                disabled={deletePhoto.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {t("settings.profilePhotoRemove")}
              </button>
            ) : null}
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {saved ? <p className="text-sm text-green-600">{t("settings.profilePhotoSaved")}</p> : null}
        </div>
      </div>
    </SettingsCard>
  );
}
