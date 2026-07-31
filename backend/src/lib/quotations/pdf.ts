import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Quotation, QuotationLineItem, ResolvedTenantBranding } from "../../types/index.js";

function formatCop(cents: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

export function buildQuotationNumber(quotationId: string): string {
  const date = new Date();
  const ymd = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("");
  const shortId = quotationId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `COT-${ymd}-${shortId}`;
}

export function computeQuotationLineItems(
  items: Array<{ description: string; quantity: number; unitPriceInCents: number }>
): QuotationLineItem[] {
  return items.map((item) => {
    const quantity = Math.max(1, Math.floor(item.quantity));
    const unitPriceInCents = Math.max(0, Math.floor(item.unitPriceInCents));
    return {
      description: item.description.trim(),
      quantity,
      unitPriceInCents,
      totalInCents: quantity * unitPriceInCents,
    };
  });
}

export function computeQuotationTotals(items: QuotationLineItem[]): {
  subtotalInCents: number;
  totalInCents: number;
} {
  const subtotalInCents = items.reduce((sum, item) => sum + item.totalInCents, 0);
  return { subtotalInCents, totalInCents: subtotalInCents };
}

export async function renderQuotationPdf(params: {
  quotation: Quotation;
  branding: ResolvedTenantBranding;
  logoBytes?: Uint8Array;
}): Promise<Uint8Array> {
  const { quotation, branding } = params;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  let y = 780;

  const primary = parseHexColor(branding.primaryColor);

  if (params.logoBytes && params.logoBytes.length > 0) {
    try {
      const image = await pdf.embedPng(params.logoBytes);
      const scale = Math.min(80 / image.width, 40 / image.height, 1);
      page.drawImage(image, {
        x: margin,
        y: y - image.height * scale,
        width: image.width * scale,
        height: image.height * scale,
      });
    } catch {
      try {
        const image = await pdf.embedJpg(params.logoBytes);
        const scale = Math.min(80 / image.width, 40 / image.height, 1);
        page.drawImage(image, {
          x: margin,
          y: y - image.height * scale,
          width: image.width * scale,
          height: image.height * scale,
        });
      } catch {
        // skip logo if unsupported format
      }
    }
  }

  page.drawText(branding.brandName, {
    x: margin + 90,
    y: y - 10,
    size: 18,
    font: fontBold,
    color: primary,
  });
  page.drawText("COTIZACIÓN", {
    x: 420,
    y: y - 4,
    size: 14,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawText(quotation.number, {
    x: 420,
    y: y - 22,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  y -= 60;
  page.drawLine({
    start: { x: margin, y },
    end: { x: 547, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 24;

  const clientName = quotation.contactName ?? quotation.contactPhone;
  page.drawText(`Cliente: ${truncateText(clientName, 60)}`, {
    x: margin,
    y,
    size: 10,
    font,
  });
  page.drawText(`Fecha: ${formatDate(quotation.sentAt)}`, {
    x: 360,
    y,
    size: 10,
    font,
  });
  y -= 16;
  if (quotation.validUntil) {
    page.drawText(`Válida hasta: ${formatDate(quotation.validUntil)}`, {
      x: 360,
      y,
      size: 10,
      font,
    });
    y -= 16;
  }

  y -= 12;
  const colDesc = margin;
  const colQty = 340;
  const colUnit = 400;
  const colTotal = 480;

  page.drawText("Descripción", { x: colDesc, y, size: 9, font: fontBold });
  page.drawText("Cant.", { x: colQty, y, size: 9, font: fontBold });
  page.drawText("Precio", { x: colUnit, y, size: 9, font: fontBold });
  page.drawText("Total", { x: colTotal, y, size: 9, font: fontBold });
  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: 547, y },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 16;

  for (const item of quotation.items) {
    if (y < 120) break;
    page.drawText(truncateText(item.description, 48), {
      x: colDesc,
      y,
      size: 9,
      font,
    });
    page.drawText(String(item.quantity), { x: colQty, y, size: 9, font });
    page.drawText(formatCop(item.unitPriceInCents), { x: colUnit, y, size: 9, font });
    page.drawText(formatCop(item.totalInCents), { x: colTotal, y, size: 9, font });
    y -= 14;
  }

  y -= 8;
  page.drawLine({
    start: { x: 360, y },
    end: { x: 547, y },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 18;
  page.drawText("Subtotal:", { x: 400, y, size: 10, font });
  page.drawText(formatCop(quotation.subtotalInCents), {
    x: colTotal,
    y,
    size: 10,
    font,
  });
  y -= 16;
  page.drawText("Total:", { x: 400, y, size: 12, font: fontBold, color: primary });
  page.drawText(formatCop(quotation.totalInCents), {
    x: colTotal,
    y,
    size: 12,
    font: fontBold,
    color: primary,
  });

  if (quotation.notes?.trim()) {
    y -= 32;
    page.drawText("Notas:", { x: margin, y, size: 9, font: fontBold });
    y -= 14;
    const lines = wrapText(quotation.notes.trim(), 90);
    for (const line of lines.slice(0, 6)) {
      page.drawText(line, { x: margin, y, size: 9, font });
      y -= 12;
    }
  }

  page.drawText(
    "Documento comercial sin validez fiscal. El pago se realiza mediante el enlace enviado por separado.",
    {
      x: margin,
      y: 40,
      size: 7,
      font,
      color: rgb(0.5, 0.5, 0.5),
    }
  );

  return pdf.save();
}

function parseHexColor(hex: string) {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}
