export interface CsvRow {
  phone: string;
  variables: string[];
}

const PHONE_HEADERS = ["phone", "telefono", "numero", "celular", "whatsapp"];

function parseLine(line: string): string[] {
  return line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

export function parseRecipientsCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
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
    const variables = varIndices.map((i) => cells[i] ?? "");
    return { phone, variables };
  }).filter((row) => row.phone.length > 0);
}
