"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/i18n/context";
import {
  useCampaign,
  useCampaignRecipients,
  useUpdateCampaign,
} from "@/hooks/useCampaigns";
import {
  CampaignFormWizard,
  campaignFormValuesFromCampaign,
  type CampaignFormSubmitInput,
} from "@/components/campaigns/CampaignFormWizard";
import { DashboardPage } from "@/components/layout/DashboardPage";

export default function EditCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);
  const t = useT();
  const router = useRouter();
  const { data: campaign, isLoading, error } = useCampaign(campaignId);
  const { data: recipients = [], isLoading: recipientsLoading } = useCampaignRecipients(campaignId);
  const updateCampaign = useUpdateCampaign(campaignId);

  if (isLoading || recipientsLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        {t("common.loading")}
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <DashboardPage>
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {t("campaigns.loadError")}
        </div>
      </DashboardPage>
    );
  }

  if (campaign.status !== "draft" && campaign.status !== "scheduled") {
    return (
      <DashboardPage className="space-y-4">
        <Link
          href={`/campaigns/${campaignId}`}
          className="inline-flex items-center gap-2 text-sm text-secondary hover:text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("campaigns.backToDetail")}
        </Link>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          {t("campaigns.editNotAllowed")}
        </div>
      </DashboardPage>
    );
  }

  async function handleSubmit(input: CampaignFormSubmitInput) {
    await updateCampaign.mutateAsync(input);
    router.push(`/campaigns/${campaignId}`);
  }

  return (
    <CampaignFormWizard
      mode="edit"
      title={t("campaigns.editTitle")}
      subtitle={t("campaigns.editSubtitle")}
      initialValues={campaignFormValuesFromCampaign(campaign, recipients)}
      isSubmitting={updateCampaign.isPending}
      submitLabel={t("campaigns.saveBtn")}
      submittingLabel={t("campaigns.saving")}
      cancelHref={`/campaigns/${campaignId}`}
      onSubmit={handleSubmit}
    />
  );
}
