"use client";

import { useEffect, useState } from "react";
import {
  useSaveTelephonySettings,
  useTelephonySettings,
  useTestVoiceAgentWebhook,
  useVoiceAgentWebhookDeliveries,
} from "@/hooks/useTelephony";
import { useT } from "@/i18n/context";
import type { IntegrationEvent } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { TableContainer } from "@/components/ui/TableContainer";
import {
  serializeVoiceAgentWebhookExample,
  VOICE_AGENT_WEBHOOK_HEADERS,
} from "@/lib/voice-agent-webhook-contract";

const EVENT_OPTIONS: IntegrationEvent[] = [
  "call.connect",
  "call.status",
  "call.terminated",
  "call.recording.ready",
  "call.cost.finalized",
];

interface VoiceAgentWebhookPanelProps {
  botId: string;
}

export function VoiceAgentWebhookPanel({ botId }: VoiceAgentWebhookPanelProps) {
  const t = useT();
  const { data: settings } = useTelephonySettings(botId);
  const { data: deliveriesData, isLoading: deliveriesLoading } = useVoiceAgentWebhookDeliveries(botId);
  const save = useSaveTelephonySettings(botId);
  const test = useTestVoiceAgentWebhook(botId);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [events, setEvents] = useState<IntegrationEvent[]>(EVENT_OPTIONS);
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState("");

  useEffect(() => {
    if (!settings) return;
    setWebhookUrl(settings.telephonyWebhookUrl ?? "");
    setEvents(settings.telephonyWebhookEvents ?? EVENT_OPTIONS);
    setEnabled(Boolean(settings.telephonyWebhookEnabled));
  }, [settings]);

  function toggleEvent(event: IntegrationEvent) {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((item) => item !== event) : [...prev, event]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setError("");
    try {
      await save.mutateAsync({
        telephonyWebhookUrl: webhookUrl,
        telephonyWebhookEnabled: enabled,
        telephonyWebhookEvents: events,
        ...(webhookSecret ? { telephonyWebhookSecret: webhookSecret } : {}),
      });
      setWebhookSecret("");
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleTest() {
    setTestResult("");
    try {
      await test.mutateAsync();
      setTestResult(t("voiceAgents.webhookTestSuccess"));
    } catch (err) {
      setTestResult((err as Error).message);
    }
  }

  const deliveries = deliveriesData?.deliveries ?? [];

  return (
    <div className="content-card space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">{t("voiceAgents.webhooksTitle")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("voiceAgents.webhooksSubtitle")}</p>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-primary">{t("voiceAgents.webhookEnabled")}</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-default"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-secondary">{t("integrations.webhookUrl")}</span>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.example.com/voice"
            className="w-full rounded-lg border border-default px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-secondary">{t("integrations.webhookSecret")}</span>
          <input
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={settings?.telephonyWebhookSecret === "***" ? "••••••••" : ""}
            className="w-full rounded-lg border border-default px-3 py-2 text-sm"
          />
        </label>

        <div>
          <p className="mb-2 text-sm font-medium text-secondary">{t("integrations.events")}</p>
          <div className="flex flex-wrap gap-3">
            {EVENT_OPTIONS.map((event) => (
              <label key={event} className="flex items-center gap-2 text-sm text-secondary">
                <input
                  type="checkbox"
                  checked={events.includes(event)}
                  onChange={() => toggleEvent(event)}
                  className="rounded border-default"
                />
                {event}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {save.isPending ? t("auth.saving") : t("common.save")}
          </button>
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={test.isPending || !webhookUrl || !enabled}
            className="rounded-lg bg-surface-muted px-4 py-2 text-sm font-medium text-secondary disabled:opacity-50"
          >
            {t("integrations.sendTest")}
          </button>
        </div>

        {saved && <p className="text-sm text-green-600">{t("integrations.saved")}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {testResult && (
          <p
            className={`text-sm ${
              testResult === t("voiceAgents.webhookTestSuccess") ? "text-green-600" : "text-red-600"
            }`}
          >
            {testResult}
          </p>
        )}
      </form>

      <div className="rounded-lg border border-default bg-surface-muted/40 p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-primary">{t("voiceAgents.webhookContractTitle")}</p>
          <p className="mt-1 text-xs text-secondary">{t("voiceAgents.webhookContractHint")}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
            {t("voiceAgents.webhookContractHeaders")}
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-default bg-surface-elevated p-3 text-xs text-primary">
            {VOICE_AGENT_WEBHOOK_HEADERS.join("\n")}
          </pre>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
            {t("voiceAgents.webhookContractPayload")}
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-default bg-surface-elevated p-3 text-xs text-primary">
            {serializeVoiceAgentWebhookExample(botId, settings?.telephonyPhoneNumber)}
          </pre>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-primary">{t("integrations.recentDeliveries")}</h3>
        {deliveriesLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-surface-muted" />
        ) : deliveries.length === 0 ? (
          <p className="text-sm text-secondary">{t("integrations.noDeliveries")}</p>
        ) : (
          <TableContainer>
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-default text-left text-secondary">
                  <th className="py-2 pr-4">{t("integrations.colEvent")}</th>
                  <th className="py-2 pr-4">{t("integrations.colStatus")}</th>
                  <th className="py-2 pr-4">{t("integrations.colAttempts")}</th>
                  <th className="py-2">{t("integrations.colTime")}</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => (
                  <tr key={delivery.deliveryId} className="border-b border-subtle">
                    <td className="py-2 pr-4 font-mono text-xs">{delivery.event}</td>
                    <td className="py-2 pr-4">
                      <Badge
                        variant={
                          delivery.status === "delivered"
                            ? "success"
                            : delivery.status === "failed"
                              ? "danger"
                              : "default"
                        }
                      >
                        {delivery.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">{delivery.attempts}</td>
                    <td className="py-2 text-xs text-secondary">
                      {new Date(delivery.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>
        )}
      </div>
    </div>
  );
}
