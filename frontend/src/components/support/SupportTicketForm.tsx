"use client";

import { useState } from "react";
import { useT } from "@/i18n/context";
import { useCreateSupportTicket } from "@/hooks/useSupportTickets";
import type { SupportTicketCategory } from "@/types";

const CATEGORIES: SupportTicketCategory[] = ["general", "technical", "billing", "whatsapp"];

export function SupportTicketForm() {
  const t = useT();
  const createTicket = useCreateSupportTicket();

  const [category, setCategory] = useState<SupportTicketCategory>("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (subject.trim().length < 5) {
      setError(t("support.validationSubject"));
      return;
    }
    if (message.trim().length < 20) {
      setError(t("support.validationMessage"));
      return;
    }

    try {
      await createTicket.mutateAsync({
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      setSubject("");
      setMessage("");
      setCategory("general");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("support.submitError"));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-500">{t("support.contactDescription")}</p>

      <div>
        <label htmlFor="ticket-category" className="block text-sm font-medium text-gray-700 mb-1">
          {t("support.category")}
        </label>
        <select
          id="ticket-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {t(`support.categories.${cat}`)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="ticket-subject" className="block text-sm font-medium text-gray-700 mb-1">
          {t("support.subject")}
        </label>
        <input
          id="ticket-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t("support.subjectPlaceholder")}
          maxLength={120}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="ticket-message" className="block text-sm font-medium text-gray-700 mb-1">
          {t("support.message")}
        </label>
        <textarea
          id="ticket-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("support.messagePlaceholder")}
          rows={5}
          maxLength={4000}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{t("support.success")}</p>}

      <button
        type="submit"
        disabled={createTicket.isPending}
        className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {createTicket.isPending ? t("support.submitting") : t("support.submit")}
      </button>
    </form>
  );
}
