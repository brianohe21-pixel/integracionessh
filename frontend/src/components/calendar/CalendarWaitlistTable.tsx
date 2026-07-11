"use client";

import { useState } from "react";
import type { WaitlistEntry, WaitlistStatus } from "@/types";
import { useT } from "@/i18n/context";
import { TableContainer } from "@/components/ui/TableContainer";
import {
  useConvertWaitlistEntry,
  useUpdateWaitlistStatus,
} from "@/hooks/useCalendar";

interface CalendarWaitlistTableProps {
  botId: string;
  entries: WaitlistEntry[];
  isLoading?: boolean;
}

const STATUS_OPTIONS: WaitlistStatus[] = ["active", "contacted", "fulfilled", "cancelled"];

function formatWhen(entry: WaitlistEntry): string {
  if (entry.scope === "slot" && entry.startAt) {
    return new Date(entry.startAt).toLocaleString();
  }
  if (entry.isoDate) {
    return entry.isoDate;
  }
  return "—";
}

export function CalendarWaitlistTable({
  botId,
  entries,
  isLoading,
}: CalendarWaitlistTableProps) {
  const t = useT();
  const updateStatus = useUpdateWaitlistStatus(botId);
  const convertEntry = useConvertWaitlistEntry(botId);
  const [error, setError] = useState("");

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-gray-100" />;
  }

  async function handleConvert(entry: WaitlistEntry) {
    setError("");
    let startAt: string | undefined;
    if (entry.scope === "date") {
      const value = window.prompt(t("calendar.waitlist.convertPrompt"));
      if (!value) return;
      startAt = value;
    }
    try {
      await convertEntry.mutateAsync({
        waitlistId: entry.waitlistId,
        ...(startAt ? { startAt } : {}),
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <TableContainer>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                {t("calendar.colDate")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                {t("calendar.colContact")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                {t("calendar.waitlist.colScope")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                {t("common.status")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  {t("calendar.waitlist.empty")}
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.waitlistId}>
                  <td className="px-4 py-3 text-gray-900">{formatWhen(entry)}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{entry.contactName}</div>
                    <div className="text-xs text-gray-500">{entry.contactPhone}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {t(`calendar.waitlist.scope.${entry.scope}` as "calendar.waitlist.scope.slot")}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={entry.status}
                      onChange={(e) =>
                        void updateStatus.mutateAsync({
                          waitlistId: entry.waitlistId,
                          status: e.target.value as WaitlistStatus,
                        })
                      }
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {t(`calendar.waitlist.status.${status}` as "calendar.waitlist.status.active")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {entry.status === "active" || entry.status === "contacted" ? (
                      <button
                        type="button"
                        onClick={() => void handleConvert(entry)}
                        disabled={convertEntry.isPending}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {t("calendar.waitlist.convert")}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">{entry.waitlistId.slice(0, 8)}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableContainer>
    </div>
  );
}
