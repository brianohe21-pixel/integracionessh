"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, FileText, ListTodo, TrendingUp, User } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useDialog } from "@/components/ui/DialogProvider";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { ConversationQuotationsPanel } from "@/components/conversations/ConversationQuotationsPanel";
import { OpportunityCloseDialog } from "@/components/sales/OpportunityCloseDialog";
import { formatSalesMoney } from "@/components/sales/sales-ui";
import {
  useCreateOpportunity,
  useCreateSalesTask,
  useMoveOpportunityStage,
  useSalesPipelines,
  useUpdateOpportunity,
  useUpdateSalesTask,
} from "@/hooks/useSales";
import { useOpportunityByConversation, useOpportunityDetail } from "@/hooks/useSalesOpportunity";
import { useAdvisors } from "@/hooks/useAdvisors";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useT } from "@/i18n/context";
import type { Conversation, Lead, PipelineStage } from "@/types";

type Props = {
  conversation: Conversation;
  activeLead?: Lead | null;
  locale: string;
  onCreateQuotation?: () => void;
};

function contactPhone(conversation: Conversation): string | undefined {
  if (
    (conversation.channel ?? "whatsapp") === "whatsapp" ||
    conversation.channel === "sms" ||
    conversation.channel === "phone"
  ) {
    return conversation.phoneNumber || conversation.participantId;
  }
  return conversation.phoneNumber || undefined;
}

function contactEmail(conversation: Conversation, activeLead?: Lead | null): string | undefined {
  if (conversation.channel === "email") return conversation.participantId;
  return activeLead?.email;
}

export function ConversationOpportunityPanel({
  conversation,
  activeLead,
  locale,
  onCreateQuotation,
}: Props) {
  const t = useT();
  const { alert } = useDialog();
  const qc = useQueryClient();
  const { isMember } = useTenantRole();
  const { data: opportunity, isLoading } = useOpportunityByConversation(conversation.conversationId);
  const { data: detail } = useOpportunityDetail(opportunity?.opportunityId);
  const { data: pipelinesData } = useSalesPipelines();
  const { data: advisors } = useAdvisors();
  const createOpportunity = useCreateOpportunity();
  const updateOpportunity = useUpdateOpportunity();
  const moveStage = useMoveOpportunityStage();
  const createTask = useCreateSalesTask();
  const updateTask = useUpdateSalesTask();

  const [description, setDescription] = useState("");
  const [assignedAdvisorId, setAssignedAdvisorId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [pendingClose, setPendingClose] = useState<{
    stageId: string;
    outcome: "won" | "lost";
  } | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingAdvisor, setSavingAdvisor] = useState(false);
  const [inlineSuccess, setInlineSuccess] = useState(false);
  const inlineSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showInlineSuccess() {
    setInlineSuccess(true);
    if (inlineSuccessTimer.current) clearTimeout(inlineSuccessTimer.current);
    inlineSuccessTimer.current = setTimeout(() => setInlineSuccess(false), 3000);
  }

  useEffect(() => {
    return () => {
      if (inlineSuccessTimer.current) clearTimeout(inlineSuccessTimer.current);
    };
  }, []);

  const opp = detail?.opportunity ?? opportunity;
  const stages: PipelineStage[] =
    detail?.pipeline?.stages ??
    pipelinesData?.items.find((p) => p.pipelineId === opp?.pipelineId)?.stages ??
    pipelinesData?.items.find((p) => p.isDefault)?.stages ??
    [];
  const tasks = detail?.tasks ?? [];

  useEffect(() => {
    if (!opp) return;
    setDescription(opp.description ?? "");
    setAssignedAdvisorId(opp.assignedAdvisorId ?? "");
  }, [opp]);

  const phone = contactPhone(conversation);
  const email = contactEmail(conversation, activeLead);
  const defaultTitle =
    conversation.contactName?.trim() ||
    phone ||
    conversation.participantId ||
    t("sales.newOpportunity");

  async function handleCreate() {
    try {
      await createOpportunity.mutateAsync({
        title: defaultTitle,
        conversationId: conversation.conversationId,
        botId: conversation.botId,
        ...(phone ? { phone } : {}),
        ...(conversation.contactName ? { name: conversation.contactName } : {}),
        ...(email ? { email } : {}),
        ...(activeLead?.leadId ? { leadId: activeLead.leadId } : {}),
        ...(conversation.assignedAdvisorId
          ? { assignedAdvisorId: conversation.assignedAdvisorId }
          : {}),
      });
      await invalidateOpportunity();
      await alert({
        title: t("sales.title"),
        message: t("sales.opportunityCreated"),
        tone: "success",
      });
    } catch (err) {
      await alert({
        title: t("sales.title"),
        message: (err as Error).message || t("sales.saveError"),
        tone: "danger",
      });
    }
  }

  async function invalidateOpportunity() {
    await qc.invalidateQueries({ queryKey: ["sales", "conversation-opportunity"] });
    if (opp) {
      await qc.invalidateQueries({ queryKey: ["sales", "opportunity", opp.opportunityId] });
    }
  }

  async function handleStageChange(stageId: string) {
    if (!opp || opp.stageId === stageId) return;
    const targetStage = stages.find((s) => s.stageId === stageId);
    if (targetStage?.outcome === "won" || targetStage?.outcome === "lost") {
      setPendingClose({ stageId, outcome: targetStage.outcome });
      return;
    }
    await moveStage.mutateAsync({ opportunityId: opp.opportunityId, stageId });
    await invalidateOpportunity();
    showInlineSuccess();
  }

  async function handleSaveNotes() {
    if (!opp) return;
    setSavingNotes(true);
    try {
      await updateOpportunity.mutateAsync({
        opportunityId: opp.opportunityId,
        description,
      });
      await invalidateOpportunity();
      showInlineSuccess();
    } catch (err) {
      await alert({
        title: t("sales.title"),
        message: (err as Error).message || t("sales.saveError"),
        tone: "danger",
      });
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleSaveAdvisor() {
    if (!opp) return;
    setSavingAdvisor(true);
    try {
      await updateOpportunity.mutateAsync({
        opportunityId: opp.opportunityId,
        ...(assignedAdvisorId ? { assignedAdvisorId } : { assignedAdvisorId: "" }),
      });
      await invalidateOpportunity();
      showInlineSuccess();
    } catch (err) {
      await alert({
        title: t("sales.title"),
        message: (err as Error).message || t("sales.saveError"),
        tone: "danger",
      });
    } finally {
      setSavingAdvisor(false);
    }
  }

  async function handleCreateTask() {
    if (!opp || !taskTitle.trim()) return;
    try {
      await createTask.mutateAsync({
        title: taskTitle.trim(),
        opportunityId: opp.opportunityId,
        ...(assignedAdvisorId ? { advisorId: assignedAdvisorId } : {}),
      });
      setTaskTitle("");
      await invalidateOpportunity();
      showInlineSuccess();
    } catch (err) {
      await alert({
        title: t("sales.title"),
        message: (err as Error).message || t("sales.saveError"),
        tone: "danger",
      });
    }
  }

  async function handleCompleteTask(taskId: string) {
    try {
      await updateTask.mutateAsync({ taskId, status: "done" });
      await invalidateOpportunity();
      showInlineSuccess();
    } catch (err) {
      await alert({
        title: t("sales.title"),
        message: (err as Error).message || t("sales.saveError"),
        tone: "danger",
      });
    }
  }

  if (isLoading) {
    return (
      <section className="content-card p-4">
        <p className="text-sm text-secondary">{t("common.loading")}</p>
      </section>
    );
  }

  if (!opp) {
    return (
      <section className="content-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <TrendingUp className="h-3.5 w-3.5" />
          {t("sales.title")}
        </h3>
        <p className="mb-3 text-sm text-secondary">{t("sales.noOpportunityForConversation")}</p>
        <Button
          type="button"
          size="sm"
          className="w-full"
          onClick={() => void handleCreate()}
          disabled={createOpportunity.isPending}
        >
          {t("sales.createFromConversation")}
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {inlineSuccess ? (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--alert-success-border)] bg-[var(--alert-success-bg)] px-3 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {t("sales.opportunitySaved")}
        </div>
      ) : null}
      <section className="content-card p-3.5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
              <TrendingUp className="h-3.5 w-3.5" />
              {t("sales.title")}
            </h3>
            <p className="mt-1 truncate text-sm font-medium text-primary">{opp.title}</p>
            {opp.amount !== undefined && opp.amount > 0 ? (
              <p className="mt-0.5 text-sm font-semibold text-accent">
                {formatSalesMoney(opp.amount, opp.currency, locale)}
              </p>
            ) : null}
          </div>
          {opp.closedAt ? <Badge variant="default">{t("sales.closedLabel")}</Badge> : null}
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-secondary">{t("sales.workspaceStage")}</span>
          <Select
            value={opp.stageId}
            onChange={(e) => void handleStageChange(e.target.value)}
            disabled={!!opp.closedAt || moveStage.isPending}
          >
            {stages.map((stage) => (
              <option key={stage.stageId} value={stage.stageId}>
                {stage.label}
              </option>
            ))}
          </Select>
        </label>
      </section>

      {isMember ? (
        <section className="content-card p-4">
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
            <User className="h-3.5 w-3.5" />
            {t("sales.workspaceResponsible")}
          </h4>
          <div className="flex gap-2">
            <Select
              value={assignedAdvisorId}
              onChange={(e) => setAssignedAdvisorId(e.target.value)}
              className="flex-1"
            >
              <option value="">{t("sales.noAdvisor")}</option>
              {(advisors ?? [])
                .filter((a) => a.status === "active")
                .map((advisor) => (
                  <option key={advisor.advisorId} value={advisor.advisorId}>
                    {advisor.name}
                  </option>
                ))}
            </Select>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void handleSaveAdvisor()}
              disabled={savingAdvisor}
            >
              {t("common.save")}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="content-card p-4">
        <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <ListTodo className="h-3.5 w-3.5" />
          {t("sales.drawerTabTasks")}
        </h4>
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-secondary">{t("sales.tasksEmptyDescription")}</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.taskId}
                className="flex items-start justify-between gap-2 rounded-lg border border-default p-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p
                    className={
                      task.status === "done"
                        ? "text-secondary line-through"
                        : "font-medium text-primary"
                    }
                  >
                    {task.title}
                  </p>
                  {task.dueAt ? (
                    <p className="mt-0.5 text-xs text-muted">
                      {t("sales.taskDue")}: {new Date(task.dueAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
                {task.status !== "done" ? (
                  <button
                    type="button"
                    onClick={() => void handleCompleteTask(task.taskId)}
                    className="flex-shrink-0 text-accent hover:text-accent-hover"
                    title={t("sales.markDone")}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                ) : (
                  <Badge variant="success" className="flex-shrink-0">
                    {t("sales.markDone")}
                  </Badge>
                )}
              </div>
            ))
          )}
          <div className="flex gap-2 pt-1">
            <Input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder={t("sales.taskTitle")}
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!taskTitle.trim() || createTask.isPending}
              onClick={() => void handleCreateTask()}
            >
              {t("sales.newTask")}
            </Button>
          </div>
        </div>
      </section>

      <section className="content-card space-y-2.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
            <FileText className="h-3.5 w-3.5" />
            {t("sales.notes")}
          </h4>
          {description.trim() !== (opp.description ?? "").trim() ? (
            <span className="text-[11px] font-medium text-warning">{t("conversations.noteUnsaved")}</span>
          ) : null}
        </div>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder={t("sales.notesPlaceholder")}
          className="min-h-[72px]"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void handleSaveNotes()}
            disabled={
              savingNotes || description.trim() === (opp.description ?? "").trim()
            }
          >
            {t("common.save")}
          </Button>
        </div>
      </section>

      <section className="content-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
            <CreditCard className="h-3.5 w-3.5" />
            {t("sales.workspaceBilling")}
          </h4>
          {onCreateQuotation ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCreateQuotation}>
              <FileText className="h-3.5 w-3.5" />
              {t("quotations.drawerTitle")}
            </Button>
          ) : null}
        </div>

        {detail?.quotation ? (
          <div className="mb-3 rounded-lg border border-default bg-surface-muted p-3 text-sm">
            <p className="font-medium text-primary">
              {t("sales.quotation")}: {detail.quotation.number}
            </p>
            <p className="mt-0.5 text-secondary">
              {formatSalesMoney(
                detail.quotation.totalInCents / 100,
                detail.quotation.currency,
                locale
              )}
            </p>
            <Badge variant="accent" className="mt-2">
              {t(`quotations.status.${detail.quotation.status}`)}
            </Badge>
          </div>
        ) : null}

        {detail?.payment ? (
          <div className="mb-3 rounded-lg border border-default bg-surface-muted p-3 text-sm">
            <p className="font-medium text-primary">{t("sales.payment")}</p>
            <p className="mt-0.5 text-secondary">
              {formatSalesMoney(
                detail.payment.amountInCents / 100,
                detail.payment.currency,
                locale
              )}
            </p>
            <Badge
              variant={detail.payment.status === "paid" ? "success" : "default"}
              className="mt-2"
            >
              {detail.payment.status}
            </Badge>
          </div>
        ) : null}

        <ConversationQuotationsPanel
          conversationId={conversation.conversationId}
          botId={conversation.botId}
        />
      </section>

      {pendingClose ? (
        <OpportunityCloseDialog
          outcome={pendingClose.outcome}
          onClose={() => setPendingClose(null)}
          onConfirm={async (data) => {
            await moveStage.mutateAsync({
              opportunityId: opp.opportunityId,
              stageId: pendingClose.stageId,
              ...data,
            });
            setPendingClose(null);
            await invalidateOpportunity();
            showInlineSuccess();
          }}
        />
      ) : null}
    </div>
  );
}
