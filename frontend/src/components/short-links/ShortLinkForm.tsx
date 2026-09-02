"use client";

import { useState } from "react";
import { useT } from "@/i18n/context";
import type { ShortLinkUtm } from "@/types";
import { Button } from "@/components/ui/Button";

interface ShortLinkFormProps {
  initial?: {
    name?: string;
    destinationUrl?: string;
    slug?: string;
    enabled?: boolean;
    utm?: ShortLinkUtm;
  };
  submitLabel: string;
  pending?: boolean;
  onSubmit: (values: {
    name: string;
    destinationUrl: string;
    slug?: string;
    enabled: boolean;
    utm: ShortLinkUtm;
  }) => Promise<void>;
  onCancel: () => void;
}

export function ShortLinkForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: ShortLinkFormProps) {
  const t = useT();
  const [name, setName] = useState(initial?.name ?? "");
  const [destinationUrl, setDestinationUrl] = useState(initial?.destinationUrl ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [utmSource, setUtmSource] = useState(initial?.utm?.utmSource ?? "");
  const [utmMedium, setUtmMedium] = useState(initial?.utm?.utmMedium ?? "");
  const [utmCampaign, setUtmCampaign] = useState(initial?.utm?.utmCampaign ?? "");
  const [utmContent, setUtmContent] = useState(initial?.utm?.utmContent ?? "");
  const [utmTerm, setUtmTerm] = useState(initial?.utm?.utmTerm ?? "");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const utm: ShortLinkUtm = {};
      if (utmSource.trim()) utm.utmSource = utmSource.trim();
      if (utmMedium.trim()) utm.utmMedium = utmMedium.trim();
      if (utmCampaign.trim()) utm.utmCampaign = utmCampaign.trim();
      if (utmContent.trim()) utm.utmContent = utmContent.trim();
      if (utmTerm.trim()) utm.utmTerm = utmTerm.trim();

      await onSubmit({
        name: name.trim(),
        destinationUrl: destinationUrl.trim(),
        ...(slug.trim() ? { slug: slug.trim() } : {}),
        enabled,
        utm,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("shortLinks.saveError"));
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-secondary">{t("shortLinks.colName")}</span>
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-secondary">{t("shortLinks.destination")}</span>
        <input
          required
          type="url"
          value={destinationUrl}
          onChange={(event) => setDestinationUrl(event.target.value)}
          placeholder="https://"
          className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-secondary">{t("shortLinks.slug")}</span>
        <input
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder={t("shortLinks.slugPlaceholder")}
          className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-secondary">utm_source</span>
          <input
            value={utmSource}
            onChange={(event) => setUtmSource(event.target.value)}
            className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-secondary">utm_medium</span>
          <input
            value={utmMedium}
            onChange={(event) => setUtmMedium(event.target.value)}
            className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-secondary">utm_campaign</span>
          <input
            value={utmCampaign}
            onChange={(event) => setUtmCampaign(event.target.value)}
            className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-secondary">utm_content</span>
          <input
            value={utmContent}
            onChange={(event) => setUtmContent(event.target.value)}
            className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-xs font-medium text-secondary">utm_term</span>
          <input
            value={utmTerm}
            onChange={(event) => setUtmTerm(event.target.value)}
            className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-secondary">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        {t("shortLinks.enabled")}
      </label>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
