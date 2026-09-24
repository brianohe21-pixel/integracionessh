"use client";

import { Star } from "lucide-react";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ReviewsList } from "@/components/reviews/ReviewsList";
import { isGoogleBusinessComingSoon } from "@/lib/feature-flags";

export default function ReviewsPage() {
  const t = useT();

  if (isGoogleBusinessComingSoon()) {
    return (
      <DashboardPage>
        <PageHeader
          title={t("reviewsPage.title")}
          subtitle={t("reviewsPage.subtitle")}
          actions={<Badge variant="default">{t("integrationsPage.comingSoon")}</Badge>}
        />
        <EmptyState
          icon={<Star className="h-5 w-5" />}
          title={t("integrationsPage.comingSoon")}
        />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <PageHeader title={t("reviewsPage.title")} subtitle={t("reviewsPage.subtitle")} />
      <ReviewsList />
    </DashboardPage>
  );
}
