export interface CsvRow {
  phone: string;
  variables: string[];
}

const PHONE_HEADERS = ["phone", "telefono", "numero", "celular", "whatsapp"];

const MOJIBAKE_PATTERN = /Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|â€|ï¿½/;
const SPANISH_CHARS = /[áéíóúñÁÉÍÓÚÑüÜ]/g;

function looksLikeMojibake(text: string): boolean {
  return MOJIBAKE_PATTERN.test(text);
}

function hasEncodingDefects(text: string): boolean {
  return text.includes("\uFFFD") || looksLikeMojibake(text);
}

function scoreDecodedText(text: string): number {
  let score = 0;
  if (text.includes("\uFFFD")) score -= 200;
  if (looksLikeMojibake(text)) score -= 200;
  score += (text.match(SPANISH_CHARS) ?? []).length * 3;
  score -= (text.match(/[\u0080-\u009F]/g) ?? []).length * 5;
  return score;
}

function pickBestDecodedText(candidates: string[]): string {
  return candidates.reduce((best, current) =>
    scoreDecodedText(current) > scoreDecodedText(best) ? current : best
  );
}

function fixUtf8MisreadAsLatin1(text: string): string {
  const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);
  return new TextDecoder("utf-8").decode(bytes);
}

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

function fixReplacementArtifacts(text: string): string {
  return text
    .replace(/ï¿½/g, "\uFFFD")
    .replace(/([aeiouAEIOU])\uFFFD([aA])/g, "$1ña")
    .replace(/([aeiouAEIOU])\uFFFD([oO])/g, "$1ño")
    .replace(/([aeiouAEIOU])\uFFFD([iI])/g, "$1ñi")
    .replace(/([aeiouAEIOU])\uFFFD([uU])/g, "$1ñu")
    .replace(/([aeiouAEIOU])\uFFFD([eE])/g, "$1ñe")
    .replace(/([aeiouAEIOU])\uFFFD/g, "$1ñ")
    .replace(/\uFFFD/g, "");
}

export function sanitizeLatinText(text: string): string {
  let value = stripBom(text).normalize("NFC").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  if (looksLikeMojibake(value)) {
    const fixed = fixUtf8MisreadAsLatin1(value);
    if (!hasEncodingDefects(fixed)) {
      value = fixed.normalize("NFC");
    }
  }
  if (value.includes("\uFFFD") || value.includes("ï¿½")) {
    value = fixReplacementArtifacts(value);
  }
  return value;
}

export function decodeCsvBytes(bytes: Uint8Array): string {
  let start = 0;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    start = 3;
  }
  const slice = bytes.subarray(start);

  const utf8 = new TextDecoder("utf-8").decode(slice);
  const win1252 = new TextDecoder("windows-1252").decode(slice);
  const latin1 = new TextDecoder("iso-8859-1").decode(slice);

  const utf8Fixed = looksLikeMojibake(utf8) ? fixUtf8MisreadAsLatin1(utf8) : utf8;

  let text = pickBestDecodedText([utf8Fixed, win1252, latin1]);

  if (hasEncodingDefects(text)) {
    const fallback = pickBestDecodedText([win1252, latin1, utf8Fixed]);
    if (!hasEncodingDefects(fallback) || scoreDecodedText(fallback) > scoreDecodedText(text)) {
      text = fallback;
    }
  }

  return sanitizeLatinText(text);
}

function parseLine(line: string): string[] {
  return line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

export function parseRecipientsCsv(text: string): CsvRow[] {
  const lines = sanitizeLatinText(text).trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
  const phoneIndex = headers.findIndex((h) => PHONE_HEADERS.includes(h));
  if (phoneIndex === -1) return [];

  const varIndices = headers
    .map((_, i) => i)
    .filter((i) => i !== phoneIndex);

  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const phone = (cells[phoneIndex] ?? "").replace(/\D/g, "");
    const variables = varIndices.map((i) => sanitizeLatinText(cells[i] ?? ""));
    return { phone, variables };
  }).filter((row) => row.phone.length > 0);
}
