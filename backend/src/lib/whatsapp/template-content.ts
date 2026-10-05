import { getCachedTemplate } from "../dynamodb/template.repository.js";
import { renderTemplateBody } from "../sms/render.js";
import type { TemplateButton, TemplateComponent, WhatsAppTemplate } from "../../types/index.js";

type TemplateSendComponent = {
  type: string;
  parameters?: Array<{ type: string; text?: string | undefined }> | undefined;
};

export interface WhatsAppTemplateDisplay {
  headerText?: string;
  bodyText?: string;
  footerText?: string;
  buttons?: string[];
}

export interface ResolvedWhatsAppTemplateContent {
  content: string;
  display: WhatsAppTemplateDisplay;
}

function findComponent(
  components: TemplateComponent[],
  type: string
): TemplateComponent | undefined {
  return components.find((component) => component.type.toUpperCase() === type);
}

function parameterValues(components: TemplateSendComponent[] | undefined, type: string): string[] {
  const match = components?.find((component) => component.type.toLowerCase() === type);
  return match?.parameters?.map((parameter) => parameter.text ?? "") ?? [];
}

function isOtpButton(button: TemplateButton): boolean {
  return button.type === "OTP" || String(button.otp_type ?? "").toUpperCase() === "COPY_CODE";
}

function isAuthenticationTemplate(template: WhatsAppTemplate): boolean {
  if (template.category === "AUTHENTICATION") return true;
  return template.components.some(
    (component) =>
      typeof component.add_security_recommendation === "boolean" ||
      typeof component.code_expiration_minutes === "number" ||
      component.buttons?.some((button) => isOtpButton(button))
  );
}

function isSpanish(language: string): boolean {
  return language.toLowerCase().startsWith("es");
}

function buttonLabels(buttons: TemplateButton[] | undefined): string[] {
  return (buttons ?? [])
    .map((button) => button.text?.trim() ?? "")
    .filter((text) => text.length > 0);
}

function buildAuthenticationDisplay(
  template: WhatsAppTemplate,
  bodyValues: string[]
): WhatsAppTemplateDisplay {
  const body = findComponent(template.components, "BODY");
  const footer = findComponent(template.components, "FOOTER");
  const buttons = findComponent(template.components, "BUTTONS");
  const spanish = isSpanish(template.language);
  const code = bodyValues[0]?.trim() || "123456";
  const parts = [
    spanish
      ? `${code} es tu código de verificación.`
      : `${code} is your verification code.`,
  ];
  if (body?.add_security_recommendation) {
    parts.push(
      spanish
        ? "Por tu seguridad, no compartas este código."
        : "For your security, do not share this code."
    );
  }

  const display: WhatsAppTemplateDisplay = { bodyText: parts.join(" ") };
  if (typeof footer?.code_expiration_minutes === "number") {
    display.footerText = spanish
      ? `Este código caduca en ${footer.code_expiration_minutes} minutos.`
      : `This code expires in ${footer.code_expiration_minutes} minutes.`;
  } else if (footer?.text?.trim()) {
    display.footerText = footer.text.trim();
  }

  const otpText =
    buttons?.buttons?.find((button) => isOtpButton(button))?.text?.trim() ||
    (spanish ? "Copiar código" : "Copy code");
  display.buttons = [otpText];
  return display;
}

function buildDisplay(
  template: WhatsAppTemplate,
  params: {
    components?: TemplateSendComponent[];
    templateVariables?: Record<string, string>;
  }
): WhatsAppTemplateDisplay {
  const bodyValues = params.components
    ? parameterValues(params.components, "body")
    : params.templateVariables
      ? Object.values(params.templateVariables)
      : [];

  if (isAuthenticationTemplate(template)) {
    return buildAuthenticationDisplay(template, bodyValues);
  }

  const header = findComponent(template.components, "HEADER");
  const body = findComponent(template.components, "BODY");
  const footer = findComponent(template.components, "FOOTER");
  const buttons = findComponent(template.components, "BUTTONS");
  const display: WhatsAppTemplateDisplay = {};

  const headerIsText = !header?.format || header.format.toUpperCase() === "TEXT";
  if (headerIsText && header?.text?.trim()) {
    display.headerText = renderTemplateBody(
      header.text,
      parameterValues(params.components, "header")
    );
  }

  if (body?.text?.trim()) {
    display.bodyText = renderTemplateBody(body.text, bodyValues);
  }

  if (footer?.text?.trim()) {
    display.footerText = footer.text.trim();
  }

  const labels = buttonLabels(buttons?.buttons);
  if (labels.length > 0) {
    display.buttons = labels;
  }

  return display;
}

function toContent(display: WhatsAppTemplateDisplay, fallback: string): string {
  const sections: string[] = [];
  if (display.headerText) sections.push(display.headerText);
  if (display.bodyText) sections.push(display.bodyText);
  if (display.footerText) sections.push(display.footerText);
  if (display.buttons?.length) sections.push(display.buttons.join("\n"));
  return sections.length > 0 ? sections.join("\n\n") : fallback;
}

export async function resolveWhatsAppTemplateDisplayContent(params: {
  tenantId: string;
  botId: string;
  templateName: string;
  language: string;
  components?: TemplateSendComponent[];
  templateVariables?: Record<string, string>;
}): Promise<ResolvedWhatsAppTemplateContent> {
  const cached = await getCachedTemplate(
    params.tenantId,
    params.botId,
    params.templateName,
    params.language
  );
  if (!cached) {
    return { content: params.templateName, display: {} };
  }

  const display = buildDisplay(cached, params);
  return {
    content: toContent(display, params.templateName),
    display,
  };
}
