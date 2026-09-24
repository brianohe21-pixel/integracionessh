"use client";

import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { useT } from "@/i18n/context";
import { Badge } from "@/components/ui/Badge";
import type { IntegrationCatalogItem } from "@/hooks/useMicrosoftSso";
import { isGoogleBusinessComingSoon } from "@/lib/feature-flags";

const INTEGRATION_ROUTES: Record<string, string> = {
  "microsoft-sso": "/integrations/microsoft",
  "google-business-profile": "/integrations/google-business",
};

const INTEGRATION_I18N: Record<
  string,
  { name: string; description: string }
> = {
  "microsoft-sso": {
    name: "integrationsPage.microsoft.name",
    description: "integrationsPage.microsoft.description",
  },
  "google-business-profile": {
    name: "integrationsPage.googleBusiness.name",
    description: "integrationsPage.googleBusiness.description",
  },
};

function isComingSoon(id: string): boolean {
  return id === "google-business-profile" && isGoogleBusinessComingSoon();
}

export function IntegrationsGrid({ items }: { items: IntegrationCatalogItem[] }) {
  const t = useT();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const comingSoon = isComingSoon(item.id);
        const route = comingSoon ? undefined : INTEGRATION_ROUTES[item.id];
        const i18n = INTEGRATION_I18N[item.id];
        const statusLabel = comingSoon
          ? t("integrationsPage.comingSoon")
          : item.configured
            ? item.enabled
              ? t("integrationsPage.enabled")
              : t("integrationsPage.configured")
            : t("integrationsPage.notConfigured");

        return (
          <div
            key={item.id}
            className="rounded-xl border border-default bg-surface-elevated p-6 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-muted text-accent">
                  <LayoutGrid className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary">
                    {i18n ? t(i18n.name) : item.id}
                  </h3>
                  <p className="text-sm text-secondary">{statusLabel}</p>
                </div>
              </div>
              <Badge variant={comingSoon ? "default" : item.configured ? "success" : "default"}>
                {statusLabel}
              </Badge>
            </div>
            <p className="mb-4 text-sm text-secondary">
              {i18n ? t(i18n.description) : ""}
            </p>
            {route ? (
              <Link
                href={route}
                className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
              >
                {t("integrationsPage.configure")}
              </Link>
            ) : (
              <span className="inline-flex rounded-lg bg-surface-muted px-4 py-2 text-sm text-secondary">
                {t("integrationsPage.comingSoon")}
              </span>
            )}
          </div>
        );
      })}
      <div className="rounded-xl border border-dashed border-default bg-surface p-6">
        <p className="text-sm font-medium text-secondary">{t("integrationsPage.comingSoon")}</p>
        <p className="mt-1 text-sm text-muted">{t("integrationsPage.moreHint")}</p>
      </div>
    </div>
  );
}
