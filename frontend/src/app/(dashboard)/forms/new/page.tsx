"use client";

import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormEditor } from "@/components/forms/FormEditor";

export default function NewFormPage() {
  const t = useT();
  return (
    <DashboardPage maxWidth="none">
      <PageHeader title={t("forms.new")} subtitle={t("forms.subtitle")} />
      <FormEditor />
    </DashboardPage>
  );
}
