import type { TemplateComponent, WhatsAppTemplate } from "@/types";
import { extractBodyVariables, sortBodyVariables } from "@/lib/templates/variables";

export type TemplateSendSlotKind = "header_text" | "body_text" | "button_url" | "auth_code";

export interface TemplateSendSlot {
  key: string;
  kind: TemplateSendSlotKind;
  placeholder: string;
  buttonIndex?: number;
  buttonText?: string;
}

export interface WhatsAppSendComponent {
  type: "header" | "body" | "button";
  sub_type?: "url";
  index?: string;
  parameters: Array<{ type: "text"; text: string }>;
}

type TemplateForSend = Pick<WhatsAppTemplate, "category" | "components">;

function componentType(component: TemplateComponent): string {
  return component.type.toUpperCase();
}

function placeholders(text: string | undefined): string[] {
  return sortBodyVariables(extractBodyVariables(text ?? ""));
}

export function isAuthenticationSendTemplate(template: TemplateForSend): boolean {
  if (template.category === "AUTHENTICATION") return true;
  return template.components.some(
    (component) =>
      typeof component.add_security_recommendation === "boolean" ||
      typeof component.code_expiration_minutes === "number" ||
      component.buttons?.some(
        (button) =>
          button.type === "OTP" || String(button.otp_type ?? "").toUpperCase() === "COPY_CODE"
      )
  );
}

export function listTemplateSendSlots(template: TemplateForSend): TemplateSendSlot[] {
  if (isAuthenticationSendTemplate(template)) {
    return [{ key: "auth:code", kind: "auth_code", placeholder: "{{1}}" }];
  }

  const slots: TemplateSendSlot[] = [];
  const header = template.components.find((component) => componentType(component) === "HEADER");
  const headerIsText = !header?.format || header.format.toUpperCase() === "TEXT";
  if (header && headerIsText) {
    for (const placeholder of placeholders(header.text)) {
      slots.push({
        key: `header:${placeholder}`,
        kind: "header_text",
        placeholder,
      });
    }
  }

  const body = template.components.find((component) => componentType(component) === "BODY");
  for (const placeholder of placeholders(body?.text)) {
    slots.push({
      key: `body:${placeholder}`,
      kind: "body_text",
      placeholder,
    });
  }

  const buttons = template.components.find((component) => componentType(component) === "BUTTONS");
  buttons?.buttons?.forEach((button, index) => {
    if (button.type !== "URL") return;
    for (const placeholder of placeholders(button.url)) {
      slots.push({
        key: `button:${index}:${placeholder}`,
        kind: "button_url",
        placeholder,
        buttonIndex: index,
        ...(button.text ? { buttonText: button.text } : {}),
      });
    }
  });

  return slots;
}

export function emptySlotValues(slots: TemplateSendSlot[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const slot of slots) values[slot.key] = "";
  return values;
}

export function slotsAreComplete(
  slots: TemplateSendSlot[],
  values: Record<string, string>
): boolean {
  return slots.every((slot) => Boolean(values[slot.key]?.trim()));
}

export function placeholderValues(
  slots: TemplateSendSlot[],
  values: Record<string, string>,
  kind: TemplateSendSlotKind
): string[] | undefined {
  const selected = slots.filter((slot) => slot.kind === kind);
  if (selected.length === 0) return undefined;
  const maxIndex = Math.max(
    ...selected.map((slot) => Number(slot.placeholder.replace(/\D/g, "")) || 1)
  );
  const result = Array.from({ length: maxIndex }, () => "");
  for (const slot of selected) {
    const index = (Number(slot.placeholder.replace(/\D/g, "")) || 1) - 1;
    result[index] = values[slot.key] ?? "";
  }
  return result;
}

export function buildTemplateSendComponents(
  template: TemplateForSend,
  values: Record<string, string>
): WhatsAppSendComponent[] | undefined {
  const slots = listTemplateSendSlots(template);
  if (slots.length === 0) return undefined;

  if (isAuthenticationSendTemplate(template)) {
    const code = values["auth:code"]?.trim() ?? "";
    return [
      { type: "body", parameters: [{ type: "text", text: code }] },
      {
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: code }],
      },
    ];
  }

  const components: WhatsAppSendComponent[] = [];
  const headerParameters = textParameters(slots, values, "header_text");
  if (headerParameters.length > 0) {
    components.push({ type: "header", parameters: headerParameters });
  }

  const bodyParameters = textParameters(slots, values, "body_text");
  if (bodyParameters.length > 0) {
    components.push({ type: "body", parameters: bodyParameters });
  }

  const buttonSlots = slots.filter((slot) => slot.kind === "button_url");
  const indexes = [...new Set(buttonSlots.map((slot) => slot.buttonIndex ?? 0))].sort(
    (a, b) => a - b
  );
  for (const index of indexes) {
    const parameters = textParameters(
      buttonSlots.filter((slot) => (slot.buttonIndex ?? 0) === index),
      values,
      "button_url"
    );
    components.push({
      type: "button",
      sub_type: "url",
      index: String(index),
      parameters,
    });
  }

  return components;
}

function textParameters(
  slots: TemplateSendSlot[],
  values: Record<string, string>,
  kind: TemplateSendSlotKind
): Array<{ type: "text"; text: string }> {
  return slots
    .filter((slot) => slot.kind === kind)
    .map((slot) => ({
      type: "text" as const,
      text: values[slot.key]?.trim() ?? "",
    }));
}
