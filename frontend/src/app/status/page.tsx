"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, Phone, RefreshCw, Server } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import {
  buildApiOutageStatus,
  fetchPublicServiceStatus,
} from "@/lib/public-status-api";
import { cn } from "@/lib/utils";
import type {
  PublicServiceStatusResponse,
  ServiceComponentId,
  ServiceComponentStatus,
  ServiceStatusLevel,
} from "@/types";

const COMPONENT_ICONS: Record<ServiceComponentId, typeof Server> = {
  api: Server,
  data: Database,
  telephony: Phone,
};

function statusBadgeVariant(
  status: ServiceStatusLevel
): "success" | "warning" | "danger" | "default" {
  if (status === "operational") return "success";
  if (status === "degraded") return "warning";
  if (status === "outage") return "danger";
  return "default";
}

function dayColor(status: ServiceStatusLevel): string {
  if (status === "operational") return "bg-success";
  if (status === "degraded") return "bg-warning";
  if (status === "outage") return "bg-danger";
  return "bg-surface-muted";
}

function uptimePercent(component: ServiceComponentStatus): number | null {
  const known = component.days.filter((day) => day.status !== "unknown");
  if (known.length === 0) return null;
  const healthy = known.filter(
    (day) => day.status === "operational" || day.status === "degraded"
  ).length;
  return Math.round((healthy / known.length) * 1000) / 10;
}

export default function StatusPage() {
  const t = useT();
  const { formatDate } = useFormatters();
  const [status, setStatus] = useState<PublicServiceStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchPublicServiceStatus();
      setStatus(data);
    } catch {
      setStatus(buildApiOutageStatus());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const overallLabel = useMemo(() => {
    if (!status) return "";
    if (status.stale && status.overall === "unknown") {
      return t("serviceStatus.overall.unknown");
    }
    return t(`serviceStatus.overall.${status.overall}`);
  }, [status, t]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">{t("serviceStatus.badge")}</p>
          <h1 className="mt-1 text-2xl font-semibold text-primary">
            {t("serviceStatus.title")}
          </h1>
          <p className="mt-2 text-sm text-secondary">{t("serviceStatus.subtitle")}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          {t("serviceStatus.refresh")}
        </Button>
      </div>

      {loading || !status ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <Card
            padding="lg"
            className={cn(
              status.overall === "operational" && "border-success/30",
              status.overall === "degraded" && "border-warning/30",
              status.overall === "outage" && "border-danger/30"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-secondary">{t("serviceStatus.currentStatus")}</p>
                <p className="mt-1 text-xl font-semibold text-primary">{overallLabel}</p>
                {status.stale && (
                  <p className="mt-2 text-sm text-secondary">
                    {t("serviceStatus.staleNotice")}
                  </p>
                )}
              </div>
              <Badge variant={statusBadgeVariant(status.overall)} dot>
                {t(`serviceStatus.levels.${status.overall}`)}
              </Badge>
            </div>
            <p className="mt-4 text-xs text-muted">
              {t("serviceStatus.updatedAt", {
                time: formatDate(status.updatedAt),
              })}
            </p>
          </Card>

          <div className="space-y-4">
            {status.components.map((component) => {
              const Icon = COMPONENT_ICONS[component.id];
              const uptime = uptimePercent(component);
              return (
                <Card key={component.id} padding="none">
                  <CardHeader className="flex flex-row items-center justify-between gap-3 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-muted text-secondary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {t(`serviceStatus.components.${component.id}`)}
                        </CardTitle>
                        <p className="text-xs text-secondary">
                          {t(`serviceStatus.components.${component.id}Desc`)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={statusBadgeVariant(component.status)} dot>
                      {t(`serviceStatus.levels.${component.status}`)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3 border-t border-default px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary">
                      <span>{t("serviceStatus.historyLabel")}</span>
                      <span>
                        {uptime === null
                          ? t("serviceStatus.uptimeUnknown")
                          : t("serviceStatus.uptime", { percent: String(uptime) })}
                      </span>
                    </div>
                    <div
                      className="flex h-8 gap-0.5"
                      role="img"
                      aria-label={t("serviceStatus.historyLabel")}
                    >
                      {component.days.map((day) => (
                        <div
                          key={day.date}
                          title={`${day.date}: ${t(`serviceStatus.levels.${day.status}`)}`}
                          className={cn(
                            "min-w-0 flex-1 rounded-sm",
                            dayColor(day.status)
                          )}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted">
                      <span>
                        {t("serviceStatus.checkedAt", {
                          time: formatDate(component.checkedAt),
                        })}
                      </span>
                      {typeof component.latencyMs === "number" && (
                        <span>
                          {t("serviceStatus.latency", {
                            ms: String(component.latencyMs),
                          })}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-secondary">
            {(
              ["operational", "degraded", "outage", "unknown"] as ServiceStatusLevel[]
            ).map((level) => (
              <div key={level} className="inline-flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-sm", dayColor(level))} />
                {t(`serviceStatus.levels.${level}`)}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
