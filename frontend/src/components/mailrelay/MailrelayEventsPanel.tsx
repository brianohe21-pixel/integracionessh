"use client";

import { Activity } from "lucide-react";
import { useMailrelayEvents } from "@/hooks/useMailrelay";
import { useT } from "@/i18n/context";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

function eventTone(type: string): "success" | "info" | "danger" | "default" {
  const normalized = type.toLowerCase();
  if (normalized.includes("unsubscribe") || normalized.includes("bounce") || normalized.includes("complaint")) {
    return "danger";
  }
  if (normalized.includes("click")) return "info";
  if (normalized.includes("open") || normalized.includes("impression") || normalized.includes("deliver")) {
    return "success";
  }
  return "default";
}

export function MailrelayEventsPanel({
  connected,
  campaignId,
}: {
  connected: boolean;
  campaignId?: string;
}) {
  const t = useT();
  const eventsQuery = useMailrelayEvents(connected, {
    ...(campaignId ? { campaignId } : {}),
    limit: 50,
  });

  if (!connected) return null;
  if (eventsQuery.isLoading) return <Skeleton className="h-48 w-full" />;

  const events = eventsQuery.data?.events ?? [];

  return (
    <Card padding="lg" className="space-y-4">
      <div>
        <h2 className="font-semibold text-primary">{t("mailrelay.events.title")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("mailrelay.events.description")}</p>
      </div>
      {events.length === 0 ? (
        <EmptyState
          icon={<Activity className="h-6 w-6" />}
          title={t("mailrelay.events.empty")}
          description={t("mailrelay.events.emptyDescription")}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">{t("mailrelay.events.date")}</th>
                <th className="px-3 py-2">{t("mailrelay.events.type")}</th>
                <th className="px-3 py-2">{t("mailrelay.events.email")}</th>
                <th className="px-3 py-2">{t("mailrelay.events.campaign")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {events.map((event) => (
                <tr key={event.eventId}>
                  <td className="px-3 py-3 text-primary">
                    {new Date(event.occurredAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={eventTone(event.type)}>{event.type}</Badge>
                  </td>
                  <td className="px-3 py-3 text-secondary">{event.email ?? "—"}</td>
                  <td className="px-3 py-3 text-secondary">
                    {event.campaignId ? `#${event.campaignId}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
