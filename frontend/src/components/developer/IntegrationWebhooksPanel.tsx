"use client";

import { useState, useEffect } from "react";
import {
  useIntegrationWebhook,
  useIntegrationDeliveries,
  useUpdateIntegrationWebhook,
  useTestIntegrationWebhook,
} from "@/hooks/useIntegrations";
import { useT } from "@/i18n/context";

const EVENT_OPTIONS = [
  "message.received",
  "conversation.handoff",
  "message.sent",
] as const;

export function IntegrationWebhooksPanel() {
  const t = useT();
  const { data: integration, isLoading } = useIntegrationWebhook();
  const { data: deliveriesData, isLoading: deliveriesLoading } = useIntegrationDeliveries();
  const updateMutation = useUpdateIntegrationWebhook();
  const testMutation = useTestIntegrationWebhook();

  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [events, setEvents] = useState<string[]>(["message.received"]);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (!integration) return;
    setWebhookUrl(integration.webhookUrl ?? "");
    setEnabled(integration.enabled ?? false);
    setEvents(integration.subscribedEvents?.length ? integration.subscribedEvents : ["message.received"]);
  }, [integration]);

  function toggleEvent(event: string) {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    await updateMutation.mutateAsync({
      webhookUrl,
      subscribedEvents: events,
      enabled,
      ...(webhookSecret ? { webhookSecret } : {}),
    });
    setWebhookSecret("");
    setSaved(true);
  }

  async function handleTest() {
    setTestResult(null);
    try {
      await testMutation.mutateAsync();
      setTestResult(t("integrations.testSuccess"));
    } catch (err) {
      setTestResult((err as Error).message);
    }
  }

  if (isLoading) {
    return <div className="p-6 animate-pulse h-48 bg-gray-50" />;
  }

  const deliveries = deliveriesData?.deliveries ?? [];

  return (
    <div className="p-6 space-y-8">
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("integrations.webhookUrl")}
          </label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.zapier.com/..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("integrations.webhookSecret")}
          </label>
          <input
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={integration?.webhookSecret === "***" ? "••••••••" : ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">{t("integrations.events")}</p>
          <div className="flex flex-wrap gap-3">
            {EVENT_OPTIONS.map((event) => (
              <label key={event} className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={events.includes(event)}
                  onChange={() => toggleEvent(event)}
                  className="rounded border-gray-300"
                />
                {event}
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-gray-300"
          />
          {t("integrations.enabled")}
        </label>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={updateMutation.isPending || events.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? t("auth.saving") : t("common.save")}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testMutation.isPending || !webhookUrl}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            {t("integrations.sendTest")}
          </button>
        </div>

        {saved && <p className="text-sm text-green-600">{t("integrations.saved")}</p>}
        {testResult && (
          <p className={`text-sm ${testResult === t("integrations.testSuccess") ? "text-green-600" : "text-red-600"}`}>
            {testResult}
          </p>
        )}
      </form>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">{t("integrations.payloadDoc")}</h3>
        <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto text-gray-700">
{`{
  "event": "message.received",
  "timestamp": "2026-06-06T12:00:00.000Z",
  "tenantId": "...",
  "data": {
    "botId": "...",
    "conversationId": "...",
    "from": "57300...",
    "message": "hola",
    "contact": { "name": "..." }
  }
}`}
        </pre>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{t("integrations.recentDeliveries")}</h3>
        {deliveriesLoading ? (
          <div className="animate-pulse h-24 bg-gray-50 rounded-lg" />
        ) : deliveries.length === 0 ? (
          <p className="text-sm text-gray-500">{t("integrations.noDeliveries")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-4">{t("integrations.colEvent")}</th>
                  <th className="py-2 pr-4">{t("integrations.colStatus")}</th>
                  <th className="py-2 pr-4">{t("integrations.colAttempts")}</th>
                  <th className="py-2">{t("integrations.colTime")}</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.deliveryId} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-mono text-xs">{d.event}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          d.status === "delivered"
                            ? "bg-green-100 text-green-700"
                            : d.status === "failed"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{d.attempts}</td>
                    <td className="py-2 text-gray-500 text-xs">
                      {new Date(d.createdAt).toLocaleString()}
                      {d.lastError && (
                        <span className="block text-red-500 truncate max-w-xs">{d.lastError}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
