import { sendScheduledReport } from "../../lib/reports/send-scheduled-report.js";

interface ScheduledReportEvent {
  action?: string;
  tenantId?: string;
}

export async function handler(event: ScheduledReportEvent): Promise<void> {
  if (event.action !== "send-scheduled-report" || !event.tenantId) {
    console.warn("Ignoring reports event", event);
    return;
  }

  try {
    await sendScheduledReport(event.tenantId);
  } catch (error) {
    console.error("Failed to send scheduled report", {
      tenantId: event.tenantId,
      error,
    });
  }
}
