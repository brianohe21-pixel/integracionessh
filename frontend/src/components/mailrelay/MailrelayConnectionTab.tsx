"use client";

import { PlugZap } from "lucide-react";
import { useMailrelayCredentials, useTestMailrelayConnection } from "@/hooks/useMailrelay";
import { useT } from "@/i18n/context";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export function MailrelayConnectionTab() {
  const t = useT();
  const credentials = useMailrelayCredentials();
  const test = useTestMailrelayConnection();
  const configured = credentials.data?.credentials.configured ?? false;

  async function handleTest() {
    await test.mutateAsync();
  }

  if (credentials.isLoading) {
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

      {configured ? (
        <Alert variant="success">{t("mailrelay.connection.connected")}</Alert>
      ) : (
        <Alert variant="warning">{t("mailrelay.connection.notConnected")}</Alert>
      )}

      {test.isError ? <Alert variant="danger">{test.error.message}</Alert> : null}
      {test.isSuccess ? <Alert variant="success">{t("mailrelay.connection.tested")}</Alert> : null}

      {configured ? (
        <Button variant="secondary" onClick={() => void handleTest()} disabled={test.isPending}>
          <PlugZap className="h-4 w-4" />
          {test.isPending ? t("mailrelay.actions.testing") : t("mailrelay.actions.test")}
        </Button>
      ) : null}
    </Card>
  );
}
