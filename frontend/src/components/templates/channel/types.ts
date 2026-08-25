import { extractBodyVariables, sortBodyVariables } from "@/lib/templates/variables";
import type { TemplateComponent } from "@/types";

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export interface WhatsAppTemplateFormValues {
  headerText: string;
  bodyText: string;
  footerText: string;
  bodyExamples: Record<string, string>;
}

export interface SmsTemplateFormValues {
  body: string;
}

export const EMPTY_WHATSAPP_FORM: WhatsAppTemplateFormValues = {
  headerText: "",
  bodyText: "",
  footerText: "",
  bodyExamples: {},
};

export const EMPTY_SMS_FORM: SmsTemplateFormValues = {
  body: "",
};

export function buildWhatsAppComponents(values: WhatsAppTemplateFormValues): TemplateComponent[] {
  const components: TemplateComponent[] = [];
  if (values.headerText.trim()) {
    components.push({ type: "HEADER", format: "TEXT", text: values.headerText.trim() });
  }
  const bodyVars = sortBodyVariables(extractBodyVariables(values.bodyText));
  const bodyComp: TemplateComponent = { type: "BODY", text: values.bodyText.trim() };
  if (bodyVars.length > 0) {
    bodyComp.example = {
      body_text: [bodyVars.map((v) => values.bodyExamples[v]?.trim() || v)],
    };
  }
  components.push(bodyComp);
  if (values.footerText.trim()) {
    components.push({ type: "FOOTER", text: values.footerText.trim() });
  }
  return components;
}

export function whatsAppFormFromComponents(components: TemplateComponent[]): WhatsAppTemplateFormValues {
  const bodyComp = components.find((c) => c.type === "BODY");
  const bodyText = bodyComp?.text ?? "";
  const vars = sortBodyVariables(extractBodyVariables(bodyText));
  const bodyExamples: Record<string, string> = {};
  if (bodyComp?.example?.body_text?.[0]) {
    vars.forEach((v, i) => {
      bodyExamples[v] = bodyComp.example!.body_text![0][i] ?? "";
    });
  }
  return {
    headerText: components.find((c) => c.type === "HEADER")?.text ?? "",
    bodyText,
    footerText: components.find((c) => c.type === "FOOTER")?.text ?? "",
    bodyExamples,
  };
}

export function isWhatsAppFormValid(values: WhatsAppTemplateFormValues): boolean {
  if (!values.bodyText.trim()) return false;
  return !sortBodyVariables(extractBodyVariables(values.bodyText)).some(
    (v) => !values.bodyExamples[v]?.trim()
  );
}
