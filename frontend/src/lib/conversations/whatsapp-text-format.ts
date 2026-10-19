export type WhatsAppWrapFormat = "bold" | "italic" | "strikethrough" | "monospace";
export type WhatsAppLineFormat = "ordered" | "unordered" | "quote";
export type WhatsAppTextFormat = WhatsAppWrapFormat | WhatsAppLineFormat;

export type FormatSelectionResult = {
  text: string;
  selectionStart: number;
  selectionEnd: number;
};

const WRAP_MARKERS: Record<WhatsAppWrapFormat, { open: string; close: string }> = {
  bold: { open: "*", close: "*" },
  italic: { open: "_", close: "_" },
  strikethrough: { open: "~", close: "~" },
  monospace: { open: "```", close: "```" },
};

const LINE_PREFIX: Record<WhatsAppLineFormat, RegExp> = {
  ordered: /^\d+\.\s/,
  unordered: /^[-*]\s/,
  quote: /^>\s?/,
};

function applyWrapFormat(
  text: string,
  start: number,
  end: number,
  format: WhatsAppWrapFormat
): FormatSelectionResult {
  const selected = text.slice(start, end);
  const { open, close } = WRAP_MARKERS[format];
  const minWrappedLength = open.length + close.length;

  if (
    selected.length > minWrappedLength &&
    selected.startsWith(open) &&
    selected.endsWith(close)
  ) {
    const inner = selected.slice(open.length, selected.length - close.length);
    return {
      text: `${text.slice(0, start)}${inner}${text.slice(end)}`,
      selectionStart: start,
      selectionEnd: start + inner.length,
    };
  }

  if (
    start >= open.length &&
    end + close.length <= text.length &&
    text.slice(start - open.length, start) === open &&
    text.slice(end, end + close.length) === close
  ) {
    return {
      text: `${text.slice(0, start - open.length)}${selected}${text.slice(end + close.length)}`,
      selectionStart: start - open.length,
      selectionEnd: start - open.length + selected.length,
    };
  }

  const wrapped = `${open}${selected}${close}`;
  return {
    text: `${text.slice(0, start)}${wrapped}${text.slice(end)}`,
    selectionStart: start + open.length,
    selectionEnd: start + open.length + selected.length,
  };
}

function expandToLineBounds(text: string, start: number, end: number) {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = end;
  if (end > start && text[end - 1] === "\n") {
    lineEnd = end - 1;
  } else {
    const nextBreak = text.indexOf("\n", end);
    lineEnd = nextBreak === -1 ? text.length : nextBreak;
  }
  return { lineStart, lineEnd };
}

function applyLineFormat(
  text: string,
  start: number,
  end: number,
  format: WhatsAppLineFormat
): FormatSelectionResult {
  const { lineStart, lineEnd } = expandToLineBounds(text, start, end);
  const block = text.slice(lineStart, lineEnd);
  const lines = block.length === 0 ? [""] : block.split("\n");
  const pattern = LINE_PREFIX[format];
  const contentLines = lines.filter((line) => line.trim().length > 0);
  const alreadyFormatted =
    contentLines.length > 0 && contentLines.every((line) => pattern.test(line));

  const nextLines = alreadyFormatted
    ? lines.map((line) => line.replace(pattern, ""))
    : lines.map((line, index) => {
        const stripped = line
          .replace(LINE_PREFIX.ordered, "")
          .replace(LINE_PREFIX.unordered, "")
          .replace(LINE_PREFIX.quote, "");
        if (format === "ordered") return `${index + 1}. ${stripped}`;
        if (format === "unordered") return `- ${stripped}`;
        return `> ${stripped}`;
      });

  const nextBlock = nextLines.join("\n");
  return {
    text: `${text.slice(0, lineStart)}${nextBlock}${text.slice(lineEnd)}`,
    selectionStart: lineStart,
    selectionEnd: lineStart + nextBlock.length,
  };
}

export function applyWhatsAppTextFormat(
  text: string,
  start: number,
  end: number,
  format: WhatsAppTextFormat
): FormatSelectionResult {
  const safeStart = Math.max(0, Math.min(start, end, text.length));
  const safeEnd = Math.max(0, Math.min(Math.max(start, end), text.length));

  if (format === "ordered" || format === "unordered" || format === "quote") {
    return applyLineFormat(text, safeStart, safeEnd, format);
  }

  if (safeStart === safeEnd) {
    return { text, selectionStart: safeStart, selectionEnd: safeEnd };
  }

  return applyWrapFormat(text, safeStart, safeEnd, format);
}
