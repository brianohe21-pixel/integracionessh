"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/context";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import {
  useOpportunityDetail,
  useOpportunityTimeline,
  useCompanies,
  useCreateCompany,
  useDeleteOpportunity,
  usePauseEnrollment,
  useResumeEnrollment,
  useCancelEnrollment,
} from "@/hooks/useSalesOpportunity";
import {
  useUpdateOpportunity,
  useEnrollOpportunity,
  useCreateSalesTask,
  useSalesSequences,
} from "@/hooks/useSales";
import { useAdvisors } from "@/hooks/useAdvisors";
import { useTenantRole } from "@/hooks/useTenantRole";
import { formatSalesMoney } from "./sales-ui";
import type { SalesSequence } from "@/types";

type TabId = "overview" | "activity" | "tasks" | "relations";

export function OpportunityDrawer({
  opportunityId,
  locale,
  onClose,
}: {
  opportunityId: string;
  locale: string;
  onClose: () => void;
}) {
  const t = useT();
  const { isMember } = useTenantRole();
  const { data: detail, isLoading } = useOpportunityDetail(opportunityId);
  const { data: timeline } = useOpportunityTimeline(opportunityId);
  const { data: companies } = useCompanies();
  const { data: advisors } = useAdvisors();
  const { data: sequencesData } = useSalesSequences();
  const updateOpportunity = useUpdateOpportunity();
  const deleteOpportunity = useDeleteOpportunity();
  const enrollOpportunity = useEnrollOpportunity();
  const createTask = useCreateSalesTask();
  const createCompany = useCreateCompany();
  const pauseEnrollment = usePauseEnrollment();
  const resumeEnrollment = useResumeEnrollment();
  const cancelEnrollment = useCancelEnrollment();

  const [tab, setTab] = useState<TabId>("overview");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [assignedAdvisorId, setAssignedAdvisorId] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [sequenceId, setSequenceId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [error, setError] = useState("");

  const opp = detail?.opportunity;
  const sequences = sequencesData?.items ?? [];

  useEffect(() => {
    if (!opp) return;
    setTitle(opp.title);
    setAmount(opp.amount !== undefined ? String(opp.amount) : "");
    setCurrency(opp.currency);
    setName(opp.name ?? "");
    setEmail(opp.email ?? "");
    setPhone(opp.phone ?? "");
    setDescription(opp.description ?? "");
    setCompanyId(opp.companyId ?? "");
    setAssignedAdvisorId(opp.assignedAdvisorId ?? "");
    setExpectedCloseDate(
      opp.expectedCloseDate ? opp.expectedCloseDate.slice(0, 16) : ""
    );
  }, [opp]);

  async function handleSave() {
    if (!opp) return;
    setError("");
    try {
      await updateOpportunity.mutateAsync({
        opportunityId: opp.opportunityId,
        title: title.trim(),
        ...(amount ? { amount: Number(amount) } : { amount: 0 }),
        currency,
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        description,
        ...(companyId ? { companyId } : {}),
        ...(assignedAdvisorId ? { assignedAdvisorId } : {}),
        ...(expectedCloseDate
          ? { expectedCloseDate: new Date(expectedCloseDate).toISOString() }
          : {}),
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete() {
    if (!opp) return;
    await deleteOpportunity.mutateAsync(opp.opportunityId);
    onClose();
  }

  async function handleCreateCompany() {
    if (!newCompanyName.trim()) return;
    const company = await createCompany.mutateAsync({ name: newCompanyName.trim() });
    setCompanyId(company.companyId);
    setNewCompanyName("");
  }

  const tabItems = [
    { id: "overview" as const, label: t("sales.drawerTabOverview") },
    { id: "activity" as const, label: t("sales.drawerTabActivity") },
    { id: "tasks" as const, label: t("sales.drawerTabTasks") },
    { id: "relations" as const, label: t("sales.drawerTabRelations") },
  ];

  return (
    <Modal>
      <div className="mx-4 flex w-full max-w-2xl max-h-[90vh] flex-col rounded-2xl bg-surface-elevated shadow-xl">
        <div className="flex items-center justify-between border-b border-default px-6 py-4">
          <h2 className="truncate pr-2 font-semibold text-primary">
            {opp?.title ?? t("sales.opportunityDetail")}
          </h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading || !opp ? (
            <div className="p-6 text-sm text-secondary">{t("common.loading")}</div>
          ) : (
            <div className="space-y-4 p-6">
          <div className="flex flex-wrap gap-2 text-xs text-secondary">
            <Badge variant="info">{opp.stage}</Badge>
            {opp.daysInStage > 0 ? (
              <span>{t("sales.daysInStage", { count: opp.daysInStage })}</span>
            ) : null}
            {opp.forecastAmount > 0 ? (
              <span>
                {t("sales.forecastLabel")}:{" "}
                {formatSalesMoney(opp.forecastAmount, opp.currency, locale)}
              </span>
            ) : null}
            {opp.lastActivityAt ? (
              <span>
                {t("sales.lastActivity")}: {new Date(opp.lastActivityAt).toLocaleString()}
              </span>
            ) : null}
          </div>

          <Tabs items={tabItems} value={tab} onChange={setTab} variant="default" />

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          {tab === "overview" ? (
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-sm text-secondary">{t("sales.opportunityTitle")}</span>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-sm text-secondary">{t("sales.amount")}</span>
                  <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm text-secondary">{t("sales.currency")}</span>
                  <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-sm text-secondary">{t("sales.contactName")}</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm text-secondary">{t("common.email")}</span>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
              </label>
              <label className="block space-y-1">
                <span className="text-sm text-secondary">{t("common.phone")}</span>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm text-secondary">{t("sales.expectedCloseDate")}</span>
                <Input
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                  type="datetime-local"
                />
              </label>
              {isMember ? (
                <label className="block space-y-1">
                  <span className="text-sm text-secondary">{t("leads.assignedAdvisor")}</span>
                  <Select value={assignedAdvisorId} onChange={(e) => setAssignedAdvisorId(e.target.value)}>
                    <option value="">{t("sales.noAdvisor")}</option>
                    {(advisors ?? []).map((advisor) => (
                      <option key={advisor.advisorId} value={advisor.advisorId}>
                        {advisor.name}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : null}
              <label className="block space-y-1">
                <span className="text-sm text-secondary">{t("settings.company")}</span>
                <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                  <option value="">{t("sales.noCompany")}</option>
                  {(companies?.items ?? []).map((company) => (
                    <option key={company.companyId} value={company.companyId}>
                      {company.name}
                    </option>
                  ))}
                </Select>
              </label>
              <div className="space-y-1">
                <span className="text-sm text-secondary">{t("sales.newCompanyName")}</span>
                <div className="flex gap-2">
                  <Input
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="secondary" onClick={() => void handleCreateCompany()}>
                    {t("common.create")}
                  </Button>
                </div>
              </div>
              <label className="block space-y-1">
                <span className="text-sm text-secondary">{t("sales.notes")}</span>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[90px]"
                />
              </label>
              {sequences.length > 0 ? (
                <div className="space-y-1">
                  <span className="text-sm text-secondary">{t("sales.sequenceName")}</span>
                  <div className="flex gap-2">
                    <Select value={sequenceId} onChange={(e) => setSequenceId(e.target.value)} className="flex-1">
                      {sequences.map((sequence: SalesSequence) => (
                        <option key={sequence.sequenceId} value={sequence.sequenceId}>
                          {sequence.name}
                        </option>
                      ))}
                    </Select>
                    <Button
                      variant="secondary"
                      disabled={!sequenceId}
                      onClick={() =>
                        void enrollOpportunity.mutateAsync({
                          opportunityId: opp.opportunityId,
                          sequenceId,
                        })
                      }
                    >
                      {t("sales.startSequence")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "activity" ? (
            <div className="space-y-3">
              {(timeline?.items ?? []).map((event) => (
                <div key={event.activityId} className="rounded-lg border border-default p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-primary">{t(`sales.activity_${event.type}`)}</span>
                    <span className="text-xs text-muted">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {event.message ? <p className="mt-1 text-secondary">{event.message}</p> : null}
                </div>
              ))}
              {(timeline?.items ?? []).length === 0 ? (
                <p className="text-sm text-secondary">{t("sales.noActivity")}</p>
              ) : null}
            </div>
          ) : null}

          {tab === "tasks" ? (
            <div className="space-y-3">
              {(detail?.tasks ?? []).map((task) => (
                <div key={task.taskId} className="rounded-lg border border-default p-3 text-sm">
                  <p className="font-medium text-primary">{task.title}</p>
                  {task.dueAt ? (
                    <p className="text-xs text-muted mt-1">
                      {t("sales.taskDue")}: {new Date(task.dueAt).toLocaleString()}
                    </p>
                  ) : null}
                  <Badge variant={task.status === "done" ? "success" : "default"} className="mt-2">
                    {task.status}
                  </Badge>
                </div>
              ))}
              <label className="block space-y-1">
                <span className="text-sm text-secondary">{t("sales.taskTitle")}</span>
                <Input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                />
              </label>
              <Button
                variant="secondary"
                disabled={!taskTitle.trim()}
                onClick={() =>
                  void createTask.mutateAsync({
                    title: taskTitle.trim(),
                    opportunityId: opp.opportunityId,
                    ...(assignedAdvisorId ? { advisorId: assignedAdvisorId } : {}),
                  }).then(() => setTaskTitle(""))
                }
              >
                {t("sales.newTask")}
              </Button>
            </div>
          ) : null}

          {tab === "relations" ? (
            <div className="space-y-3 text-sm">
              {detail?.lead ? (
                <p>
                  <span className="text-secondary">{t("nav.leads")}: </span>
                  <Link href="/leads" className="text-accent hover:underline">
                    {detail.lead.name ?? detail.lead.phone}
                  </Link>
                </p>
              ) : null}
              {detail?.conversation ? (
                <p>
                  <span className="text-secondary">{t("nav.conversations")}: </span>
                  <Link
                    href={`/conversations?botId=${detail.conversation.botId}&phone=${encodeURIComponent(detail.conversation.phoneNumber)}`}
                    className="text-accent hover:underline"
                  >
                    {detail.conversation.contactName ?? detail.conversation.phoneNumber}
                  </Link>
                </p>
              ) : null}
              {detail?.quotation ? (
                <p>
                  <span className="text-secondary">{t("sales.quotation")}: </span>
                  {detail.quotation.number} —{" "}
                  {formatSalesMoney(
                    detail.quotation.totalInCents / 100,
                    detail.quotation.currency,
                    locale
                  )}
                </p>
              ) : null}
              {detail?.payment ? (
                <p>
                  <span className="text-secondary">{t("sales.payment")}: </span>
                  {detail.payment.status} —{" "}
                  {formatSalesMoney(
                    detail.payment.amountInCents / 100,
                    detail.payment.currency,
                    locale
                  )}
                </p>
              ) : null}
              {(detail?.enrollments ?? []).map((enrollment) => (
                <div key={enrollment.enrollmentId} className="rounded-lg border border-default p-3">
                  <p className="font-medium">{enrollment.status}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {enrollment.status === "active" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void pauseEnrollment.mutateAsync(enrollment.enrollmentId)}
                      >
                        {t("sales.pauseSequence")}
                      </Button>
                    ) : null}
                    {enrollment.status === "paused" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void resumeEnrollment.mutateAsync(enrollment.enrollmentId)}
                      >
                        {t("sales.resumeSequence")}
                      </Button>
                    ) : null}
                    {enrollment.status === "active" || enrollment.status === "paused" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void cancelEnrollment.mutateAsync(enrollment.enrollmentId)}
                      >
                        {t("sales.cancelSequence")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
            </div>
          )}
        </div>

        {tab === "overview" && opp ? (
          <div className="flex justify-between gap-2 border-t border-default px-6 py-4">
            {isMember ? (
              <Button variant="secondary" onClick={() => void handleDelete()}>
                {t("common.delete")}
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={() => void handleSave()}>{t("common.save")}</Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
