"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useT } from "@/i18n/context";
import { usePermissions } from "@/hooks/usePermissions";
import { useCampaignList } from "@/hooks/useCampaigns";
import { CampaignMessagingList } from "@/components/campaigns/CampaignMessagingList";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

export default function CampaignsPage() {
  const t = useT();
  const router = useRouter();
  const { can, loading: permissionsLoading } = usePermissions();
  const { data: campaigns = [], isLoading, error } = useCampaignList();
  const canRead = can("campaigns.read");
  const canWrite = can("campaigns.write");

  useEffect(() => {
    if (!permissionsLoading && !canRead) router.replace("/dashboard");
  }, [canRead, permissionsLoading, router]);

  if (permissionsLoading || !canRead) return null;

  return (
    <DashboardPage className="space-y-6">
      <PageHeader
        title={t("campaigns.title")}
        subtitle={t("campaigns.subtitle")}
        actions={
          canWrite ? (
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            {t("campaigns.create")}
          </Link>
          ) : null
        }
      />

      {isLoading && (
        <div className="py-12 text-center text-muted">{t("common.loading")}</div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {t("campaigns.loadError")}
        </div>
      )}

      {!isLoading && !error && <CampaignMessagingList campaigns={campaigns} />}
    </DashboardPage>
  );
}
