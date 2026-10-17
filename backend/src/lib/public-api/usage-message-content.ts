const MESSAGE_CONTENT_MAX = 4000;

export type ApiUsageMessagePayload =
  | { type: "text"; text: string }
  | {
      type: "template";
      template: {
        name: string;
        language: string;
        components?: unknown[];
      };
    }
  | { type: "sms"; text: string };

export function formatApiUsageMessageContent(payload: ApiUsageMessagePayload): string {
  let content: string;
  if (payload.type === "text" || payload.type === "sms") {
    content = payload.text;
  } else {
    content = JSON.stringify({
      type: "template",
      name: payload.template.name,
      language: payload.template.language,
      ...(payload.template.components?.length
        ? { components: payload.template.components }
        : {}),
    });
  }

  if (content.length <= MESSAGE_CONTENT_MAX) return content;
  return `${content.slice(0, MESSAGE_CONTENT_MAX)}…`;
}
