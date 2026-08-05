"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/i18n/context";
import { useCreateCampaign } from "@/hooks/useCampaigns";
import {
  CampaignFormWizard,
  type CampaignFormSubmitInput,
  type CampaignFormValues,
} from "@/components/campaigns/CampaignFormWizard";
import { DEFAULT_BATCH_FORM } from "@/components/campaigns/CampaignBatchSettings";

const INITIAL_VALUES: CampaignFormValues = {
  config: {
    name: "",
    channel: "whatsapp",
    botId: "",
    templateName: "",
    language: "",
    segments: [],
    scheduledAt: "",
  },
  recipients: [],
  audienceTags: [],
  batchForm: DEFAULT_BATCH_FORM,
  requireOptIn: false,
  requestDlr: false,
};

export default function NewCampaignPage() {
  const t = useT();
  const router = useRouter();
  const createCampaign = useCreateCampaign();

  async function handleSubmit(input: CampaignFormSubmitInput) {
    const campaign = await createCampaign.mutateAsync(input);
    router.push(`/campaigns/${campaign.campaignId}`);
  }

  return (
    <CampaignFormWizard
      mode="create"
      title={t("campaigns.newTitle")}
      subtitle={t("campaigns.newSubtitle")}
      initialValues={INITIAL_VALUES}
      isSubmitting={createCampaign.isPending}
      submitLabel={t("campaigns.createBtn")}
      submittingLabel={t("campaigns.creating")}
      cancelHref="/campaigns"
      onSubmit={handleSubmit}
    />
  );
}
