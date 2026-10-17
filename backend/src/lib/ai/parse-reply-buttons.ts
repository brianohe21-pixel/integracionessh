export interface AiReplyButton {
  id: string;
  title: string;
}

export interface ParsedAiReplyButtons {
  body: string;
  buttons: AiReplyButton[];
}

const BUTTONS_BLOCK_PATTERN =
  /\[\[buttons\]\]\s*([\s\S]*?)\s*\[\[\/buttons\]\]/i;

const MAX_BUTTONS = 3;
const MAX_TITLE_LENGTH = 20;

function normalizeButtonTitle(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH);
}

export function parseAiReplyButtons(reply: string): ParsedAiReplyButtons {
  const text = reply ?? "";
  const match = text.match(BUTTONS_BLOCK_PATTERN);
  if (!match) {
    return { body: text.trim(), buttons: [] };
  }

  const titles = match[1]
    .split(/\r?\n/)
    .map((line) => normalizeButtonTitle(line))
    .filter(Boolean)
    .slice(0, MAX_BUTTONS);

  const body = text.replace(match[0], "").replace(/\n{3,}/g, "\n\n").trim();
  const buttons = titles.map((title, index) => ({
    id: `ai-btn-${index + 1}`,
    title,
  }));

  return { body, buttons };
}

export function formatAiButtonsFallbackText(
  body: string,
  buttons: AiReplyButton[]
): string {
  if (buttons.length === 0) return body;
  const options = buttons.map((button, index) => `${index + 1}. ${button.title}`).join("\n");
  if (!body) return options;
  return `${body}\n\n${options}`;
}
