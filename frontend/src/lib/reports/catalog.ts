export type TenantReportStatus = "available" | "coming_soon";

export type TenantReport = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  href: string;
  status: TenantReportStatus;
};

export const TENANT_REPORTS: TenantReport[] = [
  {
    id: "whatsapp-usage",
    titleKey: "reports.whatsappUsage.title",
    descriptionKey: "reports.whatsappUsage.description",
    href: "/reports/whatsapp-usage",
    status: "available",
  },
];
