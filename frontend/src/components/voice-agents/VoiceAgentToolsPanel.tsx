"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Play, Plus, Trash2, Wrench, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useT } from "@/i18n/context";
import { api } from "@/lib/api";
import {
  useCreateVoiceAgentTool,
  useDeleteVoiceAgentTool,
  useSaveVoiceAgentToolSecret,
  useTestVoiceAgentTool,
  useUpdateVoiceAgentTool,
  useVoiceAgentToolSecrets,
  useVoiceAgentTools,
  type VoiceAgentHttpToolInput,
} from "@/hooks/useVoiceAgentTools";
import {
  DEFAULT_VOICE_TOOL_PARAMETERS,
  extractVoiceAgentToolSecretRefs,
} from "@/lib/voice-agent-tool-secret-refs";
import type { VoiceAgentHttpTool } from "@/types";

interface VoiceAgentToolsPanelProps {
  botId: string;
}

const EMPTY_FORM: VoiceAgentHttpToolInput = {
  name: "",
  description: "",
  httpUrl: "https://",
  httpMethod: "GET",
  httpBody: "",
  httpHeaders: [],
  httpResponseVariable: "",
  parametersJson: DEFAULT_VOICE_TOOL_PARAMETERS,
  instruction: "",
  enabled: true,
};

function parseHeadersJson(raw: string): Array<{ key: string; value: string }> {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as Array<{ key: string; value: string }>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function VoiceAgentToolsPanel({ botId }: VoiceAgentToolsPanelProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useVoiceAgentTools(botId);
  const { data: secretsData } = useVoiceAgentToolSecrets(botId);
  const createTool = useCreateVoiceAgentTool(botId);
  const deleteTool = useDeleteVoiceAgentTool(botId);
  const saveSecret = useSaveVoiceAgentToolSecret(botId);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<VoiceAgentHttpTool | null>(null);
  const [form, setForm] = useState<VoiceAgentHttpToolInput>(EMPTY_FORM);
  const [headersJson, setHeadersJson] = useState("[]");
  const [formError, setFormError] = useState("");

  const [testTool, setTestTool] = useState<VoiceAgentHttpTool | null>(null);
  const [testArgsJson, setTestArgsJson] = useState("{}");
  const [testResultJson, setTestResultJson] = useState("");
  const [testError, setTestError] = useState("");

  const [secretValues, setSecretValues] = useState<Record<string, string>>({});

  const tools = useMemo(() => data?.tools ?? [], [data?.tools]);
  const configuredSecrets = new Set((secretsData?.secrets ?? []).map((item) => item.name));

  const requiredSecrets = useMemo(
    () => extractVoiceAgentToolSecretRefs(form),
    [form]
  );

  const testMutation = useTestVoiceAgentTool(botId, testTool?.toolId ?? "");
  const updateMutation = useUpdateVoiceAgentTool(botId, editingTool?.toolId ?? "");

  function openCreate() {
    setEditingTool(null);
    setForm(EMPTY_FORM);
    setHeadersJson("[]");
    setFormError("");
    setEditorOpen(true);
  }

  function openEdit(tool: VoiceAgentHttpTool) {
    setEditingTool(tool);
    setForm({
      name: tool.name,
      description: tool.description,
      httpUrl: tool.httpUrl,
      httpMethod: tool.httpMethod,
      httpBody: tool.httpBody ?? "",
      httpHeaders: tool.httpHeaders ?? [],
      httpResponseVariable: tool.httpResponseVariable ?? "",
      parametersJson: tool.parametersJson || DEFAULT_VOICE_TOOL_PARAMETERS,
      instruction: tool.instruction ?? "",
      enabled: tool.enabled,
      sortOrder: tool.sortOrder,
    });
    setHeadersJson(JSON.stringify(tool.httpHeaders ?? [], null, 2));
    setFormError("");
    setEditorOpen(true);
  }

  async function handleSaveTool() {
    setFormError("");
    const headers = parseHeadersJson(headersJson);
    const payload: VoiceAgentHttpToolInput = {
      ...form,
      httpHeaders: headers,
      httpBody: form.httpBody?.trim() ? form.httpBody : undefined,
      httpResponseVariable: form.httpResponseVariable?.trim()
        ? form.httpResponseVariable
        : undefined,
      instruction: form.instruction?.trim() ? form.instruction : undefined,
    };

    try {
      if (editingTool) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createTool.mutateAsync(payload);
      }
      setEditorOpen(false);
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function handleDelete(toolId: string) {
    try {
      await deleteTool.mutateAsync(toolId);
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function handleToggleEnabled(tool: VoiceAgentHttpTool) {
    try {
      await api.put(
        `/bots/${encodeURIComponent(botId)}/telephony/tools/${encodeURIComponent(tool.toolId)}`,
        { enabled: !tool.enabled }
      );
      await queryClient.invalidateQueries({ queryKey: ["voice-agent-tools", botId] });
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  function openTest(tool: VoiceAgentHttpTool) {
    setTestTool(tool);
    setTestArgsJson("{}");
    setTestResultJson("");
    setTestError("");
  }

  async function handleRunTest() {
    if (!testTool) return;
    setTestError("");
    setTestResultJson("");
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(testArgsJson) as Record<string, unknown>;
    } catch {
      setTestError(t("voiceAgents.toolsTestArgsInvalid"));
      return;
    }
    try {
      const result = await testMutation.mutateAsync({ args });
      setTestResultJson(JSON.stringify(result, null, 2));
    } catch (err) {
      setTestError((err as Error).message);
    }
  }

  async function handleSaveSecrets() {
    for (const [name, value] of Object.entries(secretValues)) {
      if (!value.trim()) continue;
      await saveSecret.mutateAsync({ name, value: value.trim() });
    }
    setSecretValues({});
  }

  const allRequiredSecrets = useMemo(() => {
    const refs = new Set<string>();
    for (const tool of tools) {
      for (const name of extractVoiceAgentToolSecretRefs(tool)) {
        refs.add(name);
      }
    }
    return [...refs].sort();
  }, [tools]);

  const saving = createTool.isPending || updateMutation.isPending;

  return (
    <div className="content-card space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-accent" />
          <div>
            <h2 className="text-lg font-semibold text-primary">{t("voiceAgents.toolsTitle")}</h2>
            <p className="text-sm text-secondary">{t("voiceAgents.toolsSubtitle")}</p>
          </div>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t("voiceAgents.toolsAdd")}
        </Button>
      </div>

      {isError ? (
        <p className="text-sm text-danger">
          {(error as Error)?.message ?? t("voiceAgents.toolsLoadError")}
        </p>
      ) : isLoading ? (
        <div className="h-24 animate-pulse rounded bg-surface-muted" />
      ) : tools.length === 0 ? (
        <p className="text-sm text-secondary">{t("voiceAgents.toolsEmpty")}</p>
      ) : (
        <div className="space-y-3">
          {tools.map((tool) => (
            <div
              key={tool.toolId}
              className="rounded-xl border border-default bg-surface p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-primary">{tool.name}</p>
                    <Badge variant={tool.enabled ? "success" : "default"}>
                      {tool.enabled ? t("voiceAgents.toolsEnabled") : t("voiceAgents.toolsDisabled")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-secondary">{tool.description}</p>
                  <p className="mt-1 text-xs text-muted">
                    {tool.httpMethod} {tool.httpUrl}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => openTest(tool)}>
                    <Play className="h-4 w-4" />
                    {t("voiceAgents.toolsTest")}
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(tool)}>
                    {t("common.edit")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleToggleEnabled(tool)}
                  >
                    {tool.enabled ? t("voiceAgents.toolsDisable") : t("voiceAgents.toolsEnable")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDelete(tool.toolId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-default bg-surface-muted/40 p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-primary">{t("voiceAgents.toolsSecretsTitle")}</p>
          <p className="text-xs text-secondary mt-1">{t("voiceAgents.toolsSecretsHint")}</p>
        </div>
        {allRequiredSecrets.length === 0 ? (
          <p className="text-xs text-secondary">{t("voiceAgents.toolsSecretsEmpty")}</p>
        ) : (
          <div className="space-y-3">
            {allRequiredSecrets.map((name) => (
              <div key={name}>
                <label className="mb-1 flex items-center gap-2 text-xs font-medium text-secondary">
                  {name}
                  {configuredSecrets.has(name) ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  ) : null}
                </label>
                <input
                  type="password"
                  value={secretValues[name] ?? ""}
                  onChange={(e) =>
                    setSecretValues((current) => ({ ...current, [name]: e.target.value }))
                  }
                  className="w-full rounded-lg border border-default bg-surface-elevated p-2 text-sm"
                  placeholder={t("flows.secrets.placeholder")}
                  autoComplete="off"
                />
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void handleSaveSecrets()}
              disabled={saveSecret.isPending}
            >
              {t("flows.secrets.save")}
            </Button>
          </div>
        )}
      </div>

      {editorOpen ? (
        <Modal className="p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-default bg-surface-elevated shadow-xl">
            <div className="flex items-center justify-between border-b border-default px-6 py-4">
              <h2 className="text-lg font-semibold text-primary">
                {editingTool ? t("voiceAgents.toolsEdit") : t("voiceAgents.toolsAdd")}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-md p-1 text-muted hover:bg-surface-muted hover:text-secondary"
                aria-label={t("common.close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5 space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-secondary">{t("flows.fields.voiceToolName")}</span>
            <input
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
              className="w-full rounded-lg border border-default px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-secondary">
              {t("flows.fields.voiceToolDescription")}
            </span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-default px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-secondary">{t("flows.fields.httpUrl")}</span>
            <input
              value={form.httpUrl}
              onChange={(e) => setForm((current) => ({ ...current, httpUrl: e.target.value }))}
              className="w-full rounded-lg border border-default px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-secondary">{t("flows.fields.httpMethod")}</span>
            <select
              value={form.httpMethod}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  httpMethod: e.target.value as VoiceAgentHttpToolInput["httpMethod"],
                }))
              }
              className="w-full rounded-lg border border-default px-3 py-2 text-sm"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PATCH">PATCH</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-secondary">{t("flows.fields.httpHeaders")}</span>
            <textarea
              value={headersJson}
              onChange={(e) => setHeadersJson(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-default px-3 py-2 text-sm font-mono"
              placeholder={t("flows.fields.httpHeadersHint")}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-secondary">{t("flows.fields.httpBody")}</span>
            <textarea
              value={form.httpBody ?? ""}
              onChange={(e) => setForm((current) => ({ ...current, httpBody: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-default px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-secondary">
              {t("flows.fields.voiceToolParameters")}
            </span>
            <textarea
              value={form.parametersJson ?? DEFAULT_VOICE_TOOL_PARAMETERS}
              onChange={(e) => setForm((current) => ({ ...current, parametersJson: e.target.value }))}
              rows={4}
              className="w-full rounded-lg border border-default px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-secondary">
              {t("flows.fields.voiceInstruction")}
            </span>
            <textarea
              value={form.instruction ?? ""}
              onChange={(e) => setForm((current) => ({ ...current, instruction: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-default px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-secondary">
              {t("flows.fields.httpResponseVariable")}
            </span>
            <input
              value={form.httpResponseVariable ?? ""}
              onChange={(e) =>
                setForm((current) => ({ ...current, httpResponseVariable: e.target.value }))
              }
              className="w-full rounded-lg border border-default px-3 py-2 text-sm"
            />
          </label>
          {requiredSecrets.length > 0 && (
            <p className="text-xs text-secondary">
              {t("voiceAgents.toolsRequiredSecrets", {
                names: requiredSecrets.join(", "),
              })}
            </p>
          )}
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-default px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="button" onClick={() => void handleSaveTool()} disabled={saving}>
                {saving ? t("bots.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {testTool ? (
        <Modal className="p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-default bg-surface-elevated shadow-xl">
            <div className="flex items-center justify-between border-b border-default px-6 py-4">
              <h2 className="text-lg font-semibold text-primary">
                {t("voiceAgents.toolsTestTitle", { name: testTool.name })}
              </h2>
              <button
                type="button"
                onClick={() => setTestTool(null)}
                className="rounded-md p-1 text-muted hover:bg-surface-muted hover:text-secondary"
                aria-label={t("common.close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5 space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-secondary">{t("voiceAgents.toolsTestArgs")}</span>
            <textarea
              value={testArgsJson}
              onChange={(e) => setTestArgsJson(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-default px-3 py-2 text-sm font-mono"
            />
          </label>
          {testError ? <p className="text-sm text-danger">{testError}</p> : null}
          {testResultJson ? (
            <pre className="max-h-64 overflow-auto rounded-lg border border-default bg-surface-muted p-3 text-xs">
              {testResultJson}
            </pre>
          ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-default px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setTestTool(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void handleRunTest()}
                disabled={testMutation.isPending}
              >
                {testMutation.isPending ? t("voiceAgents.toolsTesting") : t("voiceAgents.toolsRunTest")}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
