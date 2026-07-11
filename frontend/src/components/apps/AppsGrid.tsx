"use client";

import Link from "next/link";
import { Calendar, CreditCard, LayoutGrid } from "lucide-react";
import { useT } from "@/i18n/context";
import type { AppCatalogItem } from "@/types";

const APP_ICONS: Record<string, typeof Calendar> = {
  calendar: Calendar,
  payments: CreditCard,
};

const APP_ROUTES: Record<string, string> = {
  calendar: "/apps/calendar",
  payments: "/apps/payments",
};

const APP_I18N_KEYS: Record<string, { name: string; description: string }> = {
  calendar: { name: "apps.calendarName", description: "apps.calendarDescription" },
  payments: { name: "apps.paymentsName", description: "apps.paymentsDescription" },
};

export function AppsGrid({ apps }: { apps: AppCatalogItem[] }) {
  const t = useT();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {apps.map((app) => {
        const Icon = APP_ICONS[app.id] ?? LayoutGrid;
        const enabledCount = app.installedBots.filter((b) => b.enabled).length;
        const route = APP_ROUTES[app.id];
        const i18n = APP_I18N_KEYS[app.id];

        return (
          <div
            key={app.id}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {i18n ? t(i18n.name) : app.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {enabledCount > 0
                    ? t("apps.installedOn", { count: String(enabledCount) })
                    : t("apps.notInstalled")}
                </p>
              </div>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              {i18n ? t(i18n.description) : app.description}
            </p>
            {route ? (
              <Link
                href={route}
                className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                {t("apps.configure")}
              </Link>
            ) : (
              <span className="inline-flex rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-500">
                {t("apps.comingSoon")}
              </span>
            )}
          </div>
        );
      })}
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6">
        <p className="text-sm font-medium text-gray-500">{t("apps.comingSoon")}</p>
        <p className="mt-1 text-sm text-gray-400">{t("apps.moreAppsHint")}</p>
      </div>
    </div>
  );
}
