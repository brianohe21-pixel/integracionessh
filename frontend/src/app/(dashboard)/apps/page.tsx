"use client";

import { useT } from "@/i18n/context";
import { useApps } from "@/hooks/useApps";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppsGrid } from "@/components/apps/AppsGrid";

export default function AppsPage() {
  const t = useT();
  const { data, isLoading } = useApps();

  return (
    <DashboardPage>
      <PageHeader title={t("apps.title")} subtitle={t("apps.subtitle")} />
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
      ) : (
        <AppsGrid apps={data?.apps ?? []} />
      )}
    </DashboardPage>
  );
}
