"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { useT } from "@/i18n/context";
import { useUpdatePipeline } from "@/hooks/useSales";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { PipelineStage, SalesPipeline } from "@/types";

type StageKind = "open" | "won" | "lost";

type DraftStage = {
  localId: string;
  stageId?: string;
  key: string;
  label: string;
  probability: string;
  kind: StageKind;
};

function stageKind(stage: PipelineStage): StageKind {
  if (stage.outcome === "won") return "won";
  if (stage.outcome === "lost") return "lost";
  return "open";
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "stage"
  );
}

function uniqueKey(base: string, used: Set<string>): string {
  let key = base;
  let index = 2;
  while (used.has(key)) {
    key = `${base}_${index}`;
    index += 1;
  }
  return key;
}

function fromPipelineStages(stages: PipelineStage[]): DraftStage[] {
  return [...stages]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((stage) => ({
      localId: stage.stageId,
      stageId: stage.stageId,
      key: stage.key,
      label: stage.label,
      probability: String(stage.probability ?? (stageKind(stage) === "won" ? 100 : stageKind(stage) === "lost" ? 0 : 10)),
      kind: stageKind(stage),
    }));
}

function toApiStages(drafts: DraftStage[]) {
  return drafts.map((stage, index) => ({
    ...(stage.stageId ? { stageId: stage.stageId } : {}),
    key: stage.key,
    label: stage.label.trim(),
    sortOrder: index,
    probability: Number(stage.probability) || 0,
    ...(stage.kind === "won" ? { isClosed: true, outcome: "won" as const } : {}),
    ...(stage.kind === "lost" ? { isClosed: true, outcome: "lost" as const } : {}),
  }));
}

function defaultProbability(kind: StageKind): string {
  if (kind === "won") return "100";
  if (kind === "lost") return "0";
  return "10";
}

export function PipelineStagesModal({
  pipeline,
  onClose,
}: {
  pipeline: SalesPipeline;
  onClose: () => void;
}) {
  const t = useT();
  const updatePipeline = useUpdatePipeline();
  const [drafts, setDrafts] = useState<DraftStage[]>(() => fromPipelineStages(pipeline.stages));
  const [error, setError] = useState("");

  useEffect(() => {
    setDrafts(fromPipelineStages(pipeline.stages));
    setError("");
  }, [pipeline]);

  function updateDraft(localId: string, patch: Partial<DraftStage>) {
    setDrafts((current) =>
      current.map((stage) => (stage.localId === localId ? { ...stage, ...patch } : stage))
    );
  }

  function moveStage(localId: string, direction: -1 | 1) {
    setDrafts((current) => {
      const index = current.findIndex((stage) => stage.localId === localId);
      if (index < 0) return current;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item!);
      return copy;
    });
  }

  function removeStage(localId: string) {
    setDrafts((current) => current.filter((stage) => stage.localId !== localId));
  }

  function addStage() {
    const used = new Set(drafts.map((stage) => stage.key));
    const key = uniqueKey("new_stage", used);
    setDrafts((current) => [
      ...current,
      {
        localId: crypto.randomUUID(),
        key,
        label: t("sales.stageNewDefaultLabel"),
        probability: defaultProbability("open"),
        kind: "open",
      },
    ]);
  }

  function handleLabelChange(localId: string, label: string) {
    setDrafts((current) =>
      current.map((stage) => {
        if (stage.localId !== localId) return stage;
        const patch: Partial<DraftStage> = { label };
        if (!stage.stageId) {
          const used = new Set(current.filter((item) => item.localId !== localId).map((item) => item.key));
          patch.key = uniqueKey(slugify(label), used);
        }
        return { ...stage, ...patch };
      })
    );
  }

  function handleKindChange(localId: string, kind: StageKind) {
    updateDraft(localId, {
      kind,
      probability: defaultProbability(kind),
    });
  }

  async function handleSave() {
    if (drafts.length < 2) {
      setError(t("sales.stagesMinError"));
      return;
    }

    const labels = drafts.map((stage) => stage.label.trim());
    if (labels.some((label) => !label)) {
      setError(t("sales.stagesLabelRequired"));
      return;
    }

    const keys = drafts.map((stage) => stage.key.trim());
    if (keys.some((key) => !key)) {
      setError(t("sales.stagesKeyRequired"));
      return;
    }

    if (new Set(keys).size !== keys.length) {
      setError(t("sales.stagesKeyUnique"));
      return;
    }

    for (const stage of drafts) {
      const probability = Number(stage.probability);
      if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
        setError(t("sales.stagesProbabilityInvalid"));
        return;
      }
    }

    setError("");
    try {
      await updatePipeline.mutateAsync({
        pipelineId: pipeline.pipelineId,
        stages: toApiStages(drafts),
      });
      onClose();
    } catch {
      setError(t("sales.stagesSaveError"));
    }
  }

  return (
    <Modal>
      <div className="bg-surface-elevated rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-default">
          <div>
            <h2 className="text-lg font-semibold text-primary">{t("sales.editStagesTitle")}</h2>
            <p className="text-sm text-secondary mt-0.5">{pipeline.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted hover:text-secondary hover:bg-surface-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-secondary">{t("sales.editStagesDescription")}</p>

          <div className="space-y-3">
            {drafts.map((stage, index) => (
              <div
                key={stage.localId}
                className="rounded-xl border border-default bg-surface p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-secondary mb-1">
                        {t("sales.stageLabel")}
                      </label>
                      <input
                        value={stage.label}
                        onChange={(e) => handleLabelChange(stage.localId, e.target.value)}
                        className="w-full px-3 py-2 border border-default rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-secondary mb-1">
                        {t("sales.stageKey")}
                      </label>
                      <input
                        value={stage.key}
                        onChange={(e) => updateDraft(stage.localId, { key: slugify(e.target.value) })}
                        disabled={!!stage.stageId}
                        className="w-full px-3 py-2 border border-default rounded-lg text-sm disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-secondary mb-1">
                        {t("sales.stageType")}
                      </label>
                      <select
                        value={stage.kind}
                        onChange={(e) => handleKindChange(stage.localId, e.target.value as StageKind)}
                        className="w-full px-3 py-2 border border-default rounded-lg text-sm"
                      >
                        <option value="open">{t("sales.stageTypeOpen")}</option>
                        <option value="won">{t("sales.stageTypeWon")}</option>
                        <option value="lost">{t("sales.stageTypeLost")}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-secondary mb-1">
                        {t("sales.stageProbability")}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={stage.probability}
                        onChange={(e) => updateDraft(stage.localId, { probability: e.target.value })}
                        className="w-full px-3 py-2 border border-default rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveStage(stage.localId, -1)}
                      className="p-2 rounded-lg border border-default text-secondary hover:bg-surface-muted disabled:opacity-40"
                      aria-label={t("sales.stageMoveUp")}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === drafts.length - 1}
                      onClick={() => moveStage(stage.localId, 1)}
                      className="p-2 rounded-lg border border-default text-secondary hover:bg-surface-muted disabled:opacity-40"
                      aria-label={t("sales.stageMoveDown")}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={drafts.length <= 2}
                      onClick={() => removeStage(stage.localId)}
                      className="p-2 rounded-lg border border-default text-danger hover:bg-danger/10 disabled:opacity-40"
                      aria-label={t("sales.stageRemove")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button variant="secondary" onClick={addStage}>
            <Plus className="w-4 h-4" />
            {t("sales.addStage")}
          </Button>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void handleSave()} disabled={updatePipeline.isPending}>
              {updatePipeline.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
