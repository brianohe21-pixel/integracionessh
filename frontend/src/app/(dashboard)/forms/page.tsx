"use client";

import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { useT } from "@/i18n/context";
import { useDeleteHostedForm, useHostedForms } from "@/hooks/useHostedForms";
import { useDialog } from "@/components/ui/DialogProvider";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableRow } from "@/components/ui/DataTable";

export default function FormsPage() {
  const t = useT();
  const { confirm } = useDialog();
  const { data, isLoading } = useHostedForms();
  const remove = useDeleteHostedForm();
  const forms = data?.items ?? [];

  async function handleDelete(formId: string, name: string) {
    const ok = await confirm({
      title: t("forms.deleteTitle"),
      description: t("forms.deleteConfirm", { name }),
      tone: "danger",
      confirmLabel: t("forms.delete"),
    });
    if (!ok) return;
    await remove.mutateAsync(formId);
  }

  return (
    <DashboardPage>
      <PageHeader
        title={t("forms.title")}
        subtitle={t("forms.subtitle")}
        actions={
          <Link href="/forms/new">
            <Button>
              <Plus className="h-4 w-4" />
              {t("forms.new")}
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : !forms.length ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title={t("forms.empty")}
          description={t("forms.emptyHint")}
          action={
            <Link href="/forms/new">
              <Button>
                <Plus className="h-4 w-4" />
                {t("forms.new")}
              </Button>
            </Link>
          }
        />
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableCell header>{t("forms.colName")}</DataTableCell>
              <DataTableCell header>{t("forms.colStatus")}</DataTableCell>
              <DataTableCell header>{t("forms.colFields")}</DataTableCell>
              <DataTableCell header className="text-right">
                {t("forms.colActions")}
              </DataTableCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {forms.map((form) => (
              <DataTableRow key={form.formId}>
                <DataTableCell>
                  <Link
                    href={`/forms/${form.formId}/edit`}
                    className="font-medium text-accent hover:underline"
                  >
                    {form.name}
                  </Link>
                </DataTableCell>
                <DataTableCell>
                  <Badge variant={form.published ? "success" : "default"} dot>
                    {form.published ? t("forms.published") : t("forms.draft")}
                  </Badge>
                </DataTableCell>
                <DataTableCell>{form.fields.length}</DataTableCell>
                <DataTableCell className="text-right">
                  <button
                    type="button"
                    className="text-sm text-danger hover:underline"
                    onClick={() => void handleDelete(form.formId, form.name)}
                  >
                    {t("forms.delete")}
                  </button>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </DashboardPage>
  );
}
