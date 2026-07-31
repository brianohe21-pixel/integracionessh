"use client";

import { useState } from "react";
import { Plus, Zap, Trash2 } from "lucide-react";
import { useAutomations, useCreateAutomation, useDeleteAutomation, useToggleAutomation } from "@/hooks/useAutomations";
import { useBots } from "@/hooks/useBots";
import { useT } from "@/i18n/context";
import type { AutomationAction, AutomationRule, AutomationTrigger, LocalizedText } from "@/types";
import { LocalizedTextField } from "@/components/ui/LocalizedTextField";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableContainer } from "@/components/ui/TableContainer";

const TRIGGERS: AutomationTrigger[] = ["keyword", "first_message", "schedule", "flow_completed"];
const ACTIONS: AutomationAction[] = ["send_text", "send_template", "tag_contact", "handoff"];

export default function AutomationsPage() {
  const t = useT();
  const [botFilter, setBotFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [botId, setBotId] = useState("");
  const [trigger, setTrigger] = useState<AutomationTrigger>("keyword");
  const [action, setAction] = useState<AutomationAction>("send_text");
  const [keywords, setKeywords] = useState("");
  const [messageText, setMessageText] = useState<LocalizedText>("");
  const [tags, setTags] = useState("");
  const [metaFlowId, setMetaFlowId] = useState("");
  const [error, setError] = useState("");

  const { data: botsData } = useBots();
  const bots = botsData ?? [];
  const { data, isLoading } = useAutomations(botFilter || undefined);
  const createRule = useCreateAutomation();
  const deleteRule = useDeleteAutomation();
  const toggleRule = useToggleAutomation();

  const rules = data?.rules ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!botId) {
      setError(t("automations.botRequired"));
      return;
    }
    try {
      await createRule.mutateAsync({
        name,
        botId,
        trigger,
        action,
        enabled: true,
        priority: 100,
        stopProcessing: true,
        ...(trigger === "keyword" ? { keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean), matchMode: "contains" as const } : {}),
        ...(trigger === "flow_completed" && metaFlowId ? { metaFlowId } : {}),
        ...(action === "send_text" ? { messageText } : {}),
        ...(action === "tag_contact" ? { tags: tags.split(",").map((k) => k.trim()).filter(Boolean) } : {}),
      });
      setShowForm(false);
      setName("");
      setKeywords("");
      setMessageText("");
      setTags("");
      setMetaFlowId("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <DashboardPage>
      <PageHeader
        title={t("automations.title")}
        subtitle={t("automations.subtitle")}
        actions={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            {t("automations.new")}
          </button>
        }
      />

      <div className="mb-4">
        <select
          value={botFilter}
          onChange={(e) => setBotFilter(e.target.value)}
          className="px-3 py-2 border border-default rounded-lg text-sm"
        >
          <option value="">{t("automations.allBots")}</option>
          {bots.map((b) => (
            <option key={b.botId} value={b.botId}>{b.name}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-surface-elevated rounded-xl border border-default p-6 mb-6 space-y-4 max-w-xl">
          <h2 className="font-semibold text-primary">{t("automations.new")}</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("automations.namePlaceholder")}
            className="w-full px-3 py-2 border border-default rounded-lg text-sm"
            required
          />
          <select value={botId} onChange={(e) => setBotId(e.target.value)} className="w-full px-3 py-2 border border-default rounded-lg text-sm" required>
            <option value="">{t("automations.selectBot")}</option>
            {bots.map((b) => (
              <option key={b.botId} value={b.botId}>{b.name}</option>
            ))}
          </select>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select value={trigger} onChange={(e) => setTrigger(e.target.value as AutomationTrigger)} className="px-3 py-2 border border-default rounded-lg text-sm">
              {TRIGGERS.map((tr) => (
                <option key={tr} value={tr}>{t(`automations.trigger_${tr}` as "automations.trigger_keyword") || tr}</option>
              ))}
            </select>
            <select value={action} onChange={(e) => setAction(e.target.value as AutomationAction)} className="px-3 py-2 border border-default rounded-lg text-sm">
              {ACTIONS.map((ac) => (
                <option key={ac} value={ac}>{ac}</option>
              ))}
            </select>
          </div>
          {trigger === "keyword" && (
            <input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder={t("automations.keywordsPlaceholder")}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm"
            />
          )}
          {trigger === "flow_completed" && (
            <input
              value={metaFlowId}
              onChange={(e) => setMetaFlowId(e.target.value)}
              placeholder={t("automations.metaFlowPlaceholder")}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm"
            />
          )}
          {action === "send_text" && (
            <LocalizedTextField value={messageText} onChange={setMessageText} rows={3} />
          )}
          {action === "tag_contact" && (
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t("automations.tagsPlaceholder")}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm"
            />
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={createRule.isPending} className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg">
              {t("common.create")}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-secondary">
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      <div className="bg-surface-elevated rounded-xl border border-default overflow-hidden">
        {isLoading ? (
          <div className="p-6 animate-pulse h-32" />
        ) : rules.length === 0 ? (
          <div className="p-12 text-center text-secondary">
            <Zap className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p>{t("automations.empty")}</p>
          </div>
        ) : (
          <TableContainer>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface border-b border-default">
              <tr className="text-left text-secondary">
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
                      className={`px-2 py-0.5 rounded text-xs font-medium ${rule.enabled ? "bg-green-100 text-green-700" : "bg-surface-muted text-secondary"}`}
                    >
                      {rule.enabled ? t("common.active") : t("common.inactive")}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => deleteRule.mutate(rule.ruleId)}
                      className="p-1 text-muted hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </TableContainer>
        )}
      </div>
    </DashboardPage>
  );
}
