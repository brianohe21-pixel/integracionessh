"use client";

import { useT } from "@/i18n/context";
import { useHostedFormSubmissions } from "@/hooks/useHostedForms";
import { useFormatters } from "@/hooks/useFormatters";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableRow } from "@/components/ui/DataTable";
import { Inbox } from "lucide-react";

interface FormSubmissionsPanelProps {
  formId: string;
}

export function FormSubmissionsPanel({ formId }: FormSubmissionsPanelProps) {
  const t = useT();
  const { formatDate } = useFormatters();
  const { data, isLoading } = useHostedFormSubmissions(formId);
  const items = data?.items ?? [];

  if (isLoading) return <SkeletonTable rows={4} cols={3} />;
  if (!items.length) {
    return (
      <EmptyState
        icon={<Inbox className="h-6 w-6" />}
        title={t("forms.submissions.empty")}
        description={t("forms.submissions.emptyHint")}
      />
    );
  }

  return (
    <DataTable>
      <DataTableHead>
        <DataTableRow>
          <DataTableCell header>{t("forms.submissions.when")}</DataTableCell>
          <DataTableCell header>{t("forms.submissions.payload")}</DataTableCell>
          <DataTableCell header>{t("forms.submissions.lead")}</DataTableCell>
        </DataTableRow>
      </DataTableHead>
      <DataTableBody>
        {items.map((item) => (
          <DataTableRow key={item.submissionId}>
            <DataTableCell>{formatDate(item.createdAt)}</DataTableCell>
            <DataTableCell>
              <code className="block max-w-xl truncate text-xs">
                {JSON.stringify(item.payload)}
              </code>
            </DataTableCell>
            <DataTableCell>
              {item.leadId ? item.leadId.slice(0, 8) : t("forms.submissions.noLead")}
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTableBody>
    </DataTable>
  );
}
