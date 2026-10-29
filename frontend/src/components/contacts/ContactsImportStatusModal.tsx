"use client";

import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useT } from "@/i18n/context";

export type ContactImportErrorItem = {
  row: number;
  phone: string;
  reason: string;
};

export type ContactImportReport = {
  status: "processing" | "done" | "error";
  processed: number;
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  rejected: number;
  errors: ContactImportErrorItem[];
  message?: string;
};

type ContactsImportStatusModalProps = {
  report: ContactImportReport;
  onClose: () => void;
};

function resultTitle(
  report: ContactImportReport,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  const imported = report.created + report.updated + report.unchanged;
  if (report.status === "processing") return t("contacts.importProcessing");
  if (report.total === 0 || (report.message && imported === 0 && report.rejected === 0)) {
    return t("contacts.importFailedTitle");
  }
  if (imported === 0) return t("contacts.importNoneTitle");
  if (report.rejected > 0 || report.message) return t("contacts.importPartialTitle");
  return t("contacts.importSuccessTitle");
}

export function ContactsImportStatusModal({ report, onClose }: ContactsImportStatusModalProps) {
  const t = useT();
  const imported = report.created + report.updated + report.unchanged;
  const percent = report.total > 0 ? Math.min(100, Math.round((report.processed / report.total) * 100)) : 0;
  const hiddenErrors = Math.max(0, report.rejected - report.errors.length);

  function reasonLabel(reason: string): string {
    if (reason === "invalid_phone") return t("contacts.importReasonInvalidPhone");
    if (reason === "invalid_consent") return t("contacts.importReasonInvalidConsent");
    if (reason === "missing_phone") return t("contacts.importReasonMissingPhone");
    if (reason === "invalid_email") return t("contacts.importReasonInvalidEmail");
    return t("contacts.importReasonFailed");
  }

  return (
    <Modal>
      <div
        className="w-full max-w-lg rounded-2xl border border-default bg-surface-elevated shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contacts-import-title"
      >
        <div className="border-b border-default px-6 py-4">
          <h2 id="contacts-import-title" className="text-lg font-semibold text-primary">
            {resultTitle(report, t)}
          </h2>
          {report.status === "processing" && (
            <p className="mt-1 text-sm text-secondary">{t("contacts.importProcessingHint")}</p>
          )}
        </div>

        <div className="space-y-4 px-6 py-5">
          {report.status === "processing" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-secondary">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                <span>
                  {report.total > 0
                    ? t("contacts.importProgressCount", {
                        processed: report.processed,
                        total: report.total,
                      })
                    : t("contacts.importProcessing")}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-black/10"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={report.total || 100}
                aria-valuenow={report.total > 0 ? report.processed : undefined}
                aria-label={t("contacts.importProcessing")}
              >
                <div
                  className={`h-full rounded-full bg-accent transition-[width] duration-300 ${report.total > 0 ? "" : "animate-pulse"}`}
                  style={{ width: report.total > 0 ? `${percent}%` : "35%" }}
                />
              </div>
            </div>
          )}

          {report.message && (
            <Alert variant="danger">{report.message}</Alert>
          )}

          {report.total > 0 && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-default px-3 py-2">
                <dt className="text-xs text-secondary">{t("contacts.importResultProcessed")}</dt>
                <dd className="text-lg font-semibold text-primary">{report.processed}</dd>
              </div>
              <div className="rounded-xl border border-default px-3 py-2">
                <dt className="text-xs text-secondary">{t("contacts.importResultImported")}</dt>
                <dd className="text-lg font-semibold text-primary">{imported}</dd>
              </div>
              <div className="rounded-xl border border-default px-3 py-2">
                <dt className="text-xs text-secondary">{t("contacts.importResultRejected")}</dt>
                <dd className="text-lg font-semibold text-primary">{report.rejected}</dd>
              </div>
              <div className="rounded-xl border border-default px-3 py-2">
                <dt className="text-xs text-secondary">{t("contacts.importResultCreated")}</dt>
                <dd className="text-lg font-semibold text-primary">{report.created}</dd>
              </div>
              <div className="rounded-xl border border-default px-3 py-2">
                <dt className="text-xs text-secondary">{t("contacts.importResultUpdated")}</dt>
                <dd className="text-lg font-semibold text-primary">{report.updated}</dd>
              </div>
              <div className="rounded-xl border border-default px-3 py-2">
                <dt className="text-xs text-secondary">{t("contacts.importResultUnchanged")}</dt>
                <dd className="text-lg font-semibold text-primary">{report.unchanged}</dd>
              </div>
            </dl>
          )}

          {report.status !== "processing" && report.updated + report.unchanged > 0 && (
            <p className="text-sm text-secondary">{t("contacts.importNoDuplicates")}</p>
          )}

          {report.errors.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-primary">{t("contacts.importErrorsTitle")}</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-secondary">
                {report.errors.map((error) => (
                  <li key={`${error.row}-${error.phone}-${error.reason}`}>
                    {t("contacts.importErrorRow", { row: error.row })}
                    {error.phone ? ` · ${error.phone}` : ""}
                    {" — "}
                    {reasonLabel(error.reason)}
                  </li>
                ))}
              </ul>
              {hiddenErrors > 0 && (
                <p className="mt-2 text-xs text-secondary">
                  {t("contacts.importErrorsMore", { count: hiddenErrors })}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-default px-6 py-4">
          <Button type="button" onClick={onClose} disabled={report.status === "processing"}>
            {t("common.close")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
