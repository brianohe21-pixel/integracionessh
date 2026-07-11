"use client";

import { useState, useEffect } from "react";
import { ToggleLeft, ToggleRight } from "lucide-react";
import {
  useIntegrationWebhook,
  useIntegrationDeliveries,
  useUpdateIntegrationWebhook,
  useTestIntegrationWebhook,
} from "@/hooks/useIntegrations";
import { useT } from "@/i18n/context";
import { Badge } from "@/components/ui/Badge";
import { TableContainer } from "@/components/ui/TableContainer";

const EVENT_OPTIONS = [
  "message.received",
  "conversation.handoff",
  "message.sent",
  "flow.completed",
  "lead.created",
  "lead.converted",
  "call.connect",
  "call.status",
  "call.terminated",
  "booking.created",
  "booking.cancelled",
  "payment.completed",
  "payment.failed",
] as const;

export function IntegrationWebhooksPanel() {
  const t = useT();
  const { data: integration, isLoading } = useIntegrationWebhook();
  const { data: deliveriesData, isLoading: deliveriesLoading } = useIntegrationDeliveries();
  const updateMutation = useUpdateIntegrationWebhook();
  const testMutation = useTestIntegrationWebhook();

  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [events, setEvents] = useState<string[]>(["message.received"]);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const isEnabled = integration?.enabled ?? false;
  const resolvedWebhookUrl = (integration?.webhookUrl || webhookUrl).trim();
  const resolvedEvents =
    integration?.subscribedEvents !== undefined ? integration.subscribedEvents : events;
  const canEnable = resolvedWebhookUrl.length > 0 && resolvedEvents.length > 0;

  useEffect(() => {
    if (!integration) return;
    setWebhookUrl(integration.webhookUrl ?? "");
    setEvents(
      integration.subscribedEvents !== undefined
        ? integration.subscribedEvents
        : ["message.received"]
    );
  }, [integration]);

  async function handleToggle() {
    if (!integration) return;
    setToggleError(null);
    const nextEnabled = !isEnabled;
    const url = resolvedWebhookUrl;
    const subscribedEvents = resolvedEvents;

    if (nextEnabled && !canEnable) {
      setToggleError(t("integrations.urlRequiredToEnable"));
      return;
    }

    try {
      await updateMutation.mutateAsync({
        webhookUrl: url,
        subscribedEvents,
        enabled: nextEnabled,
      });
    } catch (err) {
      setToggleError((err as Error).message);
    }
  }

  function toggleEvent(event: string) {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setSaveError(null);
    try {
      await updateMutation.mutateAsync({
        webhookUrl,
        subscribedEvents: events,
        enabled: isEnabled,
        ...(webhookSecret ? { webhookSecret } : {}),
      });
      setWebhookSecret("");
      setSaved(true);
    } catch (err) {
      setSaveError((err as Error).message);
    }
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
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <p className="text-sm font-medium text-gray-900">{t("integrations.enabled")}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t("integrations.toggleHint")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={isEnabled ? "success" : "default"}>
            {isEnabled ? t("common.active") : t("common.inactive")}
          </Badge>
          <button
            type="button"
            onClick={() => void handleToggle()}
            disabled={updateMutation.isPending || (!isEnabled && !canEnable)}
            title={isEnabled ? t("integrations.toggleDisable") : t("integrations.toggleEnable")}
            className="text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-40"
          >
            {isEnabled ? (
              <ToggleRight className="w-8 h-8 text-indigo-500" />
            ) : (
              <ToggleLeft className="w-8 h-8" />
            )}
          </button>
        </div>
      </div>
      {toggleError && <p className="text-sm text-red-600 -mt-4">{toggleError}</p>}

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
            required={isEnabled}
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

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={updateMutation.isPending || (isEnabled && events.length === 0)}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? t("auth.saving") : t("common.save")}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testMutation.isPending || !webhookUrl || !isEnabled}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            {t("integrations.sendTest")}
          </button>
        </div>

        {saved && <p className="text-sm text-green-600">{t("integrations.saved")}</p>}
        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        {testResult && (
          <p className={`text-sm ${testResult === t("integrations.testSuccess") ? "text-green-600" : "text-red-600"}`}>
            {testResult}
          </p>
        )}
      </form>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">{t("integrations.payloadDoc")}</h3>
        <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto text-gray-700">
{`// message.received
{
  "event": "message.received",
  "data": { "botId", "conversationId", "from", "message", "contact": { "name" } }
}

// lead.created
{
  "event": "lead.created",
  "data": { "botId", "leadId", "phone", "metaFlowId", "name", "email" }
}

// lead.converted
{
  "event": "lead.converted",
  "data": { "botId", "leadId", "phone", "contact": { "phone", "name", "email", "tags" } }
}

// flow.completed
{
  "event": "flow.completed",
  "data": { "botId", "phone", "metaFlowId", "response": { "name", "email" } }
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
          <TableContainer>
            <table className="w-full min-w-[480px] text-sm">
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
          </TableContainer>
        )}
      </div>
    </div>
  );
}
