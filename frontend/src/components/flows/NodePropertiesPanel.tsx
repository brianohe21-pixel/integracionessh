"use client";

import { useState } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import { useT } from "@/i18n/context";
import { useMetaFlows } from "@/hooks/useMetaFlows";
import { useBots } from "@/hooks/useBots";
import { useTenantEmailSettings } from "@/hooks/useTenantEmailSettings";
import { MetaFlowsModal } from "@/components/meta-flows/MetaFlowsModal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { LocalizedTextField } from "@/components/ui/LocalizedTextField";
import { LocalizedHtmlField } from "@/components/ui/LocalizedHtmlField";
import type { FlowNode, FlowNodeType, LocalizedText } from "@/types";
import { extractSampleFields, FormBindingField } from "./FormBindingField";
import { FlowWebhookPanel } from "./FlowWebhookPanel";
import { FlowWebhookGuideAccordion } from "./FlowWebhookGuideAccordion";
import { TemplatePicker } from "@/components/templates/TemplatePicker";
import type { OutreachChannel } from "@/types";

interface NodePropertiesPanelProps {
  selected: FlowNode | undefined;
  flowId: string;
  hasWebhookNode?: boolean;
  isMessagingFlow?: boolean;
  botId: string;
  isVoiceFlow?: boolean;
  samplePayload?: Record<string, unknown>;
  onUpdate: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  canDelete: boolean;
  hideHeader?: boolean;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-primary mb-2">{children}</label>;
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
      className="w-full text-sm border border-field-border rounded-lg px-3 py-2.5 bg-surface-elevated shadow-sm transition-all focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
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
      className="w-full text-sm border border-field-border rounded-lg px-3 py-2.5 bg-surface-elevated shadow-sm transition-all focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none resize-y"
    />
  );
}

export function NodePropertiesPanel({
  selected,
  flowId,
  hasWebhookNode = false,
  isMessagingFlow = false,
  botId,
  isVoiceFlow = false,
  samplePayload,
  onUpdate,
  onDelete,
  canDelete,
  hideHeader = false,
}: NodePropertiesPanelProps) {
  const t = useT();
  const { data: metaFlows } = useMetaFlows(botId);
  const { data: bots } = useBots();
  const [metaFlowsModalOpen, setMetaFlowsModalOpen] = useState(false);

  const isEmailNotification =
    selected?.type === "send_notification" &&
    (selected.data.notificationChannel ?? "whatsapp") === "email";
  const { data: tenantEmailSettings } = useTenantEmailSettings(isEmailNotification);

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
  const sampleFields = extractSampleFields(samplePayload);

  const localizedField = (
    value: LocalizedText | undefined,
    onChange: (v: LocalizedText) => void,
    rows = 3,
    sampleFieldsForField?: string[],
    hint?: string
  ) => (
    <LocalizedTextField
      value={value}
      onChange={onChange}
      rows={rows}
      sampleFields={sampleFieldsForField}
      hint={hint}
    />
  );

  const localizedHtmlField = (
    value: LocalizedText | undefined,
    onChange: (v: LocalizedText) => void,
    sampleFieldsForField?: string[],
    hint?: string
  ) => (
    <LocalizedHtmlField
      value={value}
      onChange={onChange}
      sampleFields={sampleFieldsForField}
      hint={hint}
    />
  );

  return (
    <div className="space-y-6">
      {hideHeader ? null : (
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
      )}

      <div className="rounded-xl border border-field-border bg-surface-muted/30 p-4">
        <FieldLabel>{t("flows.fields.label")}</FieldLabel>
        {textInput(d.label ?? "", (v) => onUpdate({ label: v }))}
      </div>

      {type === "trigger" && (
        <>
          {isVoiceFlow && (
            <div>
              <FieldLabel>{t("flows.fields.flowVariables")}</FieldLabel>
              {textArea(
                JSON.stringify(d.flowVariables ?? {}, null, 2),
                (v) => {
                  try {
                    onUpdate({ flowVariables: JSON.parse(v || "{}") });
                  } catch {
                    /* ignore invalid json while typing */
                  }
                },
                5,
                t("flows.fields.flowVariablesHint")
              )}
            </div>
          )}
          {isMessagingFlow && (
            <>
              <label className="flex items-center gap-2 text-sm text-secondary">
                <input
                  type="checkbox"
                  checked={(d.triggerType ?? "any_message") === "first_message"}
                  onChange={(e) =>
                    onUpdate({ triggerType: e.target.checked ? "first_message" : "any_message" })
                  }
                />
                {t("flows.fields.triggerFirstMessage")}
              </label>
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
              {(d.keywords ?? []).length > 0 && (
                <div>
                  <FieldLabel>{t("flows.fields.matchMode")}</FieldLabel>
                  <select
                    value={d.matchMode ?? "contains"}
                    onChange={(e) => onUpdate({ matchMode: e.target.value })}
                    className="w-full text-sm border border-field-border rounded-lg p-2 bg-surface-elevated shadow-sm"
                  >
                    <option value="contains">{t("flows.fields.matchContains")}</option>
                    <option value="exact">{t("flows.fields.matchExact")}</option>
                  </select>
                </div>
              )}
            </>
          )}
          {hasWebhookNode && (
            <p className="text-xs text-secondary">{t("flows.fields.triggerWebhookHint")}</p>
          )}
        </>
      )}

      {type === "message" && (
        <div>
          <FieldLabel>{t("flows.fields.messageText")}</FieldLabel>
          {localizedField(d.messageText, (v) => onUpdate({ messageText: v }), 4)}
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
              className="w-full text-sm border border-field-border rounded-lg p-2 bg-surface-elevated shadow-sm"
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
            {localizedField(d.messageText, (v) => onUpdate({ messageText: v }), 2)}
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
              {localizedField(btn.title, (v) => {
                const buttons = [...(d.buttons ?? [])];
                buttons[i] = { ...buttons[i], title: v };
                onUpdate({ buttons });
              }, 2)}
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
          {!botId ? (
            <p className="text-xs text-warning">{t("flows.bot.requiredHint")}</p>
          ) : (
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
              className="w-full text-sm border border-field-border rounded-lg p-2 bg-surface-elevated shadow-sm"
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
            {localizedField(d.metaFlowCta, (v) => onUpdate({ metaFlowCta: v }), 1)}
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
              className="w-full text-sm border border-field-border rounded-lg p-2 bg-surface-elevated shadow-sm"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
          <div>
            <FieldLabel>{t("flows.fields.httpHeaders")}</FieldLabel>
            {textArea(
              JSON.stringify(d.httpHeaders ?? [], null, 2),
              (v) => {
                try {
                  onUpdate({ httpHeaders: JSON.parse(v || "[]") });
                } catch {
                  /* ignore invalid json while typing */
                }
              },
              4,
              t("flows.fields.httpHeadersHint")
            )}
          </div>
          <div>
            <FieldLabel>{t("flows.fields.httpBody")}</FieldLabel>
            {textArea(d.httpBody ?? "", (v) => onUpdate({ httpBody: v }), 4)}
          </div>
          {isVoiceFlow ? (
            <>
              <div>
                <FieldLabel>{t("flows.fields.voiceToolName")}</FieldLabel>
                {textInput(d.voiceToolName ?? "", (v) => onUpdate({ voiceToolName: v }))}
              </div>
              <div>
                <FieldLabel>{t("flows.fields.voiceToolDescription")}</FieldLabel>
                {textArea(d.voiceToolDescription ?? "", (v) => onUpdate({ voiceToolDescription: v }), 2)}
              </div>
              <div>
                <FieldLabel>{t("flows.fields.voiceToolParameters")}</FieldLabel>
                {textArea(d.voiceToolParameters ?? "", (v) => onUpdate({ voiceToolParameters: v }), 4)}
              </div>
              <div>
                <FieldLabel>{t("flows.fields.voiceInstruction")}</FieldLabel>
                {textArea(d.voiceInstruction ?? "", (v) => onUpdate({ voiceInstruction: v }), 3)}
              </div>
              <div>
                <FieldLabel>{t("flows.fields.httpResponseVariable")}</FieldLabel>
                {textInput(d.httpResponseVariable ?? "", (v) => onUpdate({ httpResponseVariable: v }))}
              </div>
            </>
          ) : null}
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
            {localizedField(d.confirmationMessage, (v) => onUpdate({ confirmationMessage: v }), 3)}
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
            {localizedField(d.paymentDescription, (v) => onUpdate({ paymentDescription: v }), 1)}
          </div>
          <div>
            <FieldLabel>{t("flows.fields.paymentMessageTemplate")}</FieldLabel>
            {localizedField(d.paymentMessageTemplate, (v) => onUpdate({ paymentMessageTemplate: v }), 3)}
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
          {localizedField(d.catalogMessageText, (v) => onUpdate({ catalogMessageText: v }), 3)}
        </div>
      )}

      {type === "send_products" && (
        <>
          <div>
            <FieldLabel>{t("flows.fields.messageText")}</FieldLabel>
            {localizedField(d.messageText, (v) => onUpdate({ messageText: v }), 2)}
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
          {localizedField(d.messageText, (v) => onUpdate({ messageText: v }), 3)}
        </div>
      )}

      {type === "save_contact" && (
        <>
          <FormBindingField
            label={t("flows.fields.contactPhoneBinding")}
            value={d.contactPhoneBinding ?? ""}
            onChange={(v) => onUpdate({ contactPhoneBinding: v })}
            sampleFields={sampleFields}
          />
          <FormBindingField
            label={t("flows.fields.contactNameBinding")}
            value={d.contactNameBinding ?? ""}
            onChange={(v) => onUpdate({ contactNameBinding: v })}
            sampleFields={sampleFields}
          />
          <FormBindingField
            label={t("flows.fields.contactEmailBinding")}
            value={d.contactEmailBinding ?? ""}
            onChange={(v) => onUpdate({ contactEmailBinding: v })}
            sampleFields={sampleFields}
          />
          <div>
            <FieldLabel>{t("flows.fields.contactTags")}</FieldLabel>
            {textInput((d.contactTags ?? []).join(", "), (v) =>
              onUpdate({
                contactTags: v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            )}
          </div>
        </>
      )}

      {type === "create_lead" && (
        <>
          <FormBindingField
            label={t("flows.fields.leadPhoneBinding")}
            value={d.leadPhoneBinding ?? ""}
            onChange={(v) => onUpdate({ leadPhoneBinding: v })}
            sampleFields={sampleFields}
          />
          <FormBindingField
            label={t("flows.fields.leadNameBinding")}
            value={d.leadNameBinding ?? ""}
            onChange={(v) => onUpdate({ leadNameBinding: v })}
            sampleFields={sampleFields}
          />
          <FormBindingField
            label={t("flows.fields.leadEmailBinding")}
            value={d.leadEmailBinding ?? ""}
            onChange={(v) => onUpdate({ leadEmailBinding: v })}
            sampleFields={sampleFields}
          />
          <div>
            <FieldLabel>{t("flows.fields.leadTags")}</FieldLabel>
            {textInput((d.leadTags ?? []).join(", "), (v) =>
              onUpdate({
                leadTags: v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            )}
          </div>
        </>
      )}

      {type === "create_opportunity" && (
        <>
          <FormBindingField
            label={t("flows.fields.opportunityTitleBinding")}
            value={d.opportunityTitleBinding ?? ""}
            onChange={(v) => onUpdate({ opportunityTitleBinding: v })}
            sampleFields={sampleFields}
          />
          <FormBindingField
            label={t("flows.fields.opportunityAmountBinding")}
            value={d.opportunityAmountBinding ?? ""}
            onChange={(v) => onUpdate({ opportunityAmountBinding: v })}
            sampleFields={sampleFields}
          />
          <div>
            <FieldLabel>{t("flows.fields.opportunityCurrency")}</FieldLabel>
            <Select
              value={d.opportunityCurrency ?? "USD"}
              onChange={(e) => onUpdate({ opportunityCurrency: e.target.value })}
            >
              {["USD", "EUR", "GBP", "PEN", "COP", "MXN"].map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel>{t("flows.fields.opportunityStage")}</FieldLabel>
            <Select
              value={d.opportunityStage ?? "new"}
              onChange={(e) => onUpdate({ opportunityStage: e.target.value })}
            >
              <option value="new">{t("flows.fields.opportunityStageNew")}</option>
              <option value="quoted">{t("flows.fields.opportunityStageQuoted")}</option>
              <option value="negotiation">{t("flows.fields.opportunityStageNegotiation")}</option>
              <option value="won">{t("flows.fields.opportunityStageWon")}</option>
              <option value="lost">{t("flows.fields.opportunityStageLost")}</option>
            </Select>
          </div>
          <FormBindingField
            label={t("flows.fields.opportunityPhoneBinding")}
            value={d.opportunityPhoneBinding ?? ""}
            onChange={(v) => onUpdate({ opportunityPhoneBinding: v })}
            sampleFields={sampleFields}
          />
          <FormBindingField
            label={t("flows.fields.opportunityNameBinding")}
            value={d.opportunityNameBinding ?? ""}
            onChange={(v) => onUpdate({ opportunityNameBinding: v })}
            sampleFields={sampleFields}
          />
          <FormBindingField
            label={t("flows.fields.opportunityEmailBinding")}
            value={d.opportunityEmailBinding ?? ""}
            onChange={(v) => onUpdate({ opportunityEmailBinding: v })}
            sampleFields={sampleFields}
          />
          <FormBindingField
            label={t("flows.fields.opportunityDescriptionBinding")}
            value={d.opportunityDescriptionBinding ?? ""}
            onChange={(v) => onUpdate({ opportunityDescriptionBinding: v })}
            sampleFields={sampleFields}
          />
          <div>
            <FieldLabel>{t("flows.fields.opportunityTags")}</FieldLabel>
            {textInput((d.opportunityTags ?? []).join(", "), (v) =>
              onUpdate({
                opportunityTags: v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            )}
          </div>
        </>
      )}

      {type === "send_notification" && (
        <>
          <div>
            <FieldLabel>{t("flows.fields.notificationChannel")}</FieldLabel>
            <div className="grid grid-cols-3 gap-1.5">
              {(["whatsapp", "sms", "email"] as const).map((ch) => {
                const active = (d.notificationChannel ?? "whatsapp") === ch;
                const labels: Record<string, string> = { whatsapp: "WhatsApp", sms: "SMS", email: "Email" };
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => {
                      const patch: Record<string, unknown> = { notificationChannel: ch };
                      if (
                        ch === "email" &&
                        !d.notificationRecipientBindings?.length &&
                        d.notificationRecipientBinding?.trim()
                      ) {
                        patch.notificationRecipientBindings = [d.notificationRecipientBinding];
                      }
                      onUpdate(patch);
                    }}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-all ${
                      active
                        ? "border-accent bg-accent text-white"
                        : "border-field-border bg-surface-elevated text-secondary hover:border-accent/50"
                    }`}
                  >
                    {labels[ch]}
                  </button>
                );
              })}
            </div>
          </div>

          {(d.notificationChannel ?? "whatsapp") !== "email" && (
            <div>
              <FieldLabel>{t("flows.fields.notificationBot")}</FieldLabel>
              <Select
                value={d.notificationBotId ?? ""}
                onChange={(e) =>
                  onUpdate({
                    notificationBotId: e.target.value,
                    notificationTemplateName: "",
                    notificationTemplateLanguage: "es",
                  })
                }
              >
                <option value="">{t("flows.fields.notificationBotPlaceholder")}</option>
                {(bots ?? [])
                  .filter((bot) =>
                    (d.notificationChannel ?? "whatsapp") === "sms" ? bot.smsEnabled : true
                  )
                  .map((bot) => (
                    <option key={bot.botId} value={bot.botId}>
                      {bot.name}
                    </option>
                  ))}
              </Select>
            </div>
          )}

          {(d.notificationChannel ?? "whatsapp") === "email" ? (
            <div className="space-y-2">
              <FieldLabel>{t("flows.fields.notificationRecipients")}</FieldLabel>
              {(d.notificationRecipientBindings?.length
                ? d.notificationRecipientBindings
                : d.notificationRecipientBinding
                  ? [d.notificationRecipientBinding]
                  : [""]).map((binding, index, bindings) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <FormBindingField
                      label={index === 0 ? t("flows.fields.notificationRecipientBinding") : ""}
                      value={binding}
                      onChange={(value) => {
                        const next = [...bindings];
                        next[index] = value;
                        onUpdate({
                          notificationRecipientBindings: next,
                          notificationRecipientBinding: next[0] ?? "",
                        });
                      }}
                      sampleFields={sampleFields}
                    />
                  </div>
                  {bindings.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const next = bindings.filter((_, itemIndex) => itemIndex !== index);
                        onUpdate({
                          notificationRecipientBindings: next,
                          notificationRecipientBinding: next[0] ?? "",
                        });
                      }}
                      className={`rounded-lg border border-default p-2 text-secondary hover:bg-surface-muted ${
                        index === 0 ? "mt-6" : "mt-1.5"
                      }`}
                      aria-label={t("flows.fields.notificationRemoveRecipient")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const current = d.notificationRecipientBindings?.length
                    ? d.notificationRecipientBindings
                    : d.notificationRecipientBinding
                      ? [d.notificationRecipientBinding]
                      : [];
                  const next = [...current, ""];
                  onUpdate({
                    notificationRecipientBindings: next,
                    notificationRecipientBinding: next[0] ?? "",
                  });
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("flows.fields.notificationAddRecipient")}
              </button>
              <p className="text-xs text-secondary">{t("flows.fields.notificationRecipientsHint")}</p>
            </div>
          ) : (
            <FormBindingField
              label={t("flows.fields.notificationRecipientBinding")}
              value={d.notificationRecipientBinding ?? ""}
              onChange={(v) => onUpdate({ notificationRecipientBinding: v })}
              sampleFields={sampleFields}
            />
          )}

          {(d.notificationChannel ?? "whatsapp") === "email" && (
            <>
              <p className="text-xs text-secondary rounded-lg bg-surface-muted/60 px-3 py-2">
                {tenantEmailSettings?.canSend
                  ? t("flows.fields.notificationEmailSenderTenant", {
                      sender:
                        tenantEmailSettings.settings.fromName && tenantEmailSettings.settings.fromEmail
                          ? `${tenantEmailSettings.settings.fromName} (${tenantEmailSettings.settings.fromEmail})`
                          : tenantEmailSettings.settings.fromEmail ?? "",
                    })
                  : t("flows.fields.notificationEmailSenderPlatform")}
              </p>
              <div>
                <FieldLabel>{t("flows.fields.notificationEmailSubject")}</FieldLabel>
                {textInput(d.notificationEmailSubject ?? "", (v) => onUpdate({ notificationEmailSubject: v }), {
                  placeholder: "Asunto del correo",
                })}
              </div>
            </>
          )}

          {(d.notificationChannel ?? "whatsapp") !== "email" && (
          <div>
            <FieldLabel>{t("flows.fields.notificationMessageType")}</FieldLabel>
            <div className="flex gap-2">
              {(["text", "template"] as const).map((mt) => {
                const active = (d.notificationMessageType ?? "text") === mt;
                return (
                  <button
                    key={mt}
                    type="button"
                    onClick={() => onUpdate({ notificationMessageType: mt })}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all ${
                      active
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-field-border bg-surface-elevated text-secondary hover:border-accent/40"
                    }`}
                  >
                    {mt === "text"
                      ? t("flows.fields.notificationMessageTypeText")
                      : t("flows.fields.notificationMessageTypeTemplate")}
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {(d.notificationChannel ?? "whatsapp") === "email" ||
          (d.notificationMessageType ?? "text") === "text" ? (
            <>
              <div>
                <FieldLabel>
                  {(d.notificationChannel ?? "whatsapp") === "email"
                    ? t("flows.fields.notificationEmailBody")
                    : t("flows.fields.notificationMessage")}
                </FieldLabel>
                {(d.notificationChannel ?? "whatsapp") === "email"
                  ? localizedHtmlField(
                      d.notificationMessageHtml || d.notificationMessageBinding || "",
                      (v) => onUpdate({ notificationMessageHtml: v, notificationMessageBinding: "" }),
                      sampleFields,
                      t("flows.fields.notificationMessageHint")
                    )
                  : localizedField(
                      d.notificationMessageText || d.notificationMessageBinding || "",
                      (v) => onUpdate({ notificationMessageText: v, notificationMessageBinding: "" }),
                      4,
                      sampleFields,
                      t("flows.fields.notificationMessageHint")
                    )}
              </div>
            </>
          ) : (
            <>
              {(d.notificationChannel ?? "whatsapp") !== "email" ? (
                <div>
                  <FieldLabel>{t("flows.fields.notificationTemplateName")}</FieldLabel>
                  <TemplatePicker
                    botId={d.notificationBotId ?? ""}
                    channel={(d.notificationChannel ?? "whatsapp") as OutreachChannel}
                    value={
                      d.notificationTemplateName
                        ? {
                            name: d.notificationTemplateName,
                            language: d.notificationTemplateLanguage ?? "es",
                          }
                        : null
                    }
                    onChange={(picked) =>
                      onUpdate({
                        notificationTemplateName: picked.name,
                        notificationTemplateLanguage: picked.language,
                      })
                    }
                  />
                </div>
              ) : (
                <>
                  <div>
                    <FieldLabel>{t("flows.fields.notificationTemplateName")}</FieldLabel>
                    {textInput(d.notificationTemplateName ?? "", (v) => onUpdate({ notificationTemplateName: v }), {
                      placeholder: "nombre_de_la_plantilla",
                    })}
                  </div>
                  <div>
                    <FieldLabel>{t("flows.fields.notificationTemplateLanguage")}</FieldLabel>
                    {textInput(d.notificationTemplateLanguage ?? "es", (v) =>
                      onUpdate({ notificationTemplateLanguage: v })
                    )}
                  </div>
                </>
              )}
              <div>
                <FieldLabel>{t("flows.fields.notificationTemplateVariables")}</FieldLabel>
                {textArea(
                  d.notificationTemplateVariables
                    ? JSON.stringify(d.notificationTemplateVariables, null, 2)
                    : "{}",
                  (v) => {
                    try {
                      onUpdate({ notificationTemplateVariables: JSON.parse(v || "{}") });
                    } catch {
                      /* ignore invalid json while typing */
                    }
                  },
                  4,
                  '{ "1": "{{form.name}}", "2": "{{form.value}}" }'
                )}
              </div>
            </>
          )}
        </>
      )}

      {type === "assign_bot" && (
        <div>
          <FieldLabel>{t("flows.selectBot")}</FieldLabel>
          <Select value={d.botId ?? ""} onChange={(e) => onUpdate({ botId: e.target.value })}>
            <option value="">{t("flows.bot.placeholder")}</option>
            {bots?.map((bot) => (
              <option key={bot.botId} value={bot.botId}>
                {bot.name}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-secondary">{t("flows.fields.assignBotHint")}</p>
        </div>
      )}

      {type === "webhook" && (
        <>
          <FlowWebhookGuideAccordion
            flowId={flowId}
            samplePayload={
              d.formSamplePayload && typeof d.formSamplePayload === "object"
                ? (d.formSamplePayload as Record<string, unknown>)
                : undefined
            }
          />
          <FlowWebhookPanel
            flowId={flowId}
            samplePayload={
              d.formSamplePayload && typeof d.formSamplePayload === "object"
                ? (d.formSamplePayload as Record<string, unknown>)
                : undefined
            }
            showGuide={false}
          />
          <div>
            <FieldLabel>{t("flows.fields.samplePayload")}</FieldLabel>
            {textArea(
              d.formSamplePayload
                ? JSON.stringify(d.formSamplePayload, null, 2)
                : '{\n  "phone": "",\n  "name": "",\n  "email": ""\n}',
              (v) => {
                try {
                  onUpdate({ formSamplePayload: JSON.parse(v || "{}") });
                } catch {
                  /* ignore invalid json while typing */
                }
              },
              6
            )}
          </div>
        </>
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
