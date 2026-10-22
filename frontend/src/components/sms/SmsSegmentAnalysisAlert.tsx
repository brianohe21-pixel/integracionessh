"use client";

import { Download } from "lucide-react";
import { useT } from "@/i18n/context";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  downloadSmsOverLimitCsv,
  type SmsSegmentAnalysisSummary,
} from "@/lib/sms-segments";

interface SmsSegmentAnalysisAlertProps {
  analysis: SmsSegmentAnalysisSummary;
  className?: string;
}

export function SmsSegmentAnalysisAlert({
  analysis,
  className,
}: SmsSegmentAnalysisAlertProps) {
  const t = useT();

  if (analysis.total === 0 || analysis.overOneSegment === 0) return null;

  return (
    <Alert
      variant="warning"
      className={className}
      title={t("bulkSend.segmentWarningTitle")}
    >
      <p>
        {t("bulkSend.segmentWarningBody", {
          over: analysis.overOneSegment,
          total: analysis.total,
          billable: analysis.estimatedBillableSegments,
        })}
      </p>
      <p className="mt-1 text-xs opacity-90">{t("bulkSend.segmentWarningHint")}</p>
      {analysis.overLimit.length > 0 && (
        <div className="mt-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => downloadSmsOverLimitCsv(analysis)}
          >
            <Download className="h-3.5 w-3.5" />
            {t("bulkSend.segmentWarningDownload")}
          </Button>
        </div>
      )}
    </Alert>
  );
}
