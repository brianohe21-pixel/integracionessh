"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useT } from "@/i18n/context";
import { useMetaFlows } from "@/hooks/useMetaFlows";
import { MetaFlowsModal } from "@/components/meta-flows/MetaFlowsModal";
import { Button } from "@/components/ui/Button";
import type { FlowNode, FlowNodeType } from "@/types";

interface NodePropertiesPanelProps {
  selected: FlowNode | undefined;
  botId: string;
  onUpdate: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  canDelete: boolean;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-secondary mb-1">{children}</label>;
}

function textInput(
  value: string,
  onChange: (v: string) => void,
  props?: React.InputHTMLAttributes<HTMLInputElement>
) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm border border-default rounded-lg p-2"
      {...props}
    />
  );
}

function textArea(
  value: string,
  onChange: (v: string) => void,
  rows = 3,
  placeholder?: string
) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full text-sm border border-default rounded-lg p-2"
    />
  );
}

export function NodePropertiesPanel({
  selected,
  botId,
  onUpdate,
  onDelete,
  canDelete,
}: NodePropertiesPanelProps) {
  const t = useT();
  const { data: metaFlows } = useMetaFlows(botId);
  const [metaFlowsModalOpen, setMetaFlowsModalOpen] = useState(false);

  if (!selected) {
    return (
      <div className="pt-2">
        <p className="text-sm font-semibold text-primary">{t("flows.nodePanel")}</p>
        <p className="mt-3 text-sm text-secondary">{t("flows.selectNode")}</p>
      </div>
    );
  }

  const type = selected.type as FlowNodeType;
  const d = selected.data;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-primary">{t("flows.nodePanel")}</p>
          <p className="text-xs text-secondary mt-0.5">{t(`flows.nodeTypes.${type}`)}</p>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-red-600 hover:underline shrink-0"
          >
            {t("flows.deleteNode")}
          </button>
        )}
      </div>

      <div>
        <FieldLabel>{t("flows.fields.label")}</FieldLabel>
        {textInput(d.label ?? "", (v) => onUpdate({ label: v }))}
      </div>

      {type === "trigger" && (
        <>
          <div>
            <FieldLabel>{t("flows.fields.triggerType")}</FieldLabel>
            <select
              value={d.triggerType ?? "any_message"}
              onChange={(e) => onUpdate({ triggerType: e.target.value })}
              className="w-full text-sm border border-default rounded-lg p-2 bg-surface-elevated"
            >
              <option value="any_message">{t("flows.fields.triggerAnyMessage")}</option>
              <option value="first_message">{t("flows.fields.triggerFirstMessage")}</option>
              <option value="keyword">{t("flows.fields.triggerKeyword")}</option>
            </select>
          </div>
          {(d.triggerType ?? "any_message") === "keyword" && (
            <>
              <div>
                <FieldLabel>{t("flows.fields.keywords")}</FieldLabel>
                {textInput((d.keywords ?? []).join(", "), (v) =>
                  onUpdate({
                    keywords: v
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                )}
              </div>
              <div>
                <FieldLabel>{t("flows.fields.matchMode")}</FieldLabel>
                <select
                  value={d.matchMode ?? "contains"}
                  onChange={(e) => onUpdate({ matchMode: e.target.value })}
                  className="w-full text-sm border border-default rounded-lg p-2 bg-surface-elevated"
                >
                  <option value="contains">{t("flows.fields.matchContains")}</option>
                  <option value="exact">{t("flows.fields.matchExact")}</option>
                </select>
              </div>
            </>
          )}
        </>
      )}

      {type === "message" && (
        <div>
          <FieldLabel>{t("flows.fields.messageText")}</FieldLabel>
          {textArea(d.messageText ?? "", (v) => onUpdate({ messageText: v }), 4)}
        </div>
      )}

      {type === "template" && (
        <>
          <div>
            <FieldLabel>{t("flows.fields.templateName")}</FieldLabel>
            {textInput(d.templateName ?? "", (v) => onUpdate({ templateName: v }))}
          </div>
          <div>
            <FieldLabel>{t("flows.fields.templateLanguage")}</FieldLabel>
            {textInput(d.templateLanguage ?? "es", (v) => onUpdate({ templateLanguage: v }))}
          </div>
          <div>
            <FieldLabel>{t("flows.fields.templateVariables")}</FieldLabel>
            {textArea(
              d.templateVariables ? JSON.stringify(d.templateVariables, null, 2) : "{}",
              (v) => {
                try {
                  onUpdate({ templateVariables: JSON.parse(v || "{}") });
                } catch {
                  /* ignore invalid json while typing */
                }
              },
              3
            )}
          </div>
        </>
      )}

      {type === "condition" && (
        <>
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">{t("flows.hints.conditionBranches")}</p>
          <div>
            <FieldLabel>{t("flows.fields.conditionVariable")}</FieldLabel>
            {textInput(d.conditionVariable ?? "last_input", (v) =>
              onUpdate({ conditionVariable: v })
            )}
          </div>
          <div>
            <FieldLabel>{t("flows.fields.conditionOperator")}</FieldLabel>
            <select
              value={d.conditionOperator ?? "contains"}
              onChange={(e) => onUpdate({ conditionOperator: e.target.value })}
              className="w-full text-sm border border-default rounded-lg p-2 bg-surface-elevated"
            >
              <option value="contains">{t("flows.fields.opContains")}</option>
              <option value="equals">{t("flows.fields.opEquals")}</option>
              <option value="not_equals">{t("flows.fields.opNotEquals")}</option>
            </select>
          </div>
          <div>
            <FieldLabel>{t("flows.fields.conditionValue")}</FieldLabel>
            {textInput(d.conditionValue ?? "", (v) => onUpdate({ conditionValue: v }))}
          </div>
        </>
      )}

      {type === "buttons" && (
        <>
          <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2">{t("flows.hints.buttonBranches")}</p>
          <div>
            <FieldLabel>{t("flows.fields.messageText")}</FieldLabel>
            {textArea(d.messageText ?? "", (v) => onUpdate({ messageText: v }), 2)}
          </div>
          {(d.buttons ?? [{ id: "btn-1", title: "" }]).map((btn, i) => (
            <div key={btn.id} className="space-y-1 border border-subtle rounded-lg p-2">
              <p className="text-xs text-secondary">{t("flows.fields.button")} {i + 1}</p>
              <FieldLabel>{t("flows.fields.buttonId")}</FieldLabel>
              {textInput(btn.id, (v) => {
                const buttons = [...(d.buttons ?? [])];
                buttons[i] = { ...buttons[i], id: v };
                onUpdate({ buttons });
              })}
              <FieldLabel>{t("flows.fields.buttonTitle")}</FieldLabel>
              {textInput(btn.title, (v) => {
                const buttons = [...(d.buttons ?? [])];
                buttons[i] = { ...buttons[i], title: v };
                onUpdate({ buttons });
              })}
            </div>
          ))}
          {(d.buttons?.length ?? 1) < 3 && (
            <button
              type="button"
              onClick={() =>
                onUpdate({
                  buttons: [
                    ...(d.buttons ?? [{ id: "btn-1", title: "" }]),
                    { id: `btn-${Date.now()}`, title: "" },
                  ],
                })
              }
              className="text-xs text-accent hover:underline"
            >
              {t("flows.fields.addButton")}
            </button>
          )}
        </>
      )}

      {type === "meta_flow" && (
        <>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => setMetaFlowsModalOpen(true)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("metaFlows.openManager")}
          </Button>
          <div>
            <FieldLabel>{t("flows.fields.metaFlowId")}</FieldLabel>
            <select
              value={d.metaFlowId ?? ""}
              onChange={(e) => onUpdate({ metaFlowId: e.target.value })}
              className="w-full text-sm border border-default rounded-lg p-2 bg-surface-elevated"
            >
              <option value="">—</option>
              {metaFlows?.map((mf) => (
                <option key={mf.metaFlowId} value={mf.metaFlowId}>
                  {mf.name}
                  {mf.status !== "PUBLISHED" ? ` (${mf.status})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>{t("flows.fields.metaFlowCta")}</FieldLabel>
            {textInput(d.metaFlowCta ?? "", (v) => onUpdate({ metaFlowCta: v }), {
              placeholder: t("metaFlows.ctaPlaceholder"),
            })}
          </div>
          {metaFlowsModalOpen && (
            <MetaFlowsModal
              botId={botId}
              selectedFlowId={d.metaFlowId}
              onClose={() => setMetaFlowsModalOpen(false)}
              onSelect={(metaFlowId) => onUpdate({ metaFlowId })}
              onFlowDeleted={(metaFlowId) => {
                if (d.metaFlowId === metaFlowId) onUpdate({ metaFlowId: "" });
              }}
            />
          )}
        </>
      )}

      {type === "handoff" && (
        <label className="flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            checked={d.haltPipeline !== false}
            onChange={(e) => onUpdate({ haltPipeline: e.target.checked })}
          />
          {t("flows.fields.haltPipeline")}
        </label>
      )}

      {type === "delay" && (
        <div>
          <FieldLabel>{t("flows.fields.delaySeconds")}</FieldLabel>
          {textInput(String(d.delaySeconds ?? 5), (v) => onUpdate({ delaySeconds: Number(v) || 1 }), {
            type: "number",
            min: 1,
          })}
        </div>
      )}

      {type === "set_variable" && (
        <>
          <div>
            <FieldLabel>{t("flows.fields.variableName")}</FieldLabel>
            {textInput(d.variableName ?? "", (v) => onUpdate({ variableName: v }))}
          </div>
          <div>
            <FieldLabel>{t("flows.fields.variableValue")}</FieldLabel>
            {textInput(d.variableValue ?? "", (v) => onUpdate({ variableValue: v }), {
              placeholder: t("flows.fields.variableValueHint"),
            })}
          </div>
        </>
      )}

      {type === "http_request" && (
        <>
          <div>
            <FieldLabel>{t("flows.fields.httpUrl")}</FieldLabel>
            {textInput(d.httpUrl ?? "", (v) => onUpdate({ httpUrl: v }))}
          </div>
          <div>
            <FieldLabel>{t("flows.fields.httpMethod")}</FieldLabel>
            <select
              value={d.httpMethod ?? "GET"}
              onChange={(e) => onUpdate({ httpMethod: e.target.value })}
              className="w-full text-sm border border-default rounded-lg p-2 bg-surface-elevated"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </div>
          <div>
            <FieldLabel>{t("flows.fields.httpBody")}</FieldLabel>
            {textArea(d.httpBody ?? "", (v) => onUpdate({ httpBody: v }), 4)}
          </div>
        </>
      )}

      {type === "book_appointment" && (
        <>
          <div>
            <FieldLabel>{t("flows.fields.maxDaysToShow")}</FieldLabel>
            {textInput(String(d.maxDaysToShow ?? 7), (v) =>
              onUpdate({ maxDaysToShow: Number(v) || 7 }), { type: "number", min: 1, max: 14 })}
          </div>
          <div>
            <FieldLabel>{t("flows.fields.confirmationMessage")}</FieldLabel>
            {textArea(d.confirmationMessage ?? "", (v) => onUpdate({ confirmationMessage: v }), 3)}
          </div>
        </>
      )}

      {type === "request_payment" && (
        <>
          <div>
            <FieldLabel>{t("flows.fields.amountInCents")}</FieldLabel>
            {textInput(String(d.amountInCents ?? 50000), (v) =>
              onUpdate({ amountInCents: Number(v) || 0 }), { type: "number", min: 1000 })}
          </div>
          <div>
            <FieldLabel>{t("flows.fields.paymentDescription")}</FieldLabel>
            {textInput(d.paymentDescription ?? "", (v) => onUpdate({ paymentDescription: v }))}
          </div>
          <div>
            <FieldLabel>{t("flows.fields.paymentMessageTemplate")}</FieldLabel>
            {textArea(d.paymentMessageTemplate ?? "", (v) =>
              onUpdate({ paymentMessageTemplate: v }), 3)}
          </div>
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              checked={d.waitForPayment ?? false}
              onChange={(e) => onUpdate({ waitForPayment: e.target.checked })}
            />
            {t("flows.fields.waitForPayment")}
          </label>
        </>
      )}

      {type === "send_catalog" && (
        <div>
          <FieldLabel>{t("flows.fields.catalogMessageText")}</FieldLabel>
          {textArea(d.catalogMessageText ?? "", (v) => onUpdate({ catalogMessageText: v }), 3)}
        </div>
      )}

      {type === "send_products" && (
        <>
          <div>
            <FieldLabel>{t("flows.fields.messageText")}</FieldLabel>
            {textArea(d.messageText ?? "", (v) => onUpdate({ messageText: v }), 2)}
          </div>
          <div>
            <FieldLabel>{t("flows.fields.productRetailerIds")}</FieldLabel>
            {textInput((d.productRetailerIds ?? []).join(", "), (v) =>
              onUpdate({
                productRetailerIds: v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            )}
          </div>
        </>
      )}

      {type === "await_order" && (
        <div>
          <FieldLabel>{t("flows.fields.messageText")}</FieldLabel>
          {textArea(d.messageText ?? "", (v) => onUpdate({ messageText: v }), 3)}
        </div>
      )}

      {type === "end" && (
        <label className="flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            checked={d.haltPipeline !== false}
            onChange={(e) => onUpdate({ haltPipeline: e.target.checked })}
          />
          {t("flows.fields.haltPipeline")}
        </label>
      )}
    </div>
  );
}
