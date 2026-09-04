"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";
import { useCreateSupportTicket } from "@/hooks/useSupportTickets";
import {
  maskIntegrationError,
  type IntegrationErrorContext,
  type IntegrationKind,
} from "@/lib/integration-errors";

interface IntegrationErrorSupportProps {
  integration: IntegrationKind;
  error: string;
  context?: IntegrationErrorContext;
  className?: string;
}

export function IntegrationErrorSupport({
  integration,
  error,
  context = {},
  className,
}: IntegrationErrorSupportProps) {
  const t = useT();
  const createTicket = useCreateSupportTicket();
  const masked = useMemo(
    () =>
      maskIntegrationError(error, t, integration, {
        ...context,
        page: context.page ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
      }),
    [context, error, integration, t]
  );

  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState(masked.defaultSubject);
  const [message, setMessage] = useState(masked.supportMessage);
  const [formError, setFormError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");

    if (subject.trim().length < 5) {
      setFormError(t("support.validationSubject"));
      return;
    }
    if (message.trim().length < 20) {
      setFormError(t("support.validationMessage"));
      return;
    }

    try {
      await createTicket.mutateAsync({
        category: masked.category,
        subject: subject.trim(),
        message: message.trim(),
      });
      setSubmitted(true);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("support.submitError"));
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-red-200 bg-red-50 p-3 space-y-3",
        className
      )}
    >
      <p className="text-sm text-red-600">{masked.userMessage}</p>

      {submitted ? (
        <p className="text-sm text-green-700">{t("integrations.errors.ticketSubmitted")}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {masked.showSupport ? (
            <button
              type="button"
              onClick={() => setShowForm((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              <LifeBuoy className="h-3.5 w-3.5" />
              {showForm ? t("integrations.errors.hideSupport") : t("integrations.errors.requestSupport")}
            </button>
          ) : null}
          <Link
            href="/support"
            className="text-xs font-medium text-accent hover:underline"
          >
            {t("integrations.errors.goToSupport")}
          </Link>
        </div>
      )}

      {showForm && !submitted ? (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3 border-t border-red-200 pt-3">
          <p className="text-xs text-secondary">{t("integrations.errors.supportFormHint")}</p>

          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">
              {t("support.subject")}
            </label>
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={120}
              className="w-full rounded-lg border border-default bg-white px-3 py-2 text-sm text-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">
              {t("support.message")}
            </label>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
              maxLength={4000}
              className="w-full resize-y rounded-lg border border-default bg-white px-3 py-2 text-sm text-primary"
            />
          </div>

          {formError ? <p className="text-xs text-red-600">{formError}</p> : null}

          <button
            type="submit"
            disabled={createTicket.isPending}
            className="inline-flex items-center justify-center rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {createTicket.isPending ? t("support.submitting") : t("support.submit")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
