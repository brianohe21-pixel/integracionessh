"use client";

import { useState } from "react";
import { Monitor } from "lucide-react";
import { useT } from "@/i18n/context";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/brand-colors";
import type { ResolvedTenantBranding } from "@/types";

interface WebchatWidgetPreviewProps {
  branding?: ResolvedTenantBranding;
  brandNameFallback?: string;
}

export function WebchatWidgetPreview({
  branding,
  brandNameFallback,
}: WebchatWidgetPreviewProps) {
  const t = useT();
  const [open, setOpen] = useState(true);

  const brandName = branding?.brandName?.trim() || brandNameFallback || t("webchat.previewBrandFallback");
  const primaryColor = branding?.primaryColor || DEFAULT_PRIMARY_COLOR;
  const logoUrl = branding?.logoUrl;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-secondary">{t("webchat.previewHint")}</p>
        <div className="inline-flex rounded-lg border border-default p-0.5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={`rounded-md px-3 py-1 text-xs font-medium ${
              !open ? "bg-accent text-white" : "text-secondary hover:text-primary"
            }`}
          >
            {t("webchat.previewClosed")}
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`rounded-md px-3 py-1 text-xs font-medium ${
              open ? "bg-accent text-white" : "text-secondary hover:text-primary"
            }`}
          >
            {t("webchat.previewOpen")}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-default bg-surface">
        <div className="flex items-center gap-2 border-b border-default bg-surface-muted px-4 py-2">
          <Monitor className="h-4 w-4 text-secondary" />
          <span className="text-xs text-secondary">{t("webchat.previewSiteLabel")}</span>
        </div>

        <div className="relative min-h-[420px] bg-gradient-to-br from-slate-100 to-slate-200 p-6 dark:from-slate-900 dark:to-slate-800">
          <div className="max-w-md space-y-3 opacity-60">
            <div className="h-4 w-40 rounded bg-slate-300 dark:bg-slate-700" />
            <div className="h-3 w-full rounded bg-slate-300/80 dark:bg-slate-700/80" />
            <div className="h-3 w-5/6 rounded bg-slate-300/80 dark:bg-slate-700/80" />
            <div className="h-3 w-2/3 rounded bg-slate-300/80 dark:bg-slate-700/80" />
          </div>

          <div className="absolute bottom-5 right-5 flex flex-col items-end gap-2">
            {open ? (
              <div className="flex h-[360px] w-[300px] flex-col overflow-hidden rounded-xl border border-default bg-white shadow-2xl">
                <div
                  className="flex items-center gap-2 px-3.5 py-3 text-sm font-semibold text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt=""
                      className="h-6 w-6 rounded-md object-cover"
                    />
                  ) : null}
                  <span>{brandName}</span>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
                  <div className="ml-auto max-w-[85%] rounded-xl px-3 py-2 text-xs text-white" style={{ backgroundColor: primaryColor }}>
                    {t("webchat.previewUserMessage")}
                  </div>
                  <div className="max-w-[85%] rounded-xl border border-default bg-white px-3 py-2 text-xs text-primary">
                    {t("webchat.previewBotMessage")}
                  </div>
                </div>

                <div className="flex gap-2 border-t border-default p-2">
                  <div className="flex-1 rounded-lg border border-default px-2 py-1.5 text-xs text-secondary">
                    {t("webchat.previewInputPlaceholder")}
                  </div>
                  <div
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {t("webchat.previewSend")}
                  </div>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className="rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-lg"
              style={{
                backgroundColor: primaryColor,
                boxShadow: `0 4px 14px ${primaryColor}66`,
              }}
            >
              {brandName}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
