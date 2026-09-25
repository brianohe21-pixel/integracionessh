"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import {
  useAdvisors,
  useCreateAdvisor,
  useDeleteAdvisor,
  useUpdateAdvisor,
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
import { AdvisorActionsMenu } from "@/components/advisors/AdvisorActionsMenu";
import { AdvisorDateFilters } from "@/components/advisors/AdvisorDateFilters";
import { AdvisorFilters } from "@/components/advisors/AdvisorFilters";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { EMPTY_ADVISOR_FILTERS, filterAdvisors } from "@/lib/advisor-filters";
import type { Advisor } from "@/types";

const ADVISORS_PAGE_SIZE = 20;

export default function AdvisorsPage() {
  const t = useT();
  const { formatDate, formatRelativeTime } = useFormatters();
  const { data: advisors, isLoading } = useAdvisors();
  const { data: bots } = useBots();
  const createAdvisor = useCreateAdvisor();
  const updateAdvisor = useUpdateAdvisor();
  const deleteAdvisor = useDeleteAdvisor();

  const [open, setOpen] = useState(false);
  const [editingAdvisor, setEditingAdvisor] = useState<Advisor | null>(null);
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedBots, setSelectedBots] = useState<string[]>([]);
  const [inviteInfo, setInviteInfo] = useState<string | null>(null);
  const [inviteInfoType, setInviteInfoType] = useState<"success" | "warning">("success");
  const [error, setError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ advisorId: string; name: string } | null>(
    null
  );
  const [filters, setFilters] = useState(EMPTY_ADVISOR_FILTERS);
  const [page, setPage] = useState(1);
  const isEdit = Boolean(editingAdvisor);
  const formBusy = createAdvisor.isPending || updateAdvisor.isPending;

  const filteredAdvisors = useMemo(
    () => filterAdvisors(advisors ?? [], filters),
    [advisors, filters]
  );

  const totalPages = Math.max(1, Math.ceil(filteredAdvisors.length / ADVISORS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart =
    filteredAdvisors.length === 0 ? 0 : (safePage - 1) * ADVISORS_PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * ADVISORS_PAGE_SIZE, filteredAdvisors.length);
  const paginatedAdvisors = filteredAdvisors.slice(
    (safePage - 1) * ADVISORS_PAGE_SIZE,
    safePage * ADVISORS_PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function updateFilters(patch: Partial<typeof filters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function clearFilters() {
    setFilters(EMPTY_ADVISOR_FILTERS);
  }

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

  function resetForm() {
    setEditingAdvisor(null);
    setName("");
    setPhoneNumber("");
    setInviteEmail("");
    setSelectedBots([]);
    setError("");
  }

  function closeForm() {
    setOpen(false);
    resetForm();
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(advisor: Advisor) {
    setEditingAdvisor(advisor);
    setName(advisor.name);
    setPhoneNumber(advisor.phoneNumber);
    setInviteEmail("");
    setSelectedBots(advisor.botIds ?? []);
    setError("");
    setOpen(true);
  }

  function setAdvisorStatus(advisorId: string, status: "active" | "inactive") {
    setStatusError("");
    updateAdvisor.mutate(
      { advisorId, status },
      {
        onError: (err) => {
          setStatusError(err.message || t("advisors.statusError"));
        },
      }
    );
  }

  function advisorErrorMessage(message: string): string {
    if (message === "A user with this email already exists") {
      return t("advisors.emailAlreadyExists");
    }
    if (message === "This email is already linked to an active advisor") {
      return t("advisors.emailAlreadyLinked");
    }
    if (message === "An advisor with this phone number already exists") {
      return t("advisors.phoneAlreadyExists");
    }
    return message;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInviteInfo(null);
    try {
      if (editingAdvisor) {
        await updateAdvisor.mutateAsync({
          advisorId: editingAdvisor.advisorId,
          name: name.trim(),
          phoneNumber: phoneNumber.trim(),
          botIds: selectedBots,
        });
        closeForm();
        return;
      }

      const result = await createAdvisor.mutateAsync({
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
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
      closeForm();
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
          <Button onClick={openCreate}>
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

      {statusError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {statusError}
        </div>
      )}

      {deleteError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {!isLoading && (advisors?.length ?? 0) > 0 && (
        <>
          <AdvisorFilters
            filters={filters}
            bots={bots ?? []}
            onChange={updateFilters}
            onClear={clearFilters}
          />
          <AdvisorDateFilters filters={filters} onChange={updateFilters} />
        </>
      )}

      {isLoading ? (
        <SkeletonTable rows={4} cols={6} />
      ) : advisors?.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={t("advisors.emptyTitle")}
          description={t("advisors.emptyDescription")}
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t("advisors.newAdvisor")}
            </Button>
          }
        />
      ) : filteredAdvisors.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={t("advisors.noResultsTitle")}
          description={t("advisors.noResultsDescription")}
          action={
            <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
              {t("common.clearFilters")}
            </Button>
          }
        />
      ) : (
        <div className="shrink-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-secondary">
              {t("advisors.pageRange", {
                from: pageStart,
                to: pageEnd,
                page: safePage,
              })}
            </p>
          </div>

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
              {paginatedAdvisors.map((advisor) => (
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
                      {advisor.status === "active"
                        ? t("advisors.online")
                        : t("advisors.offline")}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <AdvisorActionsMenu
                      status={advisor.status}
                      busy={updateAdvisor.isPending || deleteAdvisor.isPending}
                      onEdit={() => openEdit(advisor)}
                      onSetOffline={() => setAdvisorStatus(advisor.advisorId, "inactive")}
                      onSetOnline={() => setAdvisorStatus(advisor.advisorId, "active")}
                      onDelete={() =>
                        setDeleteTarget({ advisorId: advisor.advisorId, name: advisor.name })
                      }
                    />
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>

          {totalPages > 1 && (
            <div className="mt-4 flex flex-col gap-3 border-t border-default pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-secondary">
                {t("advisors.pageLabel", { page: safePage })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("advisors.previousPage")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={safePage >= totalPages}
                >
                  {t("advisors.nextPage")}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
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
            onSubmit={(e) => void handleSubmit(e)}
            className="bg-surface-elevated rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
          >
            <h2 className="text-lg font-semibold text-primary">
              {isEdit ? t("advisors.editAdvisor") : t("advisors.newAdvisor")}
            </h2>
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
            {!isEdit ? (
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t("advisors.emailPlaceholder")}
                className="w-full px-3 py-2 border border-default rounded-lg text-sm"
              />
            ) : null}
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
                onClick={closeForm}
                disabled={formBusy}
                className="px-4 py-2 text-sm text-secondary"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={formBusy}
                className="px-4 py-2 text-sm bg-accent text-white rounded-lg disabled:opacity-50"
              >
                {formBusy ? t("common.loading") : t("common.save")}
              </button>
            </div>
          </form>
        </div>
      )}
    </DashboardPage>
  );
}
