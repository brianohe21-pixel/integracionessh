"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X, Zap } from "lucide-react";
import {
  useAutomations,
  useCreateAutomation,
  useDeleteAutomation,
  useToggleAutomation,
  useUpdateAutomation,
} from "@/hooks/useAutomations";
import { useT } from "@/i18n/context";
import type { AutomationAction, AutomationRule, AutomationTrigger, LocalizedText } from "@/types";
import { LocalizedTextField } from "@/components/ui/LocalizedTextField";
import { TableContainer } from "@/components/ui/TableContainer";
import { EmptyState } from "@/components/ui/EmptyState";

const TRIGGERS: AutomationTrigger[] = ["keyword", "first_message", "schedule", "flow_completed"];
const ACTIONS: AutomationAction[] = ["send_text", "send_template", "tag_contact", "handoff"];

type DialogMode = "create" | "edit" | null;

type FormState = {
  name: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
  keywords: string;
  messageText: LocalizedText;
  tags: string;
  metaFlowId: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  trigger: "keyword",
  action: "send_text",
  keywords: "",
  messageText: "",
  tags: "",
  metaFlowId: "",
};

function ruleToForm(rule: AutomationRule): FormState {
  return {
    name: rule.name,
    trigger: rule.trigger,
    action: rule.action,
    keywords: rule.keywords?.join(", ") ?? "",
    messageText: rule.messageText ?? "",
    tags: rule.tags?.join(", ") ?? "",
    metaFlowId: rule.metaFlowId ?? "",
  };
}

function formToPayload(form: FormState, botId: string) {
  return {
    name: form.name,
    botId,
    trigger: form.trigger,
    action: form.action,
    ...(form.trigger === "keyword"
      ? {
          keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
          matchMode: "contains" as const,
        }
      : { keywords: [] }),
    ...(form.trigger === "flow_completed" && form.metaFlowId
      ? { metaFlowId: form.metaFlowId }
      : { metaFlowId: undefined }),
    ...(form.action === "send_text" ? { messageText: form.messageText } : {}),
    ...(form.action === "tag_contact"
      ? { tags: form.tags.split(",").map((k) => k.trim()).filter(Boolean) }
      : { tags: [] }),
  };
}

export function BotAutomationsPanel({ botId }: { botId: string }) {
  const t = useT();
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState("");

  const { data, isLoading } = useAutomations(botId);
  const createRule = useCreateAutomation();
  const updateRule = useUpdateAutomation();
  const deleteRule = useDeleteAutomation();
  const toggleRule = useToggleAutomation();

  const rules = data?.rules ?? [];
  const isSaving = createRule.isPending || updateRule.isPending;

  function openCreate() {
    setForm(EMPTY_FORM);
    setError("");
    setEditingRule(null);
    setDialogMode("create");
  }

  function openEdit(rule: AutomationRule) {
    setForm(ruleToForm(rule));
    setError("");
    setEditingRule(rule);
    setDialogMode("edit");
  }

  function closeDialog() {
    setDialogMode(null);
    setEditingRule(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return;

    try {
      const payload = formToPayload(form, botId);
      if (dialogMode === "create") {
        await createRule.mutateAsync({
          ...payload,
          enabled: true,
          priority: 100,
          stopProcessing: true,
        });
      } else if (dialogMode === "edit" && editingRule) {
        await updateRule.mutateAsync({
          ruleId: editingRule.ruleId,
          data: payload,
        });
      }
      closeDialog();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-default bg-surface-elevated p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-primary">{t("automations.title")}</h2>
          <p className="text-sm text-secondary">{t("automations.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" />
          {t("automations.new")}
        </button>
      </div>

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-lg bg-surface" />
      ) : rules.length === 0 ? (
        <EmptyState icon={<Zap className="h-6 w-6" />} title={t("automations.empty")} />
      ) : (
        <TableContainer>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-default bg-surface text-left text-secondary">
              <tr>
                <th className="px-4 py-3">{t("automations.colName")}</th>
                <th className="px-4 py-3">{t("automations.colTrigger")}</th>
                <th className="px-4 py-3">{t("automations.colAction")}</th>
                <th className="px-4 py-3">{t("common.status")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule: AutomationRule) => (
                <tr key={rule.ruleId} className="border-b border-subtle">
                  <td className="px-4 py-3 font-medium text-primary">{rule.name}</td>
                  <td className="px-4 py-3 text-secondary">{rule.trigger}</td>
                  <td className="px-4 py-3 text-secondary">{rule.action}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleRule.mutate({ ruleId: rule.ruleId, enabled: !rule.enabled })}
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        rule.enabled
                          ? "bg-green-100 text-green-700"
                          : "bg-surface-muted text-secondary"
                      }`}
                    >
                      {rule.enabled ? t("common.active") : t("common.inactive")}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(rule)}
                        className="p-1 text-muted hover:text-primary"
                        aria-label={t("common.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRule.mutate(rule.ruleId)}
                        className="p-1 text-muted hover:text-red-600"
                        aria-label={t("common.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      )}

      {dialogMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl space-y-4 rounded-xl border border-default bg-surface-elevated p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-primary">
                {dialogMode === "create" ? t("automations.new") : t("automations.edit")}
              </h3>
              <button
                type="button"
                onClick={closeDialog}
                className="p-1 text-muted hover:text-primary"
                aria-label={t("common.cancel")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t("automations.namePlaceholder")}
                className="w-full rounded-lg border border-default px-3 py-2 text-sm"
                required
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select
                  value={form.trigger}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, trigger: e.target.value as AutomationTrigger }))
                  }
                  className="rounded-lg border border-default px-3 py-2 text-sm"
                >
                  {TRIGGERS.map((tr) => (
                    <option key={tr} value={tr}>
                      {t(`automations.trigger_${tr}` as "automations.trigger_keyword") || tr}
                    </option>
                  ))}
                </select>
                <select
                  value={form.action}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, action: e.target.value as AutomationAction }))
                  }
                  className="rounded-lg border border-default px-3 py-2 text-sm"
                >
                  {ACTIONS.map((ac) => (
                    <option key={ac} value={ac}>{ac}</option>
                  ))}
                </select>
              </div>
              {form.trigger === "keyword" && (
                <input
                  value={form.keywords}
                  onChange={(e) => setForm((prev) => ({ ...prev, keywords: e.target.value }))}
                  placeholder={t("automations.keywordsPlaceholder")}
                  className="w-full rounded-lg border border-default px-3 py-2 text-sm"
                />
              )}
              {form.trigger === "flow_completed" && (
                <input
                  value={form.metaFlowId}
                  onChange={(e) => setForm((prev) => ({ ...prev, metaFlowId: e.target.value }))}
                  placeholder={t("automations.metaFlowPlaceholder")}
                  className="w-full rounded-lg border border-default px-3 py-2 text-sm"
                />
              )}
              {form.action === "send_text" && (
                <LocalizedTextField
                  value={form.messageText}
                  onChange={(value) => setForm((prev) => ({ ...prev, messageText: value }))}
                  rows={3}
                />
              )}
              {form.action === "tag_contact" && (
                <input
                  value={form.tags}
                  onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                  placeholder={t("automations.tagsPlaceholder")}
                  className="w-full rounded-lg border border-default px-3 py-2 text-sm"
                />
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="px-4 py-2 text-sm text-secondary"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
                >
                  {isSaving
                    ? t("bots.saving")
                    : dialogMode === "create"
                      ? t("common.create")
                      : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
