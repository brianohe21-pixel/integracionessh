"use client";

import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReviewsList } from "@/components/reviews/ReviewsList";

export default function ReviewsPage() {
  const t = useT();

  return (
    <DashboardPage>
      <PageHeader title={t("reviewsPage.title")} subtitle={t("reviewsPage.subtitle")} />
      <ReviewsList />
    </DashboardPage>
  );
}
