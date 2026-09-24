"use client";

import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableRow,
} from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { TENANT_REPORTS } from "@/lib/reports/catalog";
import { useT } from "@/i18n/context";

export default function ReportsPage() {
  const t = useT();
  const reports = TENANT_REPORTS;

  return (
    <DashboardPage>
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} />

      {reports.length === 0 ? (
        <EmptyState
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title={t("reports.emptyTitle")}
          description={t("reports.emptyDescription")}
        />
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableCell header>{t("reports.colName")}</DataTableCell>
              <DataTableCell header>{t("reports.colDescription")}</DataTableCell>
              <DataTableCell header>{t("reports.colStatus")}</DataTableCell>
              <DataTableCell header>{t("reports.colAction")}</DataTableCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {reports.map((report) => {
              const available = report.status === "available";
              return (
                <DataTableRow key={report.id}>
                  <DataTableCell>
                    <span className="font-medium text-primary">{t(report.titleKey)}</span>
                  </DataTableCell>
                  <DataTableCell>
                    <span className="text-sm text-secondary">{t(report.descriptionKey)}</span>
                  </DataTableCell>
                  <DataTableCell>
                    <Badge variant={available ? "success" : "default"}>
                      {available ? t("reports.statusAvailable") : t("reports.statusComingSoon")}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell>
                    {available ? (
                      <Link href={report.href}>
                        <Button size="sm" variant="secondary">
                          {t("reports.open")}
                        </Button>
                      </Link>
                    ) : (
                      <Button size="sm" variant="secondary" disabled>
                        {t("reports.open")}
                      </Button>
                    )}
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      )}
    </DashboardPage>
  );
}
