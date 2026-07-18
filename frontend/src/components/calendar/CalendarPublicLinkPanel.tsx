"use client";

import { useState } from "react";
import { useT } from "@/i18n/context";
import {
  useCalendarPublicLink,
  useDisablePublicLink,
  useEnablePublicLink,
  useRotatePublicLink,
} from "@/hooks/useCalendar";

interface CalendarPublicLinkPanelProps {
  botId: string;
  calendarEnabled: boolean;
}

export function CalendarPublicLinkPanel({
  botId,
  calendarEnabled,
}: CalendarPublicLinkPanelProps) {
  const t = useT();
  const { data, isLoading } = useCalendarPublicLink(botId);
  const enable = useEnablePublicLink(botId);
  const disable = useDisablePublicLink(botId);
  const rotate = useRotatePublicLink(botId);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const publicUrl =
    data?.publicUrl ??
    (data?.calendarPublicKey && typeof window !== "undefined"
      ? `${window.location.origin}/book/${data.calendarPublicKey}`
      : "");

  async function handleCopy() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleToggle() {
    setError("");
    try {
      if (data?.publicLinkEnabled) {
        await disable.mutateAsync();
      } else {
        await enable.mutateAsync();
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleRotate() {
    if (!window.confirm(t("calendar.publicLink.rotateConfirm"))) return;
    setError("");
    try {
      await rotate.mutateAsync();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!calendarEnabled) {
    return (
      <section className="rounded-xl border border-default bg-surface-elevated p-6">
        <h3 className="font-semibold text-primary">{t("calendar.publicLink.title")}</h3>
        <p className="mt-2 text-sm text-secondary">{t("calendar.publicLink.disabledHint")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-default bg-surface-elevated p-6">
      <h3 className="font-semibold text-primary">{t("calendar.publicLink.title")}</h3>
      <p className="mt-1 text-sm text-secondary">{t("calendar.publicLink.subtitle")}</p>

      {isLoading ? (
        <div className="mt-4 h-10 animate-pulse rounded-lg bg-surface-muted" />
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleToggle()}
              disabled={enable.isPending || disable.isPending}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
                data?.publicLinkEnabled
                  ? "bg-gray-600 hover:bg-gray-700"
                  : "bg-accent hover:bg-accent-hover"
              }`}
            >
              {data?.publicLinkEnabled
                ? t("calendar.publicLink.disable")
                : t("calendar.publicLink.enable")}
            </button>
            {data?.publicLinkEnabled && publicUrl ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="rounded-lg border border-accent/30 px-4 py-2 text-sm font-medium text-accent hover:bg-accent-muted"
                >
                  {copied ? t("calendar.publicLink.copied") : t("calendar.publicLink.copy")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRotate()}
                  disabled={rotate.isPending}
                  className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-secondary hover:bg-surface"
                >
                  {t("calendar.publicLink.rotate")}
                </button>
              </>
            ) : null}
          </div>

          {data?.publicLinkEnabled && publicUrl ? (
            <input
              type="text"
              readOnly
              value={publicUrl}
              className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-secondary"
            />
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      )}
    </section>
  );
}
