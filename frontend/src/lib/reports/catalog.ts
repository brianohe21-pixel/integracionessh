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
  {
    id: "plan-usage",
    titleKey: "reports.planUsage.title",
    descriptionKey: "reports.planUsage.description",
    href: "/reports/plan-usage",
    status: "available",
  },
  {
    id: "campaign-performance",
    titleKey: "reports.campaignPerformance.title",
    descriptionKey: "reports.campaignPerformance.description",
    href: "/reports/campaign-performance",
    status: "available",
  },
];
