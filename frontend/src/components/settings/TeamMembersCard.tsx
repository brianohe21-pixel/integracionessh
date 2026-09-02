"use client";

import { useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  useInviteTenantMember,
  useRemoveTenantMember,
  useTenantMembers,
} from "@/hooks/useTenantMembers";
import { useT } from "@/i18n/context";

export function TeamMembersCard() {
  const t = useT();
  const { data, isLoading } = useTenantMembers();
  const inviteMember = useInviteTenantMember();
  const removeMember = useRemoveTenantMember();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "advisor">("member");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");
  const [inviteInfo, setInviteInfo] = useState<string | null>(null);
  const [inviteInfoType, setInviteInfoType] = useState<"success" | "warning">("success");
  const [deleteError, setDeleteError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ userId: string; name: string } | null>(null);

  const members = data?.members ?? [];
  const currentUserId = data?.currentUserId ?? "";

  function memberErrorMessage(message: string): string {
    if (message === "A user with this email already exists") {
      return t("settings.teamEmailAlreadyExists");
    }
    if (message === "An advisor with this phone number already exists") {
      return t("settings.teamPhoneAlreadyExists");
    }
    if (message === "Cannot remove the last account administrator") {
      return t("settings.teamLastMemberError");
    }
    if (message === "You cannot remove yourself from the account") {
      return t("settings.teamSelfRemoveError");
    }
    return message;
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInviteInfo(null);
    try {
      const result = await inviteMember.mutateAsync({
        name,
        email,
        role,
        ...(role === "advisor" ? { phoneNumber } : {}),
      });
      if (result.invite?.emailSent) {
        setInviteInfoType("success");
        setInviteInfo(t("settings.teamInviteEmailSent", { email: result.invite.email }));
      } else if (result.invite) {
        setInviteInfoType("warning");
        if (result.invite.temporaryPassword) {
          setInviteInfo(
            t("settings.teamInvitePasswordFallback", {
              email: result.invite.email,
              password: result.invite.temporaryPassword,
            })
          );
        } else if (result.invite.emailFailureReason === "recipient_not_verified") {
          setInviteInfo(
            t("settings.teamInviteEmailFailedSandbox", { email: result.invite.email })
          );
        } else {
          setInviteInfo(t("settings.teamInviteEmailFailed", { email: result.invite.email }));
        }
      }
      setName("");
      setEmail("");
      setPhoneNumber("");
      setRole("member");
      setOpen(false);
    } catch (err) {
      setError(memberErrorMessage((err as Error).message));
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError("");
    removeMember.mutate(deleteTarget.userId, {
      onSuccess: () => setDeleteTarget(null),
      onError: (err) => {
        setDeleteError(memberErrorMessage(err.message || t("settings.teamRemoveError")));
        setDeleteTarget(null);
      },
    });
  }

  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-secondary" />
            <h2 className="font-semibold text-primary text-sm">{t("settings.teamTitle")}</h2>
          </div>
          <p className="text-sm text-secondary">{t("settings.teamDescription")}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t("settings.teamInvite")}
        </button>
      </div>

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

      {!isLoading && members.length === 0 && (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title={t("settings.teamEmptyTitle")}
          description={t("settings.teamEmptyDescription")}
        />
      )}

      <div className="space-y-3">
        {members.map((member) => {
          const isSelf = member.userId === currentUserId;
          const displayEmail = member.email || member.username;
          return (
            <div
              key={member.userId}
              className="flex items-center justify-between bg-surface border border-default rounded-xl px-5 py-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-primary">{member.name}</p>
                  {isSelf && (
                    <Badge variant="info">{t("settings.teamYou")}</Badge>
                  )}
                </div>
                {displayEmail && <p className="text-sm text-secondary">{displayEmail}</p>}
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={member.role === "member" ? "info" : "default"}>
                  {member.role === "member" ? t("nav.roleMember") : t("nav.roleAdvisor")}
                </Badge>
                {!isSelf && (
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({ userId: member.userId, name: member.name })
                    }
                    disabled={removeMember.isPending}
                    className="p-2 text-muted hover:text-red-600 disabled:opacity-50"
                    aria-label={t("settings.teamRemove")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-default bg-surface-elevated p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-primary">{t("settings.teamConfirmRemoveTitle")}</h2>
            <p className="text-sm text-secondary">
              {t("settings.teamConfirmRemove", { name: deleteTarget.name })}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={removeMember.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={confirmDelete}
                disabled={removeMember.isPending}
              >
                {removeMember.isPending ? t("common.loading") : t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleInvite}
            className="bg-surface-elevated rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
          >
            <h2 className="text-lg font-semibold text-primary">{t("settings.teamInvite")}</h2>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("settings.teamNamePlaceholder")}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm"
            />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("settings.teamEmailPlaceholder")}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm"
            />
            <div className="space-y-2">
              <p className="text-xs text-secondary">{t("settings.teamRoleLabel")}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRole("member")}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                    role === "member"
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-default text-secondary"
                  }`}
                >
                  {t("nav.roleMember")}
                </button>
                <button
                  type="button"
                  onClick={() => setRole("advisor")}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                    role === "advisor"
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-default text-secondary"
                  }`}
                >
                  {t("nav.roleAdvisor")}
                </button>
              </div>
              <p className="text-xs text-muted">
                {role === "member"
                  ? t("settings.teamRoleMemberHint")
                  : t("settings.teamRoleAdvisorHint")}
              </p>
            </div>
            {role === "advisor" && (
              <input
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder={t("settings.teamPhonePlaceholder")}
                className="w-full px-3 py-2 border border-default rounded-lg text-sm"
              />
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
                disabled={inviteMember.isPending}
                className="px-4 py-2 text-sm bg-accent text-white rounded-lg disabled:opacity-50"
              >
                {inviteMember.isPending ? t("common.loading") : t("settings.teamSendInvite")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
