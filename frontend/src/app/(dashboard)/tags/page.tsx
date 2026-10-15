"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Plus, Tags } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCreateTag,
  useDeleteTag,
  useTags,
  useUpdateTag,
} from "@/hooks/useTags";
import { useSalesPipelines, useSalesSequences } from "@/hooks/useSales";
import { useAdvisors } from "@/hooks/useAdvisors";
import { useBots } from "@/hooks/useBots";
import { usePermissions } from "@/hooks/usePermissions";
import { useTenantRole } from "@/hooks/useTenantRole";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { SideDrawer } from "@/components/ui/SideDrawer";
import { SkeletonTable } from "@/components/ui/Skeleton";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableRow,
} from "@/components/ui/DataTable";
import { useT } from "@/i18n/context";
import type { TagAction, TagDefinition } from "@/types";

const DEFAULT_COLOR = "#2563EB";

type ActionDraft = {
  moveStage: boolean;
  pipelineId: string;
  stageId: string;
  assignAdvisor: boolean;
  assignAdvisorId: string;
  handoff: boolean;
  handoffAdvisorId: string;
  enrollSequence: boolean;
  sequenceId: string;
  createTask: boolean;
  taskTitle: string;
  taskDescription: string;
  taskDueInHours: string;
  taskAdvisorId: string;
  taskPriority: "" | "low" | "medium" | "high" | "highest";
  setConsent: boolean;
  marketingConsent: "opt_in" | "opt_out";
  applyTags: boolean;
  applyTagsValue: string;
  createLead: boolean;
  createLeadBotId: string;
  createLeadTags: string;
};

function emptyDraft(pipelineId = "", stageId = ""): ActionDraft {
  return {
    moveStage: false,
    pipelineId,
    stageId,
    assignAdvisor: false,
    assignAdvisorId: "",
    handoff: false,
    handoffAdvisorId: "",
    enrollSequence: false,
    sequenceId: "",
    createTask: false,
    taskTitle: "",
    taskDescription: "",
    taskDueInHours: "",
    taskAdvisorId: "",
    taskPriority: "",
    setConsent: false,
    marketingConsent: "opt_in",
    applyTags: false,
    applyTagsValue: "",
    createLead: false,
    createLeadBotId: "",
    createLeadTags: "",
  };
}

function draftFromActions(
  actions: TagAction[],
  fallbackPipelineId: string,
  fallbackStageId: string
): ActionDraft {
  const draft = emptyDraft(fallbackPipelineId, fallbackStageId);
  for (const action of actions) {
    switch (action.type) {
      case "move_opportunity_stage":
        draft.moveStage = true;
        draft.pipelineId = action.pipelineId;
        draft.stageId = action.stageId;
        break;
      case "assign_advisor":
        draft.assignAdvisor = true;
        draft.assignAdvisorId = action.advisorId;
        break;
      case "handoff":
        draft.handoff = true;
        draft.handoffAdvisorId = action.advisorId ?? "";
        break;
      case "enroll_sequence":
        draft.enrollSequence = true;
        draft.sequenceId = action.sequenceId;
        break;
      case "create_task":
        draft.createTask = true;
        draft.taskTitle = action.title;
        draft.taskDescription = action.description ?? "";
        draft.taskDueInHours = action.dueInHours ? String(action.dueInHours) : "";
        draft.taskAdvisorId = action.advisorId ?? "";
        draft.taskPriority = action.priority ?? "";
        break;
      case "set_consent":
        draft.setConsent = true;
        draft.marketingConsent = action.marketingConsent;
        break;
      case "apply_tags":
        draft.applyTags = true;
        draft.applyTagsValue = action.tags.join(", ");
        break;
      case "create_lead":
        draft.createLead = true;
        draft.createLeadBotId = action.botId ?? "";
        draft.createLeadTags = action.tags?.join(", ") ?? "";
        break;
    }
  }
  return draft;
}

function parseTagList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ].slice(0, 20);
}

function ActionToggle({
  enabled,
  onToggle,
  label,
  hint,
  children,
}: {
  enabled: boolean;
  onToggle: (value: boolean) => void;
  label: string;
  hint: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-default p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-primary">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        {label}
      </label>
      <p className="mt-1 text-xs text-secondary">{hint}</p>
      {enabled && children ? <div className="mt-3 space-y-3">{children}</div> : null}
    </div>
  );
}

export default function TagsPage() {
  const t = useT();
  const router = useRouter();
  const { can, loading: permissionsLoading } = usePermissions();
  const canRead = can("contacts.read");
  const { isMember } = useTenantRole();

  const { data: tags, isLoading } = useTags();
  const { data: pipelinesData } = useSalesPipelines();
  const { data: sequencesData } = useSalesSequences();
  const { data: advisors } = useAdvisors();
  const { data: bots } = useBots();
  const pipelines = pipelinesData?.items ?? [];
  const sequences = sequencesData?.items ?? [];
  const activeAdvisors = (advisors ?? []).filter((a) => a.status === "active");

  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TagDefinition | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<ActionDraft>(emptyDraft());
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TagDefinition | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const selectedPipeline =
    pipelines.find((p) => p.pipelineId === draft.pipelineId) ??
    pipelines.find((p) => p.isDefault) ??
    pipelines[0];
  const stages = useMemo(
    () => [...(selectedPipeline?.stages ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [selectedPipeline]
  );
  const defaultPipelineId =
    pipelines.find((p) => p.isDefault)?.pipelineId ?? pipelines[0]?.pipelineId ?? "";
  const defaultStageId = stages[0]?.stageId ?? "";

  useEffect(() => {
    if (!permissionsLoading && !canRead) router.replace("/dashboard");
  }, [canRead, permissionsLoading, router]);

  useEffect(() => {
    if (!draft.moveStage) return;
    setDraft((current) => {
      let next = current;
      if (!current.pipelineId && selectedPipeline) {
        next = { ...next, pipelineId: selectedPipeline.pipelineId };
      }
      if (next.stageId && stages.some((s) => s.stageId === next.stageId)) return next;
      return { ...next, stageId: stages[0]?.stageId ?? "" };
    });
  }, [draft.moveStage, draft.pipelineId, draft.stageId, selectedPipeline, stages]);

  function patchDraft(patch: Partial<ActionDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function resetForm() {
    setEditing(null);
    setName("");
    setColor(DEFAULT_COLOR);
    setDescription("");
    setDraft(emptyDraft(defaultPipelineId, defaultStageId));
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

  function openEdit(tag: TagDefinition) {
    setEditing(tag);
    setName(tag.name);
    setColor(tag.color ?? DEFAULT_COLOR);
    setDescription(tag.description ?? "");
    setDraft(draftFromActions(tag.onApply, defaultPipelineId, defaultStageId));
    setError("");
    setOpen(true);
  }

  function buildOnApply(): TagAction[] | null {
    const actions: TagAction[] = [];

    if (draft.moveStage) {
      if (!draft.pipelineId || !draft.stageId) {
        setError(t("tags.stageRequired"));
        return null;
      }
      actions.push({
        type: "move_opportunity_stage",
        pipelineId: draft.pipelineId,
        stageId: draft.stageId,
        openOnly: true,
      });
    }

    if (draft.assignAdvisor) {
      if (!draft.assignAdvisorId) {
        setError(t("tags.advisorRequired"));
        return null;
      }
      actions.push({ type: "assign_advisor", advisorId: draft.assignAdvisorId });
    }

    if (draft.handoff) {
      actions.push({
        type: "handoff",
        ...(draft.handoffAdvisorId ? { advisorId: draft.handoffAdvisorId } : {}),
      });
    }

    if (draft.enrollSequence) {
      if (!draft.sequenceId) {
        setError(t("tags.sequenceRequired"));
        return null;
      }
      actions.push({ type: "enroll_sequence", sequenceId: draft.sequenceId });
    }

    if (draft.createTask) {
      const title = draft.taskTitle.trim();
      if (!title) {
        setError(t("tags.taskTitleRequired"));
        return null;
      }
      const dueInHours = draft.taskDueInHours.trim()
        ? Number.parseInt(draft.taskDueInHours, 10)
        : undefined;
      if (dueInHours !== undefined && (Number.isNaN(dueInHours) || dueInHours < 1)) {
        setError(t("tags.taskDueInvalid"));
        return null;
      }
      actions.push({
        type: "create_task",
        title,
        ...(draft.taskDescription.trim() ? { description: draft.taskDescription.trim() } : {}),
        ...(dueInHours ? { dueInHours } : {}),
        ...(draft.taskAdvisorId ? { advisorId: draft.taskAdvisorId } : {}),
        ...(draft.taskPriority ? { priority: draft.taskPriority } : {}),
      });
    }

    if (draft.setConsent) {
      actions.push({ type: "set_consent", marketingConsent: draft.marketingConsent });
    }

    if (draft.applyTags) {
      const extraTags = parseTagList(draft.applyTagsValue);
      if (!extraTags.length) {
        setError(t("tags.applyTagsRequired"));
        return null;
      }
      actions.push({ type: "apply_tags", tags: extraTags });
    }

    if (draft.createLead) {
      actions.push({
        type: "create_lead",
        ...(draft.createLeadBotId ? { botId: draft.createLeadBotId } : {}),
        ...(parseTagList(draft.createLeadTags).length
          ? { tags: parseTagList(draft.createLeadTags) }
          : {}),
      });
    }

    return actions;
  }

  function submitForm() {
    setError("");
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("tags.nameRequired"));
      return;
    }

    const onApply = buildOnApply();
    if (!onApply) return;

    const descriptionValue = description.trim();

    if (editing) {
      updateTag.mutate(
        {
          tagId: editing.tagId,
          name: trimmed,
          color,
          description: descriptionValue || null,
          onApply,
        },
        {
          onSuccess: () => closeForm(),
          onError: (err) => setError(err.message || t("tags.saveError")),
        }
      );
      return;
    }

    createTag.mutate(
      {
        name: trimmed,
        color,
        ...(descriptionValue ? { description: descriptionValue } : {}),
        onApply,
      },
      {
        onSuccess: () => closeForm(),
        onError: (err) => setError(err.message || t("tags.saveError")),
      }
    );
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError("");
    deleteTag.mutate(deleteTarget.tagId, {
      onSuccess: () => setDeleteTarget(null),
      onError: (err) => {
        setDeleteError(err.message || t("tags.deleteError"));
        setDeleteTarget(null);
      },
    });
  }

  function actionLabel(action: TagAction): string {
    switch (action.type) {
      case "move_opportunity_stage": {
        const pipeline = pipelines.find((p) => p.pipelineId === action.pipelineId);
        const stage = pipeline?.stages.find((s) => s.stageId === action.stageId);
        return stage
          ? t("tags.moveStageTo", { stage: stage.label })
          : t("tags.action.move_opportunity_stage");
      }
      case "assign_advisor": {
        const advisor = activeAdvisors.find((a) => a.advisorId === action.advisorId);
        return advisor
          ? t("tags.assignAdvisorTo", { name: advisor.name })
          : t("tags.action.assign_advisor");
      }
      case "handoff":
        return action.advisorId
          ? t("tags.handoffTo", {
              name:
                activeAdvisors.find((a) => a.advisorId === action.advisorId)?.name ??
                action.advisorId,
            })
          : t("tags.action.handoff");
      case "enroll_sequence": {
        const sequence = sequences.find((s) => s.sequenceId === action.sequenceId);
        return sequence
          ? t("tags.enrollSequenceTo", { name: sequence.name })
          : t("tags.action.enroll_sequence");
      }
      case "create_task":
        return t("tags.createTaskNamed", { title: action.title });
      case "set_consent":
        return action.marketingConsent === "opt_in"
          ? t("tags.setConsentOptIn")
          : t("tags.setConsentOptOut");
      case "apply_tags":
        return t("tags.applyTagsNamed", { tags: action.tags.join(", ") });
      case "create_lead":
        return t("tags.action.create_lead");
      default: {
        const _exhaustive: never = action;
        void _exhaustive;
        return "";
      }
    }
  }

  function actionsSummary(tag: TagDefinition): string {
    if (!tag.onApply.length) return t("tags.noActions");
    return tag.onApply.map(actionLabel).join(" · ");
  }

  if (permissionsLoading || !canRead) return null;

  const busy = createTag.isPending || updateTag.isPending;

  return (
    <DashboardPage>
      <PageHeader
        title={t("tags.title")}
        subtitle={t("tags.subtitle")}
        actions={
          isMember ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t("tags.new")}
            </Button>
          ) : undefined
        }
      />

      <p className="mb-4 text-sm text-secondary">{t("tags.behaviorHint")}</p>

      {deleteError ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {deleteError}
        </div>
      ) : null}

      {isLoading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : !tags?.length ? (
        <EmptyState
          icon={<Tags className="h-6 w-6" />}
          title={t("tags.emptyTitle")}
          description={t("tags.emptyDescription")}
          action={
            isMember ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                {t("tags.new")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableCell header>{t("tags.colName")}</DataTableCell>
              <DataTableCell header>{t("tags.colActions")}</DataTableCell>
              <DataTableCell header>{t("tags.colDescription")}</DataTableCell>
              {isMember ? <DataTableCell header>{t("tags.colManage")}</DataTableCell> : null}
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {tags.map((tag) => (
              <DataTableRow key={tag.tagId}>
                <DataTableCell>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: tag.color ?? DEFAULT_COLOR }}
                    />
                    <Badge variant="default">{tag.name}</Badge>
                  </span>
                </DataTableCell>
                <DataTableCell>
                  <span className="text-sm">{actionsSummary(tag)}</span>
                </DataTableCell>
                <DataTableCell>
                  <span className="text-sm text-secondary">{tag.description || "—"}</span>
                </DataTableCell>
                {isMember ? (
                  <DataTableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(tag)}>
                        {t("common.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeleteError("");
                          setDeleteTarget(tag);
                        }}
                      >
                        {t("common.delete")}
                      </Button>
                    </div>
                  </DataTableCell>
                ) : null}
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      {open ? (
        <SideDrawer
          title={editing ? t("tags.editTitle") : t("tags.createTitle")}
          subtitle={t("tags.actionsTitle")}
          onClose={closeForm}
          widthClass="max-w-xl"
          contentClassName="p-5"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeForm} disabled={busy}>
                {t("common.cancel")}
              </Button>
              <Button onClick={submitForm} disabled={busy}>
                {busy ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">{t("tags.name")}</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                placeholder={t("tags.namePlaceholder")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">{t("tags.color")}</label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t("tags.description")}
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder={t("tags.descriptionPlaceholder")}
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-primary">{t("tags.actionsTitle")}</p>

              <ActionToggle
                enabled={draft.moveStage}
                onToggle={(value) => patchDraft({ moveStage: value })}
                label={t("tags.enableMoveStage")}
                hint={t("tags.enableMoveStageHint")}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-secondary">
                      {t("tags.pipeline")}
                    </label>
                    <Select
                      value={draft.pipelineId}
                      onChange={(e) => patchDraft({ pipelineId: e.target.value, stageId: "" })}
                    >
                      {pipelines.map((pipeline) => (
                        <option key={pipeline.pipelineId} value={pipeline.pipelineId}>
                          {pipeline.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-secondary">
                      {t("tags.stage")}
                    </label>
                    <Select
                      value={draft.stageId}
                      onChange={(e) => patchDraft({ stageId: e.target.value })}
                    >
                      {stages.map((stage) => (
                        <option key={stage.stageId} value={stage.stageId}>
                          {stage.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </ActionToggle>

              <ActionToggle
                enabled={draft.assignAdvisor}
                onToggle={(value) => patchDraft({ assignAdvisor: value })}
                label={t("tags.enableAssignAdvisor")}
                hint={t("tags.enableAssignAdvisorHint")}
              >
                <Select
                  value={draft.assignAdvisorId}
                  onChange={(e) => patchDraft({ assignAdvisorId: e.target.value })}
                >
                  <option value="">{t("tags.selectAdvisor")}</option>
                  {activeAdvisors.map((advisor) => (
                    <option key={advisor.advisorId} value={advisor.advisorId}>
                      {advisor.name}
                    </option>
                  ))}
                </Select>
              </ActionToggle>

              <ActionToggle
                enabled={draft.handoff}
                onToggle={(value) => patchDraft({ handoff: value })}
                label={t("tags.enableHandoff")}
                hint={t("tags.enableHandoffHint")}
              >
                <Select
                  value={draft.handoffAdvisorId}
                  onChange={(e) => patchDraft({ handoffAdvisorId: e.target.value })}
                >
                  <option value="">{t("tags.autoPickAdvisor")}</option>
                  {activeAdvisors.map((advisor) => (
                    <option key={advisor.advisorId} value={advisor.advisorId}>
                      {advisor.name}
                    </option>
                  ))}
                </Select>
              </ActionToggle>

              <ActionToggle
                enabled={draft.enrollSequence}
                onToggle={(value) => patchDraft({ enrollSequence: value })}
                label={t("tags.enableEnrollSequence")}
                hint={t("tags.enableEnrollSequenceHint")}
              >
                <Select
                  value={draft.sequenceId}
                  onChange={(e) => patchDraft({ sequenceId: e.target.value })}
                >
                  <option value="">{t("tags.selectSequence")}</option>
                  {sequences
                    .filter((s) => s.enabled)
                    .map((sequence) => (
                      <option key={sequence.sequenceId} value={sequence.sequenceId}>
                        {sequence.name}
                      </option>
                    ))}
                </Select>
              </ActionToggle>

              <ActionToggle
                enabled={draft.createTask}
                onToggle={(value) => patchDraft({ createTask: value })}
                label={t("tags.enableCreateTask")}
                hint={t("tags.enableCreateTaskHint")}
              >
                <Input
                  value={draft.taskTitle}
                  onChange={(e) => patchDraft({ taskTitle: e.target.value })}
                  placeholder={t("tags.taskTitlePlaceholder")}
                  maxLength={200}
                />
                <Textarea
                  value={draft.taskDescription}
                  onChange={(e) => patchDraft({ taskDescription: e.target.value })}
                  placeholder={t("tags.taskDescriptionPlaceholder")}
                  rows={2}
                  maxLength={2000}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    type="number"
                    min={1}
                    value={draft.taskDueInHours}
                    onChange={(e) => patchDraft({ taskDueInHours: e.target.value })}
                    placeholder={t("tags.taskDuePlaceholder")}
                  />
                  <Select
                    value={draft.taskPriority}
                    onChange={(e) =>
                      patchDraft({
                        taskPriority: e.target.value as ActionDraft["taskPriority"],
                      })
                    }
                  >
                    <option value="">{t("tags.taskPriorityNone")}</option>
                    <option value="low">{t("tags.taskPriority.low")}</option>
                    <option value="medium">{t("tags.taskPriority.medium")}</option>
                    <option value="high">{t("tags.taskPriority.high")}</option>
                    <option value="highest">{t("tags.taskPriority.highest")}</option>
                  </Select>
                </div>
                <Select
                  value={draft.taskAdvisorId}
                  onChange={(e) => patchDraft({ taskAdvisorId: e.target.value })}
                >
                  <option value="">{t("tags.taskAdvisorOptional")}</option>
                  {activeAdvisors.map((advisor) => (
                    <option key={advisor.advisorId} value={advisor.advisorId}>
                      {advisor.name}
                    </option>
                  ))}
                </Select>
              </ActionToggle>

              <ActionToggle
                enabled={draft.setConsent}
                onToggle={(value) => patchDraft({ setConsent: value })}
                label={t("tags.enableSetConsent")}
                hint={t("tags.enableSetConsentHint")}
              >
                <Select
                  value={draft.marketingConsent}
                  onChange={(e) =>
                    patchDraft({
                      marketingConsent: e.target.value as "opt_in" | "opt_out",
                    })
                  }
                >
                  <option value="opt_in">{t("tags.consentOptIn")}</option>
                  <option value="opt_out">{t("tags.consentOptOut")}</option>
                </Select>
              </ActionToggle>

              <ActionToggle
                enabled={draft.applyTags}
                onToggle={(value) => patchDraft({ applyTags: value })}
                label={t("tags.enableApplyTags")}
                hint={t("tags.enableApplyTagsHint")}
              >
                <Input
                  value={draft.applyTagsValue}
                  onChange={(e) => patchDraft({ applyTagsValue: e.target.value })}
                  placeholder={t("tags.applyTagsPlaceholder")}
                />
              </ActionToggle>

              <ActionToggle
                enabled={draft.createLead}
                onToggle={(value) => patchDraft({ createLead: value })}
                label={t("tags.enableCreateLead")}
                hint={t("tags.enableCreateLeadHint")}
              >
                <Select
                  value={draft.createLeadBotId}
                  onChange={(e) => patchDraft({ createLeadBotId: e.target.value })}
                >
                  <option value="">{t("tags.botOptional")}</option>
                  {(bots ?? []).map((bot) => (
                    <option key={bot.botId} value={bot.botId}>
                      {bot.name}
                    </option>
                  ))}
                </Select>
                <Input
                  value={draft.createLeadTags}
                  onChange={(e) => patchDraft({ createLeadTags: e.target.value })}
                  placeholder={t("tags.createLeadTagsPlaceholder")}
                />
              </ActionToggle>
            </div>
          </div>
        </SideDrawer>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-surface-elevated p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-primary">{t("tags.deleteTitle")}</h2>
            <p className="text-sm text-secondary">
              {t("tags.deleteConfirm", { name: deleteTarget.name })}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                {t("common.cancel")}
              </Button>
              <Button variant="danger" onClick={confirmDelete} disabled={deleteTag.isPending}>
                {deleteTag.isPending ? t("common.loading") : t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardPage>
  );
}
