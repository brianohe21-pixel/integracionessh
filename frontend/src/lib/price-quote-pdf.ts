import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  formatCopAmount,
  formatUsdAmount,
  type ProQuoteResult,
  type QuotePlanKind,
  type ResellerQuoteResult,
} from "@/lib/price-calculator";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;
const ACCENT = rgb(0.12, 0.45, 0.78);
const TEXT_PRIMARY = rgb(0.1, 0.1, 0.1);
const TEXT_SECONDARY = rgb(0.35, 0.35, 0.35);
const LINE_GRAY = rgb(0.8, 0.8, 0.8);
const HEADER_BG = rgb(0, 0, 0);
const BRAND_NAME = "Integraciones SH";
const QUOTE_ICON_PATH = "/brand/integracionessh-quote-icon.png";
const LOGO_FALLBACK_PATHS = [
  "/brand/integracionessh-logo.jpg",
  "/brand/integracionessh-icon.png",
] as const;

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

function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "cliente"
  );
}

async function embedImageFromPath(pdf: PDFDocument, path: string) {
  const response = await fetch(path);
  if (!response.ok) return null;
  const bytes = await response.arrayBuffer();
  if (path.endsWith(".png")) {
    return pdf.embedPng(bytes);
  }
  return pdf.embedJpg(bytes);
}

async function loadQuoteLogo(pdf: PDFDocument) {
  try {
    const quoteIcon = await embedImageFromPath(pdf, QUOTE_ICON_PATH);
    if (quoteIcon) return { image: quoteIcon, isQuoteIcon: true as const };
  } catch {
    // fall through
  }

  for (const path of LOGO_FALLBACK_PATHS) {
    try {
      const image = await embedImageFromPath(pdf, path);
      if (image) return { image, isQuoteIcon: false as const };
    } catch {
      continue;
    }
  }
  return null;
}

export interface PriceQuotePdfLabels {
  title: string;
  brandName?: string;
  planLabel: string;
  clientLabel: string;
  issuedLabel: string;
  validUntilLabel: string;
  conceptLabel: string;
  amountCopLabel: string;
  amountUsdLabel: string;
  notesLabel: string;
  totalLabel: string;
  footerNote: string;
  lineLabels: Record<string, string>;
  filenamePrefix: string;
}

export interface PriceQuotePdfInput {
  kind: QuotePlanKind;
  clientName?: string;
  issuedAt: Date;
  validityDays: number;
  notes?: string;
  result: ProQuoteResult | ResellerQuoteResult;
  labels: PriceQuotePdfLabels;
  metaLines?: string[];
}

function drawText(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; size: number; font: PDFFont; color?: ReturnType<typeof rgb> }
) {
  page.drawText(sanitizePdfText(text), {
    x: opts.x,
    y: opts.y,
    size: opts.size,
    font: opts.font,
    color: opts.color ?? TEXT_PRIMARY,
  });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitizePdfText(text).split(" ").filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const next = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i]!;
    }
  }
  lines.push(current);
  return lines;
}

export async function downloadPriceQuotePdf(input: PriceQuotePdfInput): Promise<void> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadQuoteLogo(pdf);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT;

  if (logo?.isQuoteIcon) {
    const headerHeight = 118;
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - headerHeight,
      width: PAGE_WIDTH,
      height: headerHeight,
      color: HEADER_BG,
    });
    const maxH = 96;
    const scale = maxH / logo.image.height;
    const w = logo.image.width * scale;
    const h = logo.image.height * scale;
    page.drawImage(logo.image, {
      x: (PAGE_WIDTH - w) / 2,
      y: PAGE_HEIGHT - headerHeight + (headerHeight - h) / 2,
      width: w,
      height: h,
    });
    y = PAGE_HEIGHT - headerHeight - 28;
  } else if (logo) {
    y = PAGE_HEIGHT - MARGIN;
    const maxH = 36;
    const scale = maxH / logo.image.height;
    const w = logo.image.width * scale;
    const h = logo.image.height * scale;
    page.drawImage(logo.image, {
      x: MARGIN,
      y: y - h + 8,
      width: w,
      height: h,
    });
    drawText(page, input.labels.brandName ?? BRAND_NAME, {
      x: MARGIN + w + 12,
      y: y - 8,
      size: 14,
      font: fontBold,
      color: ACCENT,
    });
    y -= Math.max(h, 28) + 16;
    page.drawRectangle({
      x: MARGIN,
      y: y + 4,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 3,
      color: ACCENT,
    });
    y -= 24;
  } else {
    y = PAGE_HEIGHT - MARGIN;
    drawText(page, input.labels.brandName ?? BRAND_NAME, {
      x: MARGIN,
      y,
      size: 16,
      font: fontBold,
      color: ACCENT,
    });
    y -= 28;
    page.drawRectangle({
      x: MARGIN,
      y: y + 4,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 3,
      color: ACCENT,
    });
    y -= 24;
  }

  drawText(page, input.labels.title, {
    x: MARGIN,
    y,
    size: 18,
    font: fontBold,
  });
  y -= 20;

  drawText(page, `${input.labels.planLabel}: ${input.kind === "pro" ? "Pro" : "Reseller"}`, {
    x: MARGIN,
    y,
    size: 11,
    font,
    color: TEXT_SECONDARY,
  });
  y -= 16;

  if (input.clientName?.trim()) {
    drawText(page, `${input.labels.clientLabel}: ${input.clientName.trim()}`, {
      x: MARGIN,
      y,
      size: 11,
      font,
    });
    y -= 16;
  }

  const issued = input.issuedAt.toLocaleDateString("es-CO");
  const validUntil = new Date(input.issuedAt);
  validUntil.setDate(validUntil.getDate() + Math.max(1, input.validityDays));
  drawText(page, `${input.labels.issuedLabel}: ${issued}`, {
    x: MARGIN,
    y,
    size: 10,
    font,
    color: TEXT_SECONDARY,
  });
  y -= 14;
  drawText(page, `${input.labels.validUntilLabel}: ${validUntil.toLocaleDateString("es-CO")}`, {
    x: MARGIN,
    y,
    size: 10,
    font,
    color: TEXT_SECONDARY,
  });
  y -= 20;

  for (const line of input.metaLines ?? []) {
    drawText(page, line, {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: TEXT_SECONDARY,
    });
    y -= 14;
  }

  y -= 8;

  const colConcept = MARGIN;
  const colCop = PAGE_WIDTH - MARGIN - 200;
  const colUsd = PAGE_WIDTH - MARGIN - 90;

  drawText(page, input.labels.conceptLabel, {
    x: colConcept,
    y,
    size: 10,
    font: fontBold,
  });
  drawText(page, input.labels.amountCopLabel, {
    x: colCop,
    y,
    size: 10,
    font: fontBold,
  });
  drawText(page, input.labels.amountUsdLabel, {
    x: colUsd,
    y,
    size: 10,
    font: fontBold,
  });
  y -= 8;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.6,
    color: LINE_GRAY,
  });
  y -= 18;

  const displayLines = input.result.lines.filter((line) => line.key !== "total");
  for (const line of displayLines) {
    const label = input.labels.lineLabels[line.key] ?? line.key;
    drawText(page, label, {
      x: colConcept,
      y,
      size: 10,
      font,
    });
    drawText(page, formatCopAmount(line.amountCop), {
      x: colCop,
      y,
      size: 10,
      font,
    });
    drawText(page, formatUsdAmount(line.amountUsd), {
      x: colUsd,
      y,
      size: 10,
      font,
    });
    y -= 16;
  }

  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y: y + 10 },
    end: { x: PAGE_WIDTH - MARGIN, y: y + 10 },
    thickness: 0.8,
    color: ACCENT,
  });

  const totalCop =
    input.result.kind === "pro" ? input.result.totalCop : input.result.suggestedPriceCop;
  const totalUsd =
    input.result.kind === "pro" ? input.result.totalUsd : input.result.suggestedPriceUsd;

  drawText(page, input.labels.totalLabel, {
    x: colConcept,
    y,
    size: 12,
    font: fontBold,
  });
  drawText(page, formatCopAmount(totalCop), {
    x: colCop,
    y,
    size: 12,
    font: fontBold,
    color: ACCENT,
  });
  drawText(page, formatUsdAmount(totalUsd), {
    x: colUsd,
    y,
    size: 12,
    font: fontBold,
    color: ACCENT,
  });
  y -= 28;

  if (input.notes?.trim()) {
    drawText(page, input.labels.notesLabel, {
      x: MARGIN,
      y,
      size: 11,
      font: fontBold,
    });
    y -= 16;
    const noteLines = wrapText(input.notes.trim(), font, 10, PAGE_WIDTH - MARGIN * 2);
    for (const noteLine of noteLines) {
      drawText(page, noteLine, {
        x: MARGIN,
        y,
        size: 10,
        font,
        color: TEXT_SECONDARY,
      });
      y -= 14;
    }
  }

  drawText(page, input.labels.footerNote, {
    x: MARGIN,
    y: MARGIN,
    size: 8,
    font,
    color: TEXT_SECONDARY,
  });

  const clientSlug = slugify(input.clientName?.trim() || input.kind);
  const filename = `${input.labels.filenamePrefix}-${input.kind}-${clientSlug}.pdf`;

  const bytes = await pdf.save();
  const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
