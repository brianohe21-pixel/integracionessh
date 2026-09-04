"use client";

import { useState } from "react";
import { Plus, Users, Trash2 } from "lucide-react";
import {
  useAdvisors,
  useCreateAdvisor,
  useDeleteAdvisor,
} from "@/hooks/useAdvisors";
import { useBots } from "@/hooks/useBots";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SkeletonTable } from "@/components/ui/Skeleton";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableRow,
} from "@/components/ui/DataTable";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

export default function AdvisorsPage() {
  const t = useT();
  const { formatDate, formatRelativeTime } = useFormatters();
  const { data: advisors, isLoading } = useAdvisors();
  const { data: bots } = useBots();
  const createAdvisor = useCreateAdvisor();
  const deleteAdvisor = useDeleteAdvisor();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedBots, setSelectedBots] = useState<string[]>([]);
  const [inviteInfo, setInviteInfo] = useState<string | null>(null);
  const [inviteInfoType, setInviteInfoType] = useState<"success" | "warning">("success");
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ advisorId: string; name: string } | null>(
    null
  );

  function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError("");
    deleteAdvisor.mutate(deleteTarget.advisorId, {
      onSuccess: () => setDeleteTarget(null),
      onError: (err) => {
        setDeleteError(err.message || t("advisors.deleteError"));
        setDeleteTarget(null);
      },
    });
  }

  function advisorErrorMessage(message: string): string {
    if (message === "A user with this email already exists") {
      return t("advisors.emailAlreadyExists");
    }
    if (message === "This email is already linked to an active advisor") {
      return t("advisors.emailAlreadyLinked");
    }
    return message;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInviteInfo(null);
    try {
      const result = await createAdvisor.mutateAsync({
        name,
        phoneNumber,
        ...(inviteEmail ? { inviteEmail } : {}),
        ...(selectedBots.length ? { botIds: selectedBots } : {}),
      });
      if (result.invite?.emailSent) {
        setInviteInfoType("success");
        setInviteInfo(t("advisors.inviteEmailSent", { email: result.invite.email }));
      } else if (result.invite) {
        setInviteInfoType("warning");
        setInviteInfo(
          result.invite.emailFailureReason === "recipient_not_verified"
            ? t("advisors.inviteEmailFailedSandbox", { email: result.invite.email })
            : t("advisors.inviteEmailFailed", { email: result.invite.email })
        );
      }
      setName("");
      setPhoneNumber("");
      setInviteEmail("");
      setSelectedBots([]);
      setOpen(false);
    } catch (err) {
      setError(advisorErrorMessage((err as Error).message));
    }
  }

  return (
    <DashboardPage>
      <PageHeader
        title={t("advisors.title")}
        subtitle={t("advisors.subtitle")}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("advisors.newAdvisor")}
          </Button>
        }
      />

      {inviteInfo && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm border ${
            inviteInfoType === "success"
              ? "bg-green-50 border-green-200 text-green-900"
              : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          {inviteInfo}
        </div>
      )}

      {deleteError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {isLoading ? (
        <SkeletonTable rows={4} cols={6} />
      ) : advisors?.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={t("advisors.emptyTitle")}
          description={t("advisors.emptyDescription")}
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("advisors.newAdvisor")}
            </Button>
          }
        />
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableCell header>{t("advisors.colName")}</DataTableCell>
              <DataTableCell header>{t("advisors.colPhone")}</DataTableCell>
              <DataTableCell header>{t("advisors.colAccess")}</DataTableCell>
              <DataTableCell header>{t("advisors.colLastLogin")}</DataTableCell>
              <DataTableCell header>{t("advisors.colStatus")}</DataTableCell>
              <DataTableCell header className="text-right">
                {t("advisors.colActions")}
              </DataTableCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {advisors?.map((advisor) => (
              <DataTableRow key={advisor.advisorId}>
                <DataTableCell>
                  <p className="font-medium text-primary">{advisor.name}</p>
                </DataTableCell>
                <DataTableCell>
                  <p className="text-secondary">{advisor.phoneNumber}</p>
                </DataTableCell>
                <DataTableCell>
                  {advisor.cognitoUserId ? (
                    <span className="text-xs text-muted">{t("advisors.panelAccess")}</span>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </DataTableCell>
                <DataTableCell>
                  {advisor.lastLoginAt ? (
                    <div>
                      <p className="text-secondary">{formatRelativeTime(advisor.lastLoginAt)}</p>
                      <p className="text-xs text-muted">{formatDate(advisor.lastLoginAt)}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-muted">{t("advisors.neverLoggedIn")}</span>
                  )}
                </DataTableCell>
                <DataTableCell>
                  <Badge variant={advisor.status === "active" ? "success" : "default"}>
                    {advisor.status === "active" ? t("advisors.active") : t("advisors.inactive")}
                  </Badge>
                </DataTableCell>
                <DataTableCell className="text-right">
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({ advisorId: advisor.advisorId, name: advisor.name })
                    }
                    disabled={deleteAdvisor.isPending}
                    className="rounded border border-default p-1.5 text-danger hover:bg-danger/10 disabled:opacity-50"
                    aria-label={t("advisors.delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-default bg-surface-elevated p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-primary">{t("advisors.confirmDeleteTitle")}</h2>
            <p className="text-sm text-secondary">
              {t("advisors.confirmDelete", { name: deleteTarget.name })}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteAdvisor.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={confirmDelete}
                disabled={deleteAdvisor.isPending}
              >
                {deleteAdvisor.isPending ? t("common.loading") : t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleCreate}
            className="bg-surface-elevated rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
          >
            <h2 className="text-lg font-semibold text-primary">{t("advisors.newAdvisor")}</h2>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("advisors.namePlaceholder")}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm"
            />
            <input
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder={t("advisors.phonePlaceholder")}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm"
            />
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={t("advisors.emailPlaceholder")}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm"
            />
            {bots && bots.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-secondary">{t("advisors.botsOptional")}</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {bots.map((bot) => (
                    <label key={bot.botId} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedBots.includes(bot.botId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBots((prev) => [...prev, bot.botId]);
                          } else {
                            setSelectedBots((prev) => prev.filter((id) => id !== bot.botId));
                          }
                        }}
                      />
                      {bot.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm text-secondary"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={createAdvisor.isPending}
                className="px-4 py-2 text-sm bg-accent text-white rounded-lg"
              >
                {t("common.save")}
              </button>
            </div>
          </form>
        </div>
      )}
    </DashboardPage>
  );
}
