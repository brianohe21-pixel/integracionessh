import { extractBodyVariables, sortBodyVariables } from "@/lib/templates/variables";
import type { TemplateButton, TemplateComponent } from "@/types";

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export type TemplateButtonFormValue = {
  type: TemplateButton["type"];
  text: string;
  url?: string;
  phone_number?: string;
  urlExample?: string;
};

export const MAX_QUICK_REPLY_BUTTONS = 3;
export const MAX_CTA_BUTTONS = 2;
export const BUTTON_TEXT_MAX_LENGTH = 25;

export interface WhatsAppTemplateFormValues {
  headerText: string;
  bodyText: string;
  footerText: string;
  headerExamples: Record<string, string>;
  bodyExamples: Record<string, string>;
  buttons: TemplateButtonFormValue[];
}

export interface SmsTemplateFormValues {
  body: string;
}

export const EMPTY_WHATSAPP_FORM: WhatsAppTemplateFormValues = {
  headerText: "",
  bodyText: "",
  footerText: "",
  headerExamples: {},
  bodyExamples: {},
  buttons: [],
};

function isQuickReplyButton(type: TemplateButton["type"]): boolean {
  return type === "QUICK_REPLY";
}

function isCtaButton(type: TemplateButton["type"]): boolean {
  return type === "URL" || type === "PHONE_NUMBER";
}

export function getButtonGroup(
  buttons: TemplateButtonFormValue[]
): "quick_reply" | "cta" | "mixed" | null {
  if (buttons.length === 0) return null;
  const hasQuickReply = buttons.some((b) => isQuickReplyButton(b.type));
  const hasCta = buttons.some((b) => isCtaButton(b.type));
  if (hasQuickReply && hasCta) return "mixed";
  if (hasQuickReply) return "quick_reply";
  return "cta";
}

export function maxButtonsForGroup(group: "quick_reply" | "cta" | null): number {
  if (group === "quick_reply") return MAX_QUICK_REPLY_BUTTONS;
  if (group === "cta") return MAX_CTA_BUTTONS;
  return MAX_QUICK_REPLY_BUTTONS;
}

function isButtonFormValueValid(button: TemplateButtonFormValue): boolean {
  const text = button.text.trim();
  if (!text || text.length > BUTTON_TEXT_MAX_LENGTH) return false;
  if (button.type === "URL") {
    const url = button.url?.trim() ?? "";
    if (!url) return false;
    if (/\{\{\d+\}\}/.test(url) && !button.urlExample?.trim()) return false;
  }
  if (button.type === "PHONE_NUMBER" && !button.phone_number?.trim()) return false;
  return true;
}

function buildTemplateButton(button: TemplateButtonFormValue): TemplateButton {
  const built: TemplateButton = {
    type: button.type,
    text: button.text.trim(),
  };
  if (button.type === "URL") {
    built.url = button.url?.trim();
    if (button.urlExample?.trim()) {
      built.example = [button.urlExample.trim()];
    }
  }
  if (button.type === "PHONE_NUMBER") {
    built.phone_number = button.phone_number?.trim();
  }
  return built;
}

export const EMPTY_SMS_FORM: SmsTemplateFormValues = {
  body: "",
};

function hasMissingExamples(
  vars: string[],
  examples: Record<string, string>
): boolean {
  return vars.some((v) => !examples[v]?.trim());
}

export function buildWhatsAppComponents(values: WhatsAppTemplateFormValues): TemplateComponent[] {
  const components: TemplateComponent[] = [];
  const headerVars = sortBodyVariables(extractBodyVariables(values.headerText));
  if (values.headerText.trim()) {
    const headerComp: TemplateComponent = {
      type: "HEADER",
      format: "TEXT",
      text: values.headerText.trim(),
    };
    if (headerVars.length > 0) {
      headerComp.example = {
        header_text: headerVars.map((v) => values.headerExamples[v]?.trim() ?? ""),
      };
    }
    components.push(headerComp);
  }
  const bodyVars = sortBodyVariables(extractBodyVariables(values.bodyText));
  const bodyComp: TemplateComponent = { type: "BODY", text: values.bodyText.trim() };
  if (bodyVars.length > 0) {
    bodyComp.example = {
      body_text: [bodyVars.map((v) => values.bodyExamples[v]?.trim() ?? "")],
    };
  }
  components.push(bodyComp);
  if (values.footerText.trim()) {
    components.push({ type: "FOOTER", text: values.footerText.trim() });
  }
  const validButtons = values.buttons.filter(isButtonFormValueValid);
  if (validButtons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: validButtons.map(buildTemplateButton),
    });
  }
  return components;
}

export function whatsAppFormFromComponents(components: TemplateComponent[]): WhatsAppTemplateFormValues {
  const headerComp = components.find((c) => c.type === "HEADER");
  const headerText = headerComp?.text ?? "";
  const headerVars = sortBodyVariables(extractBodyVariables(headerText));
  const headerExamples: Record<string, string> = {};
  if (headerComp?.example?.header_text) {
    headerVars.forEach((v, i) => {
      headerExamples[v] = headerComp.example!.header_text![i] ?? "";
    });
  }

  const bodyComp = components.find((c) => c.type === "BODY");
  const bodyText = bodyComp?.text ?? "";
  const vars = sortBodyVariables(extractBodyVariables(bodyText));
  const bodyExamples: Record<string, string> = {};
  if (bodyComp?.example?.body_text?.[0]) {
    vars.forEach((v, i) => {
      bodyExamples[v] = bodyComp.example!.body_text![0][i] ?? "";
    });
  }
  const buttonsComponent = components.find((c) => c.type === "BUTTONS");
  const buttons: TemplateButtonFormValue[] =
    buttonsComponent?.buttons?.map((button) => ({
      type: button.type,
      text: button.text,
      ...(button.url ? { url: button.url } : {}),
      ...(button.phone_number ? { phone_number: button.phone_number } : {}),
      ...(button.example?.[0] ? { urlExample: button.example[0] } : {}),
    })) ?? [];

  return {
    headerText,
    bodyText,
    footerText: components.find((c) => c.type === "FOOTER")?.text ?? "",
    headerExamples,
    bodyExamples,
    buttons,
  };
}

export function isWhatsAppFormValid(values: WhatsAppTemplateFormValues): boolean {
  if (!values.bodyText.trim()) return false;
  const headerVars = sortBodyVariables(extractBodyVariables(values.headerText));
  const bodyVars = sortBodyVariables(extractBodyVariables(values.bodyText));
  if (hasMissingExamples(headerVars, values.headerExamples)) return false;
  if (hasMissingExamples(bodyVars, values.bodyExamples)) return false;

  if (values.buttons.length === 0) return true;

  const group = getButtonGroup(values.buttons);
  if (group === "mixed") return false;
  if (!group) return true;

  const maxButtons = maxButtonsForGroup(group);
  if (values.buttons.length > maxButtons) return false;
  return values.buttons.every(isButtonFormValueValid);
}
