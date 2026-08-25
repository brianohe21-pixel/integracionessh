"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  TrendingUp,
  Plus,
  X,
  Settings2,
  GitBranch,
} from "lucide-react";
import { useT, useLocale } from "@/i18n/context";
import {
  useSalesPipelines,
  useSalesMetrics,
  useOpportunities,
  useCreateOpportunity,
  useMoveOpportunityStage,
  useSalesSequences,
  useCreateSequence,
  useSalesTasks,
  useUpdateSalesTask,
  useCreateSalesTask,
} from "@/hooks/useSales";
import { useTenantRole } from "@/hooks/useTenantRole";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { SearchInput } from "@/components/ui/SearchInput";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { PipelineStagesModal } from "@/components/sales/PipelineStagesModal";
import { SalesMetricsGrid } from "@/components/sales/SalesMetricsGrid";
import { SalesKanbanBoard } from "@/components/sales/SalesKanbanBoard";
import { SalesSequencesList } from "@/components/sales/SalesSequencesList";
import { SalesTasksList } from "@/components/sales/SalesTasksList";
import { OpportunityDrawer } from "@/components/sales/OpportunityDrawer";
import { OpportunityCloseDialog } from "@/components/sales/OpportunityCloseDialog";
import type { SalesSequenceStep } from "@/types";

type TabId = "funnel" | "sequences" | "tasks";

export default function SalesPage() {
  const t = useT();
  const locale = useLocale();
  const { isMember } = useTenantRole();
  const [tab, setTab] = useState<TabId>("funnel");
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [q, setQ] = useState("");
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState<{
    opportunityId: string;
    stageId: string;
    outcome: "won" | "lost";
  } | null>(null);
  const [showCreateOpportunity, setShowCreateOpportunity] = useState(false);
  const [showCreateSequence, setShowCreateSequence] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditStages, setShowEditStages] = useState(false);

  const {
    data: pipelinesData,
    isLoading: pipelinesLoading,
    isError: pipelinesError,
  } = useSalesPipelines();
  const pipelines = pipelinesData?.items ?? [];
  const activePipelineId =
    selectedPipelineId ||
    pipelines.find((p) => p.isDefault)?.pipelineId ||
    pipelines[0]?.pipelineId ||
    "";
  const activePipeline = pipelines.find((p) => p.pipelineId === activePipelineId);

  const { data: metrics } = useSalesMetrics(activePipelineId);
  const { data: opportunitiesData, isLoading } = useOpportunities({
    pipelineId: activePipelineId,
    ...(q ? { q } : {}),
  });
  const { data: sequencesData } = useSalesSequences();
  const { data: tasksData } = useSalesTasks({ status: "open" });

  const createOpportunity = useCreateOpportunity();
  const moveStage = useMoveOpportunityStage();
  const createSequence = useCreateSequence();
  const updateTask = useUpdateSalesTask();
  const createTask = useCreateSalesTask();

  const opportunities = opportunitiesData?.items ?? [];
  const sequences = sequencesData?.items ?? [];
  const tasks = tasksData?.items ?? [];
  const stages = useMemo(
    () => [...(activePipeline?.stages ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [activePipeline]
  );
  const hasPipeline = stages.length > 0;
  const funnelLoading = pipelinesLoading || (!!activePipelineId && isLoading);

  const tabItems = useMemo(
    () => [
      { id: "funnel" as const, label: t("sales.tabFunnel"), count: opportunities.length },
      { id: "sequences" as const, label: t("sales.tabSequences"), count: sequences.length },
      { id: "tasks" as const, label: t("sales.tabTasks"), count: tasks.length },
    ],
    [t, opportunities.length, sequences.length, tasks.length]
  );

  async function handleKanbanDrop(opportunityId: string, stageId: string) {
    const opportunity = opportunities.find((item) => item.opportunityId === opportunityId);
    if (!opportunity || opportunity.stageId === stageId) return;
    const targetStage = stages.find((s) => s.stageId === stageId);
    if (targetStage?.outcome === "won" || targetStage?.outcome === "lost") {
      setPendingClose({
        opportunityId,
        stageId,
        outcome: targetStage.outcome as "won" | "lost",
      });
      return;
    }
    await moveStage.mutateAsync({ opportunityId, stageId });
  }

  return (
    <DashboardPage>
      <PageHeader
        title={t("sales.title")}
        subtitle={t("sales.subtitle")}
        actions={
          tab === "funnel" ? (
            <Button onClick={() => setShowCreateOpportunity(true)}>
              <Plus className="h-4 w-4" />
              {t("sales.newOpportunity")}
            </Button>
          ) : tab === "sequences" ? (
            isMember ? (
              <Button onClick={() => setShowCreateSequence(true)}>
                <Plus className="h-4 w-4" />
                {t("sales.newSequence")}
              </Button>
            ) : null
          ) : (
            <Button onClick={() => setShowCreateTask(true)}>
              <Plus className="h-4 w-4" />
              {t("sales.newTask")}
            </Button>
          )
        }
      />

      <div className="mb-6">
        <Tabs items={tabItems} value={tab} onChange={setTab} variant="vibrant" className="w-full max-w-xl" />
      </div>

      {tab === "funnel" && (
        <>
          {metrics ? (
            <SalesMetricsGrid
              metrics={metrics}
              locale={locale}
              labels={{
                total: t("sales.metricsTotal"),
                pipelineValue: t("sales.metricsPipelineValue"),
                wonValue: t("sales.metricsWonValue"),
                forecast: t("sales.metricsForecast"),
                conversion: t("sales.metricsConversion"),
              }}
            />
          ) : funnelLoading ? (
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : null}

          <div className="content-card mb-5 flex flex-wrap items-center gap-3 p-3 sm:p-4">
            <div className="flex min-w-[200px] items-center gap-2 text-sm font-medium text-secondary">
              <GitBranch className="h-4 w-4 text-accent" />
              <Select
                value={activePipelineId}
                onChange={(e) => setSelectedPipelineId(e.target.value)}
                className="min-w-[180px] border-0 bg-transparent py-1.5 pl-0 shadow-none focus:ring-0"
              >
                {pipelines.map((pipeline) => (
                  <option key={pipeline.pipelineId} value={pipeline.pipelineId}>
                    {pipeline.name}
                  </option>
                ))}
              </Select>
            </div>

            <SearchInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onClear={() => setQ("")}
              placeholder={t("sales.searchPlaceholder")}
              className="min-w-[220px] flex-1"
            />

            {isMember && activePipeline ? (
              <Button variant="secondary" onClick={() => setShowEditStages(true)}>
                <Settings2 className="h-4 w-4" />
                {t("sales.editStages")}
              </Button>
            ) : null}
          </div>

          {pipelinesLoading ? (
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-80 w-72 shrink-0 rounded-xl" />
              ))}
            </div>
          ) : pipelinesError || !hasPipeline ? (
            <EmptyState
              icon={<TrendingUp className="h-6 w-6" />}
              title={t("sales.pipelineUnavailableTitle")}
              description={t("sales.pipelineUnavailableDescription")}
            />
          ) : funnelLoading ? (
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: stages.length || 4 }).map((_, index) => (
                <Skeleton key={index} className="h-80 w-72 shrink-0 rounded-xl" />
              ))}
            </div>
          ) : (
            <SalesKanbanBoard
              stages={stages}
              opportunities={opportunities}
              metricsByStage={metrics?.byStage}
              locale={locale}
              dragOverStageId={dragOverStageId}
              emptyDescription={t("sales.emptyDescription")}
              onDragOverStage={setDragOverStageId}
              onDrop={(opportunityId, stageId) => void handleKanbanDrop(opportunityId, stageId)}
              onSelectOpportunity={(opp) => setSelectedOpportunityId(opp.opportunityId)}
            />
          )}
        </>
      )}

      {tab === "sequences" && (
        <SalesSequencesList
          sequences={sequences}
          emptyTitle={t("sales.sequencesEmptyTitle")}
          emptyDescription={t("sales.sequencesEmptyDescription")}
          stepsLabel={(count) => t("sales.sequenceSteps", { count })}
          activeLabel={t("common.active")}
          inactiveLabel={t("common.inactive")}
        />
      )}

      {tab === "tasks" && (
        <SalesTasksList
          tasks={tasks}
          emptyTitle={t("sales.tasksEmptyTitle")}
          emptyDescription={t("sales.tasksEmptyDescription")}
          dueLabel={t("sales.taskDue")}
          markDoneLabel={t("sales.markDone")}
          onComplete={(taskId) => void updateTask.mutateAsync({ taskId, status: "done" })}
        />
      )}

      {selectedOpportunityId ? (
        <OpportunityDrawer
          opportunityId={selectedOpportunityId}
          locale={locale}
          onClose={() => setSelectedOpportunityId(null)}
        />
      ) : null}

      {pendingClose ? (
        <OpportunityCloseDialog
          outcome={pendingClose.outcome}
          onClose={() => setPendingClose(null)}
          onConfirm={async (data) => {
            await moveStage.mutateAsync({
              opportunityId: pendingClose.opportunityId,
              stageId: pendingClose.stageId,
              ...data,
            });
            setPendingClose(null);
          }}
        />
      ) : null}

      {showCreateOpportunity && (
        <CreateOpportunityModal
          onClose={() => setShowCreateOpportunity(false)}
          onCreate={async (data) => {
            await createOpportunity.mutateAsync({
              ...(activePipelineId ? { pipelineId: activePipelineId } : {}),
              ...data,
            });
            setShowCreateOpportunity(false);
          }}
        />
      )}

      {showCreateSequence && (
        <CreateSequenceModal
          onClose={() => setShowCreateSequence(false)}
          onCreate={async (data) => {
            await createSequence.mutateAsync(data);
            setShowCreateSequence(false);
          }}
        />
      )}

      {showCreateTask && (
        <CreateTaskModal
          onClose={() => setShowCreateTask(false)}
          onCreate={async (data) => {
            await createTask.mutateAsync(data);
            setShowCreateTask(false);
          }}
        />
      )}

      {showEditStages && activePipeline ? (
        <PipelineStagesModal pipeline={activePipeline} onClose={() => setShowEditStages(false)} />
      ) : null}
    </DashboardPage>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal>
      <div className="mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface-elevated shadow-xl">
        <div className="flex items-center justify-between border-b border-default px-6 py-4">
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted transition-colors hover:bg-surface-muted hover:text-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </Modal>
  );
}

function CreateOpportunityModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: {
    title: string;
    amount?: number;
    name?: string;
    email?: string;
    phone?: string;
    description?: string;
  }) => Promise<void>;
}) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");

  return (
    <ModalShell title={t("sales.newOpportunity")} onClose={onClose}>
      <div className="space-y-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("sales.opportunityTitle")}
        />
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t("sales.amount")}
          type="number"
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("sales.contactName")}
        />
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("common.email")}
          type="email"
        />
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("common.phone")}
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("sales.notes")}
          className="min-h-[90px]"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!title.trim()}
            onClick={() =>
              void onCreate({
                title: title.trim(),
                ...(amount ? { amount: Number(amount) } : {}),
                ...(name ? { name } : {}),
                ...(email ? { email } : {}),
                ...(phone ? { phone } : {}),
                ...(description ? { description } : {}),
              })
            }
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

function CreateSequenceModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: { name: string; steps: SalesSequenceStep[] }) => Promise<void>;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [messageText, setMessageText] = useState("");
  const [delayMinutes, setDelayMinutes] = useState("0");
  const [channel, setChannel] = useState<SalesSequenceStep["channel"]>("whatsapp");

  return (
    <ModalShell title={t("sales.newSequence")} onClose={onClose}>
      <div className="space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("sales.sequenceName")}
        />
        <Select
          value={channel}
          onChange={(e) => setChannel(e.target.value as SalesSequenceStep["channel"])}
        >
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
          <option value="task">{t("sales.tabTasks")}</option>
        </Select>
        <Input
          value={delayMinutes}
          onChange={(e) => setDelayMinutes(e.target.value)}
          placeholder={t("sales.delayMinutes")}
          type="number"
        />
        <Textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder={t("sales.stepContent")}
          className="min-h-[90px]"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() =>
              void onCreate({
                name: name.trim(),
                steps: [
                  {
                    stepId: crypto.randomUUID(),
                    order: 0,
                    delayMinutes: Number(delayMinutes) || 0,
                    channel,
                    ...(channel === "task"
                      ? { taskTitle: messageText || t("sales.followUpTask") }
                      : { messageText }),
                  },
                ],
              })
            }
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

function CreateTaskModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: { title: string; description?: string }) => Promise<void>;
}) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  return (
    <ModalShell title={t("sales.newTask")} onClose={onClose}>
      <div className="space-y-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("sales.taskTitle")}
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("sales.notes")}
          className="min-h-[90px]"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!title.trim()}
            onClick={() => void onCreate({ title: title.trim(), ...(description ? { description } : {}) })}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
