"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Input";
import { useBots } from "@/hooks/useBots";
import {
  useDisconnectShopify,
  useShopifyConnection,
  useShopifyDeliveries,
  useStartShopifyOAuth,
  useUpdateShopifyConnection,
  type ShopifyNotificationEvent,
  type ShopifyTemplateMapping,
} from "@/hooks/useShopify";

const EVENTS: ShopifyNotificationEvent[] = [
  "abandoned_checkout",
  "order_paid",
  "order_cancelled",
  "fulfillment_shipped",
];

const DEFAULT_VARIABLES: Record<ShopifyNotificationEvent, string[]> = {
  abandoned_checkout: ["name", "total", "checkout_url"],
  order_paid: ["name", "order_number", "total", "status"],
  order_cancelled: ["name", "order_number", "total", "status"],
  fulfillment_shipped: ["name", "order_number", "tracking_number", "tracking_url"],
};

function emptyTemplate(event: ShopifyNotificationEvent): ShopifyTemplateMapping {
  return {
    templateName: "",
    templateLanguage: "es",
    variableKeys: DEFAULT_VARIABLES[event],
  };
}

export default function ShopifyAppPage() {
  const t = useT();
  const searchParams = useSearchParams();
  const { data, isLoading, isError, error } = useShopifyConnection();
  const { data: deliveriesData } = useShopifyDeliveries();
  const { data: botsData } = useBots();
  const startOAuth = useStartShopifyOAuth();
  const updateMutation = useUpdateShopifyConnection();
  const disconnectMutation = useDisconnectShopify();

  const [shop, setShop] = useState("");
  const [botId, setBotId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [abandonDelayMinutes, setAbandonDelayMinutes] = useState(60);
  const [defaultCountry, setDefaultCountry] = useState("CO");
  const [templates, setTemplates] = useState<
    Partial<Record<ShopifyNotificationEvent, ShopifyTemplateMapping>>
  >({});
  const [formError, setFormError] = useState("");
  const [oauthMessage, setOauthMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => {
    if (!data) return;
    setShop(data.shopDomain ?? "");
    setBotId(data.botId ?? "");
    setEnabled(Boolean(data.enabled));
    setAbandonDelayMinutes(data.abandonDelayMinutes ?? 60);
    setDefaultCountry(data.defaultCountry ?? "CO");
    setTemplates(data.templates ?? {});
  }, [data]);

  useEffect(() => {
    if (searchParams.get("connected") === "1") {
      setOauthMessage(t("shopify.connectedSuccess"));
    }
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setOauthMessage(decodeURIComponent(oauthError));
    }
  }, [searchParams, t]);

  async function handleConnect() {
    setFormError("");
    try {
      const result = await startOAuth.mutateAsync(shop.trim());
      window.location.href = result.authUrl;
    } catch (connectError) {
      setFormError(
        connectError instanceof Error ? connectError.message : t("shopify.connectError")
      );
    }
  }

  async function handleSave() {
    setFormError("");
    setSaved(false);
    try {
      await updateMutation.mutateAsync({
        enabled,
        botId,
        abandonDelayMinutes,
        defaultCountry,
        templates,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : t("shopify.saveError"));
    }
  }

  function updateTemplate(
    event: ShopifyNotificationEvent,
    patch: Partial<ShopifyTemplateMapping>
  ) {
    setTemplates((current) => {
      const base = current[event] ?? emptyTemplate(event);
      return {
        ...current,
        [event]: { ...base, ...patch },
      };
    });
  }

  if (isLoading) {
    return (
      <DashboardPage>
        <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />
      </DashboardPage>
    );
  }

  if (isError) {
    return (
      <DashboardPage>
        <Alert variant="danger">
          {error instanceof Error ? error.message : t("shopify.loadError")}
        </Alert>
      </DashboardPage>
    );
  }

  const connected = Boolean(data?.connected);
  const bots = botsData ?? [];
  const deliveries = deliveriesData?.deliveries ?? [];

  return (
    <DashboardPage>
      <PageHeader title={t("shopify.title")} subtitle={t("shopify.subtitle")} />

      <div className="mb-4">
        <Link href="/apps" className="text-sm font-medium text-accent hover:text-accent-hover">
          {t("shopify.backToApps")}
        </Link>
      </div>

      {oauthMessage ? (
        <Alert
          variant={searchParams.get("connected") === "1" ? "success" : "danger"}
          className="mb-4"
        >
          {oauthMessage}
        </Alert>
      ) : null}
      {formError ? (
        <Alert variant="danger" className="mb-4">
          {formError}
        </Alert>
      ) : null}
      {saved ? (
        <Alert variant="success" className="mb-4">
          {t("shopify.saved")}
        </Alert>
      ) : null}

      <section className="mb-6 space-y-4 rounded-xl border border-default bg-surface-elevated p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-primary">{t("shopify.connectionTitle")}</h2>
            <p className="mt-1 text-sm text-secondary">{t("shopify.connectionHint")}</p>
          </div>
          <Badge variant={connected ? "success" : "default"}>
            {connected ? t("shopify.statusConnected") : t("shopify.statusDisconnected")}
          </Badge>
        </div>

        {!connected ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm text-secondary">
              {t("shopify.shopDomain")}
              <Input
                className="mt-1"
                value={shop}
                onChange={(event) => setShop(event.target.value)}
                placeholder="mi-tienda.myshopify.com"
              />
            </label>
            <Button onClick={handleConnect} disabled={startOAuth.isPending || !shop.trim()}>
              {t("shopify.connect")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-primary">
              {t("shopify.connectedShop", { shop: data?.shopDomain ?? "" })}
            </p>
            <Button variant="secondary" onClick={() => setConfirmDisconnect(true)}>
              {t("shopify.disconnect")}
            </Button>
          </div>
        )}
      </section>

      {connected ? (
        <section className="mb-6 space-y-4 rounded-xl border border-default bg-surface-elevated p-6">
          <h2 className="text-base font-semibold text-primary">{t("shopify.settingsTitle")}</h2>

          <label className="flex items-center gap-2 text-sm text-primary">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            {t("shopify.enabled")}
          </label>

          <label className="block text-sm text-secondary">
            {t("shopify.bot")}
            <Select
              className="mt-1"
              value={botId}
              onChange={(event) => setBotId(event.target.value)}
            >
              <option value="">{t("shopify.selectBot")}</option>
              {bots.map((bot) => (
                <option key={bot.botId} value={bot.botId}>
                  {bot.name}
                </option>
              ))}
            </Select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-secondary">
              {t("shopify.abandonDelay")}
              <Input
                className="mt-1"
                type="number"
                min={5}
                max={1440}
                value={abandonDelayMinutes}
                onChange={(event) => setAbandonDelayMinutes(Number(event.target.value) || 60)}
              />
            </label>
            <label className="block text-sm text-secondary">
              {t("shopify.defaultCountry")}
              <Input
                className="mt-1"
                value={defaultCountry}
                maxLength={2}
                onChange={(event) => setDefaultCountry(event.target.value.toUpperCase())}
              />
            </label>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-primary">{t("shopify.templatesTitle")}</h3>
            <p className="text-sm text-secondary">{t("shopify.templatesHint")}</p>
            {EVENTS.map((event) => {
              const template = templates[event] ?? emptyTemplate(event);
              return (
                <div
                  key={event}
                  className="grid gap-3 rounded-lg border border-default p-4 sm:grid-cols-2"
                >
                  <p className="sm:col-span-2 text-sm font-medium text-primary">
                    {t(`shopify.events.${event}`)}
                  </p>
                  <label className="block text-sm text-secondary">
                    {t("shopify.templateName")}
                    <Input
                      className="mt-1"
                      value={template.templateName}
                      onChange={(e) =>
                        updateTemplate(event, { templateName: e.target.value })
                      }
                    />
                  </label>
                  <label className="block text-sm text-secondary">
                    {t("shopify.templateLanguage")}
                    <Input
                      className="mt-1"
                      value={template.templateLanguage}
                      onChange={(e) =>
                        updateTemplate(event, { templateLanguage: e.target.value })
                      }
                    />
                  </label>
                  <label className="sm:col-span-2 block text-sm text-secondary">
                    {t("shopify.variableKeys")}
                    <Input
                      className="mt-1"
                      value={template.variableKeys.join(",")}
                      onChange={(e) =>
                        updateTemplate(event, {
                          variableKeys: e.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                </div>
              );
            })}
          </div>

          <Button onClick={handleSave} disabled={updateMutation.isPending || !botId}>
            {t("shopify.save")}
          </Button>
        </section>
      ) : null}

      <section className="rounded-xl border border-default bg-surface-elevated p-6">
        <h2 className="text-base font-semibold text-primary">{t("shopify.deliveriesTitle")}</h2>
        {deliveries.length === 0 ? (
          <p className="mt-3 text-sm text-secondary">{t("shopify.deliveriesEmpty")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 rounded-lg border border-default">
            {deliveries.map((delivery) => (
              <li key={delivery.deliveryId} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-primary">
                    {t(`shopify.events.${delivery.event}`)}
                  </span>
                  <Badge
                    variant={
                      delivery.status === "sent"
                        ? "success"
                        : delivery.status === "failed"
                          ? "danger"
                          : "default"
                    }
                  >
                    {t(`shopify.deliveryStatus.${delivery.status}`)}
                  </Badge>
                </div>
                <p className="mt-1 text-secondary">
                  {delivery.phone ?? "—"} · {delivery.templateName ?? "—"} ·{" "}
                  {new Date(delivery.createdAt).toLocaleString()}
                </p>
                {delivery.reason ? (
                  <p className="mt-1 text-xs text-muted">{delivery.reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={confirmDisconnect}
        title={t("shopify.disconnectTitle")}
        description={t("shopify.disconnectDescription")}
        confirmLabel={t("shopify.disconnect")}
        onConfirm={async () => {
          setConfirmDisconnect(false);
          try {
            await disconnectMutation.mutateAsync();
          } catch (disconnectError) {
            setFormError(
              disconnectError instanceof Error
                ? disconnectError.message
                : t("shopify.disconnectError")
            );
          }
        }}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </DashboardPage>
  );
}
