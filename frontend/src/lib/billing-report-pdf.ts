import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;
const ROW_HEIGHT = 16;
const HEADER_HEIGHT = 18;

const PDF_TEXT_REPLACEMENTS: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u2026": "...",
  "\u00A0": " ",
};

function sanitizePdfText(text: string): string {
  let output = "";
  for (const char of text.normalize("NFKC")) {
    const replacement = PDF_TEXT_REPLACEMENTS[char];
    if (replacement) {
      output += replacement;
      continue;
    }
    const code = char.codePointAt(0)!;
    if (code === 9 || code === 10 || code === 13) {
      output += " ";
      continue;
    }
    if (code >= 0x20 && code <= 0x7e) {
      output += char;
      continue;
    }
    if (code >= 0xa0 && code <= 0xff) {
      output += char;
    }
  }
  return output.replace(/\s+/g, " ").trim();
}

export interface BillingReportPdfInput {
  title: string;
  subtitle?: string;
  summaryLines?: string[];
  columns: string[];
  rows: string[][];
  filename: string;
}

function columnWidths(columnCount: number, tableWidth: number): number[] {
  if (columnCount <= 1) return [tableWidth];
  const first = Math.floor(tableWidth * 0.28);
  const rest = (tableWidth - first) / (columnCount - 1);
  return [first, ...Array.from({ length: columnCount - 1 }, () => rest)];
}

function truncateToWidth(text: string, maxChars: number): string {
  const sanitized = sanitizePdfText(text);
  if (sanitized.length <= maxChars) return sanitized;
  return `${sanitized.slice(0, maxChars - 3)}...`;
}

export async function downloadBillingReportPdf(input: BillingReportPdfInput): Promise<void> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const tableWidth = PAGE_WIDTH - MARGIN * 2;
  const colWidths = columnWidths(input.columns.length, tableWidth);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  page.drawText(sanitizePdfText(input.title), {
    x: MARGIN,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 22;

  if (input.subtitle) {
    page.drawText(sanitizePdfText(input.subtitle), {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 18;
  }

  for (const line of input.summaryLines ?? []) {
    page.drawText(sanitizePdfText(line), {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= 14;
  }

  y -= 8;

  function ensureSpace(needed: number) {
    if (y - needed >= MARGIN) return;
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  function drawTableHeader() {
    ensureSpace(HEADER_HEIGHT + 4);
    let x = MARGIN;
    input.columns.forEach((column, index) => {
      const maxChars = Math.floor(colWidths[index]! / 5.5);
      page.drawText(truncateToWidth(column, maxChars), {
        x,
        y,
        size: 9,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2),
      });
      x += colWidths[index]!;
    });
    y -= HEADER_HEIGHT;
    page.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: PAGE_WIDTH - MARGIN, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    });
  }

  drawTableHeader();

  for (const row of input.rows) {
    ensureSpace(ROW_HEIGHT);
    let x = MARGIN;
    row.forEach((cell, index) => {
      const maxChars = Math.floor(colWidths[index]! / 5.5);
      page.drawText(truncateToWidth(cell, maxChars), {
        x,
        y,
        size: 9,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      x += colWidths[index]!;
    });
    y -= ROW_HEIGHT;
  }

  const bytes = await pdf.save();
  const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = input.filename.endsWith(".pdf") ? input.filename : `${input.filename}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
