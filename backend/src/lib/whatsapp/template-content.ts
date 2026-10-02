import { getCachedTemplate } from "../dynamodb/template.repository.js";
import { renderTemplateBody } from "../sms/render.js";

type TemplateSendComponent = {
  type: string;
  parameters?: Array<{ type: string; text?: string | undefined }> | undefined;
};

function bodyParameterValues(components?: TemplateSendComponent[]): string[] {
  const body = components?.find((component) => component.type === "body");
  return body?.parameters?.map((parameter) => parameter.text ?? "") ?? [];
}

export async function resolveWhatsAppTemplateDisplayContent(params: {
  tenantId: string;
  botId: string;
  templateName: string;
  language: string;
  components?: TemplateSendComponent[];
  templateVariables?: Record<string, string>;
}): Promise<string> {
  const cached = await getCachedTemplate(
    params.tenantId,
    params.botId,
    params.templateName,
    params.language
  );
  const bodyText = cached?.components.find((component) => component.type === "BODY")?.text;
  if (!bodyText) {
    return params.templateName;
  }

  const values = params.components
    ? bodyParameterValues(params.components)
    : params.templateVariables
      ? Object.values(params.templateVariables)
      : [];

  return renderTemplateBody(bodyText, values);
}
