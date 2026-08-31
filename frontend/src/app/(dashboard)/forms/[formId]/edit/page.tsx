"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useT } from "@/i18n/context";
import { useHostedForm } from "@/hooks/useHostedForms";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormEditor } from "@/components/forms/FormEditor";
import { FormSharePanel } from "@/components/forms/FormSharePanel";
import { FormSubmissionsPanel } from "@/components/forms/FormSubmissionsPanel";
import { Button } from "@/components/ui/Button";
import { SkeletonTable } from "@/components/ui/Skeleton";

type Tab = "builder" | "share" | "submissions";

export default function EditFormPage() {
  const t = useT();
  const { formId } = useParams<{ formId: string }>();
  const { data: form, isLoading } = useHostedForm(formId);
  const [tab, setTab] = useState<Tab>("builder");

  return (
    <DashboardPage maxWidth="none">
      <PageHeader
        title={form?.name ?? t("forms.edit")}
        subtitle={t("forms.subtitle")}
        actions={
          <div className="flex gap-1">
            {(["builder", "share", "submissions"] as const).map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={tab === item ? "secondary" : "ghost"}
                onClick={() => setTab(item)}
              >
                {t(`forms.tabs.${item}`)}
              </Button>
            ))}
          </div>
        }
      />
      {isLoading || !form ? (
        <SkeletonTable rows={6} cols={2} />
      ) : tab === "builder" ? (
        <FormEditor form={form} />
      ) : tab === "share" ? (
        <FormSharePanel form={form} />
      ) : (
        <FormSubmissionsPanel formId={form.formId} />
      )}
    </DashboardPage>
  );
}
