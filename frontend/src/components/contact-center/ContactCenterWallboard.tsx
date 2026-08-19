"use client";

import { Headphones } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useContactCenterWallboard, useSuperviseCall } from "@/hooks/useContactCenter";
import { useT } from "@/i18n/context";
import { Card } from "@/components/ui/Card";

export function ContactCenterWallboard({ showSupervise = false }: { showSupervise?: boolean }) {
  const t = useT();
  const { data, isLoading } = useContactCenterWallboard();
  const supervise = useSuperviseCall();

  if (isLoading || !data) {
    return <p className="text-sm text-muted">{t("common.loading")}</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card padding="md">
        <p className="text-xs uppercase text-muted">{t("contactCenter.available")}</p>
        <p className="mt-1 text-2xl font-semibold">{data.metrics.availableAgents}</p>
      </Card>
      <Card padding="md">
        <p className="text-xs uppercase text-muted">{t("contactCenter.waiting")}</p>
        <p className="mt-1 text-2xl font-semibold">{data.metrics.callsInQueue}</p>
      </Card>
      <Card padding="md">
        <p className="text-xs uppercase text-muted">{t("contactCenter.liveCalls")}</p>
        <p className="mt-1 text-2xl font-semibold">{data.metrics.callsLive}</p>
        <p className="mt-2 text-xs text-secondary">
          {t("contactCenter.asa")}: {data.metrics.averageSpeedOfAnswerSeconds}s ·{" "}
          {t("contactCenter.abandonRate")}: {Math.round(data.metrics.abandonRate * 100)}%
        </p>
      </Card>

      <Card padding="md" className="lg:col-span-2">
        <h3 className="mb-3 text-sm font-semibold">{t("contactCenter.tabAgents")}</h3>
        <div className="space-y-2">
          {data.agents.map((agent) => (
            <div key={agent.advisorId} className="flex items-center justify-between text-sm">
              <span>{agent.name}</span>
              <span className="text-secondary">{agent.state}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card padding="md">
        <h3 className="mb-3 text-sm font-semibold">{t("contactCenter.tabQueues")}</h3>
        <div className="space-y-2">
          {data.queues.map((queue) => (
            <div key={queue.queueId} className="flex items-center justify-between text-sm">
              <span>{queue.name}</span>
              <span className="text-secondary">{queue.waiting}</span>
            </div>
          ))}
        </div>
      </Card>

      {showSupervise ? (
        <Card padding="md" className="lg:col-span-3">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Headphones className="h-4 w-4" />
            {t("contactCenter.liveCalls")}
          </h3>
          <div className="space-y-2">
            {data.liveCalls.map((call) => (
              <div key={call.callId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{call.fromNumber}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void supervise.mutateAsync({ callId: call.callId, role: "monitor" })}
                  >
                    {t("contactCenter.listen")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void supervise.mutateAsync({ callId: call.callId, role: "whisper" })}
                  >
                    {t("contactCenter.whisper")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void supervise.mutateAsync({ callId: call.callId, role: "barge" })}
                  >
                    {t("contactCenter.barge")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
