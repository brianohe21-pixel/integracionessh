"use client";

import { useState } from "react";
import { useT } from "@/i18n/context";
import type { ShortLinkUtm } from "@/types";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/FieldLabel";

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
          <FieldLabel
            label="utm_source"
            tooltip={t("shortLinks.utmSourceTooltip")}
            htmlFor="short-link-utm-source"
            className="text-xs"
          />
          <input
            id="short-link-utm-source"
            value={utmSource}
            onChange={(event) => setUtmSource(event.target.value)}
            placeholder={t("shortLinks.utmSourcePlaceholder")}
            className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <FieldLabel
            label="utm_medium"
            tooltip={t("shortLinks.utmMediumTooltip")}
            htmlFor="short-link-utm-medium"
            className="text-xs"
          />
          <input
            id="short-link-utm-medium"
            value={utmMedium}
            onChange={(event) => setUtmMedium(event.target.value)}
            placeholder={t("shortLinks.utmMediumPlaceholder")}
            className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <FieldLabel
            label="utm_campaign"
            tooltip={t("shortLinks.utmCampaignTooltip")}
            htmlFor="short-link-utm-campaign"
            className="text-xs"
          />
          <input
            id="short-link-utm-campaign"
            value={utmCampaign}
            onChange={(event) => setUtmCampaign(event.target.value)}
            placeholder={t("shortLinks.utmCampaignPlaceholder")}
            className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <FieldLabel
            label="utm_content"
            tooltip={t("shortLinks.utmContentTooltip")}
            htmlFor="short-link-utm-content"
            className="text-xs"
          />
          <input
            id="short-link-utm-content"
            value={utmContent}
            onChange={(event) => setUtmContent(event.target.value)}
            placeholder={t("shortLinks.utmContentPlaceholder")}
            className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <FieldLabel
            label="utm_term"
            tooltip={t("shortLinks.utmTermTooltip")}
            htmlFor="short-link-utm-term"
            className="text-xs"
            tooltipSide="top"
          />
          <input
            id="short-link-utm-term"
            value={utmTerm}
            onChange={(event) => setUtmTerm(event.target.value)}
            placeholder={t("shortLinks.utmTermPlaceholder")}
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
