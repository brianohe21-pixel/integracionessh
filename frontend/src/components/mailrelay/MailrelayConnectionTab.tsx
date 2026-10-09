"use client";

import { PlugZap } from "lucide-react";
import {
  useMailrelayConfig,
  useMailrelayCredentials,
  useTestMailrelayConnection,
} from "@/hooks/useMailrelay";
import { useT } from "@/i18n/context";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export function MailrelayConnectionTab({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const t = useT();
  const credentials = useMailrelayCredentials();
  const configQuery = useMailrelayConfig();
  const test = useTestMailrelayConnection();

  const provider = configQuery.data?.config.provider ?? "mailrelay";
  const configured = credentials.data?.credentials.configured ?? false;
  const providerLabel =
    provider === "nrs360"
      ? t("mailrelay.settings.providerNrs360")
      : t("mailrelay.settings.providerMailrelay");

  if (credentials.isLoading || configQuery.isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (credentials.isError) {
    return <Alert variant="danger">{credentials.error.message}</Alert>;
  }

  return (
    <Card padding="lg" className="space-y-5">
      <div>
        <h2 className="font-semibold text-primary">{t("mailrelay.connection.title")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("mailrelay.connection.description")}</p>
      </div>

      <div className="rounded-lg border border-default bg-surface-muted px-4 py-3 text-sm">
        <p className="text-secondary">{t("mailrelay.connection.activeProvider")}</p>
        <p className="mt-1 font-medium text-primary">{providerLabel}</p>
      </div>

      {configured ? (
        <Alert variant="success">{t("mailrelay.connection.connected")}</Alert>
      ) : (
        <Alert variant="warning">{t("mailrelay.connection.notConnected")}</Alert>
      )}

      {test.isError ? <Alert variant="danger">{test.error.message}</Alert> : null}
      {test.isSuccess ? <Alert variant="success">{t("mailrelay.connection.tested")}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        {configured ? (
          <Button
            variant="secondary"
            onClick={() => void test.mutateAsync()}
            disabled={test.isPending}
          >
            <PlugZap className="h-4 w-4" />
            {test.isPending ? t("mailrelay.actions.testing") : t("mailrelay.actions.test")}
          </Button>
        ) : null}
        {onOpenSettings ? (
          <Button variant="secondary" onClick={onOpenSettings}>
            {t("mailrelay.connection.openSettings")}
          </Button>
        ) : null}
      </div>

      {!configured ? (
        <p className="text-sm text-secondary">{t("mailrelay.connection.configureHint")}</p>
      ) : null}
    </Card>
  );
}
