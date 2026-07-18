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
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

export default function AdvisorsPage() {
  const t = useT();
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
    <DashboardPage maxWidth="5xl">
      <PageHeader
        title={t("advisors.title")}
        subtitle={t("advisors.subtitle")}
        actions={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover"
          >
            <Plus className="w-4 h-4" />
            {t("advisors.newAdvisor")}
          </button>
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

      {isLoading && <p className="text-sm text-secondary">{t("common.loading")}</p>}

      {!isLoading && advisors?.length === 0 && (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title={t("advisors.emptyTitle")}
          description={t("advisors.emptyDescription")}
        />
      )}

      <div className="space-y-3">
        {advisors?.map((advisor) => (
          <div
            key={advisor.advisorId}
            className="flex items-center justify-between bg-surface-elevated border border-default rounded-xl px-5 py-4"
          >
            <div>
              <p className="font-medium text-primary">{advisor.name}</p>
              <p className="text-sm text-secondary">{advisor.phoneNumber}</p>
              {advisor.cognitoUserId && (
                <p className="text-xs text-muted mt-1">{t("advisors.panelAccess")}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={advisor.status === "active" ? "success" : "default"}>
                {advisor.status === "active" ? t("advisors.active") : t("advisors.inactive")}
              </Badge>
              <button
                type="button"
                onClick={() =>
                  setDeleteTarget({ advisorId: advisor.advisorId, name: advisor.name })
                }
                disabled={deleteAdvisor.isPending}
                className="p-2 text-muted hover:text-red-600 disabled:opacity-50"
                aria-label={t("advisors.delete")}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

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
