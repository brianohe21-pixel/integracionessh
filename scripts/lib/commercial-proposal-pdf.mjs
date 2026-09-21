import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLORS = {
  primary: rgb(0.1, 0.1, 0.1),
  primaryDark: rgb(0, 0, 0),
  primaryLight: rgb(0.95, 0.95, 0.95),
  text: rgb(0.12, 0.12, 0.14),
  textMuted: rgb(0.42, 0.42, 0.48),
  border: rgb(0.85, 0.85, 0.85),
  white: rgb(1, 1, 1),
  accentMuted: rgb(0.35, 0.35, 0.35),
  accentLine: rgb(0.55, 0.55, 0.55),
};

const PDF_TEXT_REPLACEMENTS = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u2026": "...",
  "\u00A0": " ",
};

function sanitize(text) {
  let output = "";
  for (const char of String(text).normalize("NFKC")) {
    const replacement = PDF_TEXT_REPLACEMENTS[char];
    if (replacement) {
      output += replacement;
      continue;
    }
    const code = char.codePointAt(0);
    if (code === 9 || code === 10 || code === 13) {
      output += " ";
      continue;
    }
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
      output += char;
    }
  }
  return output.replace(/\s+/g, " ").trim();
}

function wrapText(text, maxChars) {
  const words = sanitize(text).split(" ");
  const lines = [];
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

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCop(cents) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

async function embedLogo(pdf, logoBytes) {
  if (!logoBytes?.length) return null;
  try {
    return await pdf.embedPng(logoBytes);
  } catch {
    try {
      return await pdf.embedJpg(logoBytes);
    } catch {
      return null;
    }
  }
}

export async function renderCommercialProposalPdf(params) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedLogo(pdf, params.logoBytes);
  const signature = await embedLogo(pdf, params.signatureBytes);

  const ctx = {
    pdf,
    font,
    fontBold,
    logo,
    signature,
    page: null,
    y: 0,
    pageNumber: 0,
    proposal: params.proposal,
    branding: params.branding,
  };

  renderCover(ctx);
  renderExecutiveSummary(ctx);
  renderSolution(ctx);
  renderBenefits(ctx);
  renderInvestment(ctx);
  renderTermsAndNextSteps(ctx);

  return pdf.save();
}

function newPage(ctx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.pageNumber += 1;
  ctx.y = PAGE_H - MARGIN;
  drawPageFooter(ctx);
  return ctx.y;
}

function ensureSpace(ctx, needed) {
  if (ctx.y - needed < MARGIN + 36) {
    newPage(ctx);
    drawInnerPageHeader(ctx);
    ctx.y -= 8;
  }
}

function formatContactInfo(branding) {
  const web = branding.website ?? "integracionessh.lat";
  const parts = [`Web: ${web}`];
  if (branding.whatsapp) parts.push(`WhatsApp: ${branding.whatsapp}`);
  return parts.join("  |  ");
}

function drawPageFooter(ctx) {
  const { page, font, pageNumber, branding } = ctx;
  page.drawLine({
    start: { x: MARGIN, y: 48 },
    end: { x: PAGE_W - MARGIN, y: 48 },
    thickness: 0.5,
    color: COLORS.border,
  });
  page.drawText(sanitize(branding.brandName), {
    x: MARGIN,
    y: 34,
    size: 7,
    font,
    color: COLORS.textMuted,
  });
  page.drawText(sanitize(formatContactInfo(branding)), {
    x: MARGIN,
    y: 22,
    size: 7,
    font,
    color: COLORS.textMuted,
  });
  page.drawText(`Página ${pageNumber}`, {
    x: PAGE_W - MARGIN - 50,
    y: 28,
    size: 7,
    font,
    color: COLORS.textMuted,
  });
}

function drawLogo(ctx, options = {}) {
  const { logo } = ctx;
  if (!logo) return { width: 0, height: 0 };
  const maxWidth = options.maxWidth ?? 120;
  const maxHeight = options.maxHeight ?? 48;
  const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height, 1);
  const width = logo.width * scale;
  const height = logo.height * scale;
  const x = options.x ?? MARGIN;
  const y = options.y ?? ctx.y - height;
  ctx.page.drawImage(logo, { x, y, width, height });
  return { width, height, x, y };
}

function drawInnerPageHeader(ctx) {
  const { page, fontBold, logo } = ctx;
  const headerH = 80;
  page.drawRectangle({
    x: 0,
    y: PAGE_H - headerH,
    width: PAGE_W,
    height: headerH,
    color: rgb(0, 0, 0),
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_H - headerH - 4,
    width: PAGE_W,
    height: 4,
    color: COLORS.accentLine,
  });
  if (logo) {
    drawLogo(ctx, {
      maxWidth: 130,
      maxHeight: 58,
      x: MARGIN,
      y: PAGE_H - 68,
    });
  }
  page.drawText("Propuesta comercial", {
    x: PAGE_W - MARGIN - 120,
    y: PAGE_H - 48,
    size: 10,
    font: fontBold,
    color: COLORS.white,
  });
  ctx.y = PAGE_H - headerH - 16;
}

function drawSectionTitle(ctx, title) {
  ensureSpace(ctx, 40);
  const { page, fontBold } = ctx;
  page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 18,
    width: 4,
    height: 22,
    color: COLORS.primary,
  });
  page.drawText(sanitize(title), {
    x: MARGIN + 12,
    y: ctx.y - 14,
    size: 14,
    font: fontBold,
    color: COLORS.text,
  });
  ctx.y -= 34;
}

function drawParagraph(ctx, text, options = {}) {
  const size = options.size ?? 10;
  const lineHeight = options.lineHeight ?? 14;
  const color = options.color ?? COLORS.text;
  const maxChars = options.maxChars ?? 92;
  const lines = wrapText(text, maxChars);
  ensureSpace(ctx, lines.length * lineHeight + 8);
  for (const line of lines) {
    ctx.page.drawText(sanitize(line), {
      x: MARGIN,
      y: ctx.y,
      size,
      font: options.bold ? ctx.fontBold : ctx.font,
      color,
    });
    ctx.y -= lineHeight;
  }
  ctx.y -= options.gapAfter ?? 10;
}

function drawBulletList(ctx, items, options = {}) {
  const lineHeight = options.lineHeight ?? 14;
  for (const item of items) {
    const lines = wrapText(item, options.maxChars ?? 88);
    ensureSpace(ctx, lines.length * lineHeight + 4);
    ctx.page.drawText("-", {
      x: MARGIN + 4,
      y: ctx.y,
      size: 10,
      font: ctx.fontBold,
      color: COLORS.primary,
    });
    for (let i = 0; i < lines.length; i++) {
      ctx.page.drawText(sanitize(lines[i]), {
        x: MARGIN + 16,
        y: ctx.y,
        size: 10,
        font: ctx.font,
        color: COLORS.text,
      });
      ctx.y -= lineHeight;
    }
    ctx.y -= 4;
  }
  ctx.y -= 6;
}

function drawInfoBox(ctx, rows) {
  const boxHeight = rows.length * 22 + 20;
  ensureSpace(ctx, boxHeight + 10);
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - boxHeight + 8,
    width: CONTENT_W,
    height: boxHeight,
    color: COLORS.primaryLight,
    borderColor: COLORS.border,
    borderWidth: 0.5,
  });
  let boxY = ctx.y - 6;
  for (const row of rows) {
    ctx.page.drawText(sanitize(row.label), {
      x: MARGIN + 14,
      y: boxY,
      size: 9,
      font: ctx.fontBold,
      color: COLORS.textMuted,
    });
    ctx.page.drawText(sanitize(row.value), {
      x: MARGIN + 130,
      y: boxY,
      size: 9,
      font: ctx.font,
      color: COLORS.text,
    });
    boxY -= 22;
  }
  ctx.y -= boxHeight + 14;
}

function drawServiceCard(ctx, card) {
  const descLines = wrapText(card.description, 70);
  const cardHeight = 58 + descLines.length * 12;
  ensureSpace(ctx, cardHeight + 12);
  const top = ctx.y;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: top - cardHeight + 10,
    width: CONTENT_W,
    height: cardHeight,
    color: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
  });
  ctx.page.drawRectangle({
    x: MARGIN,
    y: top - cardHeight + 10,
    width: CONTENT_W,
    height: 28,
    color: COLORS.primaryLight,
  });
  ctx.page.drawText(sanitize(card.title), {
    x: MARGIN + 12,
    y: top - 10,
    size: 11,
    font: ctx.fontBold,
    color: COLORS.primaryDark,
  });
  if (card.badge) {
    const badge = sanitize(card.badge);
    const badgeW = badge.length * 5 + 14;
    const badgeBg =
      card.badgeColor ??
      (badge.toLowerCase() === "cortesia" ? COLORS.accentMuted : COLORS.primary);
    ctx.page.drawRectangle({
      x: PAGE_W - MARGIN - badgeW - 8,
      y: top - 22,
      width: badgeW,
      height: 16,
      color: badgeBg,
    });
    ctx.page.drawText(badge, {
      x: PAGE_W - MARGIN - badgeW,
      y: top - 18,
      size: 8,
      font: ctx.fontBold,
      color: COLORS.white,
    });
  }
  let cardY = top - 36;
  for (const line of descLines) {
    ctx.page.drawText(sanitize(line), {
      x: MARGIN + 12,
      y: cardY,
      size: 9,
      font: ctx.font,
      color: COLORS.textMuted,
    });
    cardY -= 12;
  }
  ctx.y = top - cardHeight - 8;
}

function renderCover(ctx) {
  const { proposal, branding, logo } = ctx;
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.pageNumber = 1;

  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_H - 320,
    width: PAGE_W,
    height: 320,
    color: rgb(0, 0, 0),
  });
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_H - 324,
    width: PAGE_W,
    height: 4,
    color: COLORS.accentLine,
  });

  if (logo) {
    const maxLogoH = proposal.coverLogoMaxHeight ?? 100;
    const scale = Math.min(220 / logo.width, maxLogoH / logo.height, 1);
    const logoW = logo.width * scale;
    const logoH = logo.height * scale;
    ctx.page.drawImage(logo, {
      x: (PAGE_W - logoW) / 2,
      y: PAGE_H - 40 - logoH,
      width: logoW,
      height: logoH,
    });
  }

  ctx.page.drawText("PROPUESTA COMERCIAL", {
    x: MARGIN,
    y: PAGE_H - 210,
    size: 26,
    font: ctx.fontBold,
    color: COLORS.white,
  });
  ctx.page.drawText(
    sanitize(proposal.coverSubtitle ?? "Transformacion digital para su negocio"),
    {
      x: MARGIN,
      y: PAGE_H - 238,
      size: 12,
      font: ctx.font,
      color: rgb(0.75, 0.75, 0.75),
    }
  );

  let y = PAGE_H - 360;
  ctx.page.drawText("Preparado para", {
    x: MARGIN,
    y,
    size: 9,
    font: ctx.font,
    color: COLORS.textMuted,
  });
  y -= 20;
  ctx.page.drawText(sanitize(proposal.clientName), {
    x: MARGIN,
    y,
    size: 18,
    font: ctx.fontBold,
    color: COLORS.text,
  });
  y -= 18;
  if (proposal.clientTagline) {
    ctx.page.drawText(sanitize(proposal.clientTagline), {
      x: MARGIN,
      y,
      size: 11,
      font: ctx.font,
      color: COLORS.textMuted,
    });
    y -= 28;
  } else {
    y -= 16;
  }

  drawInfoBoxOnPage(ctx.page, ctx.font, ctx.fontBold, y, [
    { label: "Referencia", value: proposal.number },
    { label: "Fecha", value: formatDate(proposal.sentAt) },
    { label: "Validez", value: formatDate(proposal.validUntil) },
    { label: "Elaborado por", value: branding.brandName },
  ]);

  ctx.page.drawText(
    sanitize("Documento confidencial. Uso exclusivo del destinatario."),
    {
      x: MARGIN,
      y: 52,
      size: 8,
      font: ctx.font,
      color: COLORS.textMuted,
    }
  );
  drawPageFooter(ctx);
}

function drawInfoBoxOnPage(page, font, fontBold, startY, rows) {
  const boxHeight = rows.length * 24 + 16;
  page.drawRectangle({
    x: MARGIN,
    y: startY - boxHeight,
    width: CONTENT_W,
    height: boxHeight,
    color: COLORS.primaryLight,
    borderColor: COLORS.border,
    borderWidth: 0.5,
  });
  let y = startY - 18;
  for (const row of rows) {
    page.drawText(sanitize(row.label), {
      x: MARGIN + 14,
      y,
      size: 9,
      font: fontBold,
      color: COLORS.textMuted,
    });
    page.drawText(sanitize(row.value), {
      x: MARGIN + 120,
      y,
      size: 10,
      font,
      color: COLORS.text,
    });
    y -= 24;
  }
}

function renderExecutiveSummary(ctx) {
  newPage(ctx);
  drawInnerPageHeader(ctx);
  drawSectionTitle(ctx, "Resumen ejecutivo");
  drawParagraph(
    ctx,
    ctx.proposal.executiveSummary ??
      "Presentamos una solucion integral para digitalizar las ventas y la atencion al cliente de su empresa, combinando un marketplace B2B, automatizacion con inteligencia artificial y presencia profesional en redes sociales."
  );
  drawInfoBox(ctx, [
    { label: "Cliente", value: ctx.proposal.clientName },
    { label: "Sector", value: ctx.proposal.clientSector ?? "Aseo, agua e industria" },
    { label: "Objetivo", value: ctx.proposal.objective ?? "Marketplace y automatizacion comercial" },
  ]);
  drawSectionTitle(ctx, "Contexto y oportunidad");
  drawParagraph(
    ctx,
    ctx.proposal.context ??
      "Vera Global Solutions requiere una plataforma que permita exhibir productos, recibir pedidos de forma ordenada y atender clientes de manera rapida y profesional por canales digitales, reduciendo la carga operativa del equipo comercial."
  );
}

function renderSolution(ctx) {
  newPage(ctx);
  drawInnerPageHeader(ctx);
  drawSectionTitle(ctx, "Solución propuesta");
  drawParagraph(
    ctx,
    ctx.proposal.solutionIntro ??
      "Hemos disenado un paquete integral que combina desarrollo del marketplace, la plataforma Integraciones Software & Hardware y servicios complementarios para acelerar su salida al mercado digital."
  );
  for (const service of ctx.proposal.services ?? []) {
    drawServiceCard(ctx, service);
  }
}

function renderBenefits(ctx) {
  newPage(ctx);
  drawInnerPageHeader(ctx);
  drawSectionTitle(ctx, "Beneficios para su empresa");
  drawBulletList(ctx, ctx.proposal.benefits ?? []);
  drawSectionTitle(ctx, "Alcance del proyecto");
  drawBulletList(ctx, ctx.proposal.scope ?? []);
}

function drawRightAlignedText(page, font, text, rightX, y, size, color) {
  const safe = sanitize(text);
  const width = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, {
    x: rightX - width,
    y,
    size,
    font,
    color,
  });
}

function drawPricingTable(ctx) {
  const rows = ctx.proposal.pricingRows ?? [];
  const { page, font, fontBold } = ctx;
  const headerH = 28;
  const rowH = 30;
  const summaryGap = 10;
  const initialRowH = 34;
  const recurringRowH = 46;
  const hasRecurringTotal = Boolean(ctx.proposal.recurringPlanValue);
  const footerH = summaryGap + initialRowH + (hasRecurringTotal ? recurringRowH : 0);
  const tableH = headerH + rows.length * rowH + footerH + 8;
  ensureSpace(ctx, tableH + 24);

  const tableTop = ctx.y;
  const tableBottom = tableTop - tableH + 10;
  const colConcept = MARGIN + 12;
  const colType = MARGIN + 286;
  const colValueRight = PAGE_W - MARGIN - 12;

  page.drawRectangle({
    x: MARGIN,
    y: tableBottom,
    width: CONTENT_W,
    height: tableH,
    borderColor: COLORS.border,
    borderWidth: 1,
    color: COLORS.white,
  });
  page.drawRectangle({
    x: MARGIN,
    y: tableTop - headerH + 10,
    width: CONTENT_W,
    height: headerH,
    color: COLORS.primaryDark,
  });

  page.drawText("Concepto", {
    x: colConcept,
    y: tableTop - 8,
    size: 9,
    font: fontBold,
    color: COLORS.white,
  });
  page.drawText("Tipo", {
    x: colType,
    y: tableTop - 8,
    size: 9,
    font: fontBold,
    color: COLORS.white,
  });
  drawRightAlignedText(page, fontBold, "Valor", colValueRight, tableTop - 8, 9, COLORS.white);

  let rowY = tableTop - headerH - 14;
  for (const row of rows) {
    page.drawLine({
      start: { x: MARGIN, y: rowY + 10 },
      end: { x: PAGE_W - MARGIN, y: rowY + 10 },
      thickness: 0.5,
      color: COLORS.border,
    });
    page.drawText(sanitize(row.concept), {
      x: colConcept,
      y: rowY,
      size: 9,
      font,
      color: COLORS.text,
    });
    page.drawText(sanitize(row.type), {
      x: colType,
      y: rowY,
      size: 8,
      font,
      color: COLORS.textMuted,
    });
    drawRightAlignedText(
      page,
      row.highlight ? fontBold : font,
      row.value,
      colValueRight,
      rowY,
      9,
      row.highlight ? COLORS.primaryDark : COLORS.text
    );
    rowY -= rowH;
  }

  const summaryTop = rowY + 10 - summaryGap;
  page.drawLine({
    start: { x: MARGIN, y: summaryTop },
    end: { x: PAGE_W - MARGIN, y: summaryTop },
    thickness: 1,
    color: COLORS.border,
  });

  const initialRowBottom = summaryTop - initialRowH;
  page.drawRectangle({
    x: MARGIN,
    y: initialRowBottom,
    width: CONTENT_W,
    height: initialRowH,
    color: COLORS.primaryLight,
  });
  page.drawText("Inversión inicial", {
    x: colConcept,
    y: initialRowBottom + 12,
    size: 10,
    font: fontBold,
    color: COLORS.text,
  });
  drawRightAlignedText(
    page,
    fontBold,
    ctx.proposal.initialInvestmentLabel ?? "",
    colValueRight,
    initialRowBottom + 11,
    11,
    COLORS.primaryDark
  );

  let bottomY = initialRowBottom - 8;
  if (hasRecurringTotal) {
    const recurringRowBottom = initialRowBottom - recurringRowH;
    page.drawLine({
      start: { x: MARGIN, y: initialRowBottom },
      end: { x: PAGE_W - MARGIN, y: initialRowBottom },
      thickness: 0.5,
      color: COLORS.border,
    });
    page.drawText(
      sanitize(ctx.proposal.recurringPlanLabel ?? "Plan Starter (mensual)"),
      {
        x: colConcept,
        y: recurringRowBottom + 24,
        size: 9,
        font,
        color: COLORS.text,
      }
    );
    page.drawText("Mensual", {
      x: colType,
      y: recurringRowBottom + 24,
      size: 8,
      font,
      color: COLORS.textMuted,
    });
    drawRightAlignedText(
      page,
      fontBold,
      ctx.proposal.recurringPlanValue ?? "",
      colValueRight,
      recurringRowBottom + 23,
      10,
      COLORS.text
    );
    page.drawText(
      sanitize(
        ctx.proposal.recurringPlanNote ?? "No incluido en la inversion inicial"
      ),
      {
        x: colConcept,
        y: recurringRowBottom + 10,
        size: 7,
        font,
        color: COLORS.textMuted,
      }
    );
    bottomY = recurringRowBottom - 12;
  }

  ctx.y = bottomY;
}

function drawVolumeTable(ctx, table) {
  const headers = table.headers ?? [];
  const rows = table.rows ?? [];
  if (!headers.length) return;

  const colCount = headers.length;
  const widths = table.widths ?? headers.map(() => 1 / colCount);
  const headerH = 26;
  const rowH = table.rowHeight ?? 20;
  const tableH = headerH + rows.length * rowH + 6;
  ensureSpace(ctx, tableH + 16);

  const { page, font, fontBold } = ctx;
  const tableTop = ctx.y;
  const tableBottom = tableTop - tableH + 8;
  const colXs = [];
  let x = MARGIN;
  for (const width of widths) {
    colXs.push(x);
    x += CONTENT_W * width;
  }

  page.drawRectangle({
    x: MARGIN,
    y: tableBottom,
    width: CONTENT_W,
    height: tableH,
    borderColor: COLORS.border,
    borderWidth: 1,
    color: COLORS.white,
  });
  page.drawRectangle({
    x: MARGIN,
    y: tableTop - headerH + 10,
    width: CONTENT_W,
    height: headerH,
    color: COLORS.primaryDark,
  });

  headers.forEach((header, index) => {
    page.drawText(sanitize(header), {
      x: colXs[index] + 8,
      y: tableTop - 6,
      size: 8,
      font: fontBold,
      color: COLORS.white,
    });
  });

  let rowY = tableTop - headerH - 6;
  rows.forEach((row) => {
    page.drawLine({
      start: { x: MARGIN, y: rowY + 12 },
      end: { x: PAGE_W - MARGIN, y: rowY + 12 },
      thickness: 0.5,
      color: COLORS.border,
    });
    row.forEach((cell, index) => {
      page.drawText(sanitize(cell), {
        x: colXs[index] + 8,
        y: rowY,
        size: 8,
        font: index === row.length - 1 ? fontBold : font,
        color: COLORS.text,
      });
    });
    rowY -= rowH;
  });

  ctx.y = tableBottom - 12;
}

function renderInvestment(ctx) {
  newPage(ctx);
  drawInnerPageHeader(ctx);
  drawSectionTitle(ctx, "Inversión y condiciones");
  drawParagraph(
    ctx,
    ctx.proposal.investmentIntro ??
      "A continuacion detallamos la estructura de costos: una inversion unica para el marketplace, una suscripcion mensual en dolares para la plataforma y consumo variable de mensajes WhatsApp."
  );
  drawPricingTable(ctx);
  if (ctx.proposal.recurringNote) {
    drawParagraph(ctx, ctx.proposal.recurringNote, { size: 9, color: COLORS.textMuted });
  }
  for (const table of ctx.proposal.volumeTables ?? []) {
    if (table.title) drawSectionTitle(ctx, table.title);
    if (table.intro) {
      drawParagraph(ctx, table.intro, { size: 9, color: COLORS.textMuted });
    }
    drawVolumeTable(ctx, table);
    if (table.note) {
      drawParagraph(ctx, table.note, { size: 8, color: COLORS.textMuted, gapAfter: 12 });
    }
  }
  if (ctx.proposal.excludedCosts?.length) {
    drawSectionTitle(ctx, "Costos no asumidos");
    drawParagraph(
      ctx,
      ctx.proposal.excludedCostsIntro ??
        "Los siguientes costos corren por cuenta del cliente y no estan incluidos en los valores de esta propuesta:",
      { size: 9, color: COLORS.textMuted }
    );
    drawBulletList(ctx, ctx.proposal.excludedCosts);
  }
}

function renderTermsAndNextSteps(ctx) {
  newPage(ctx);
  drawInnerPageHeader(ctx);
  drawSectionTitle(ctx, "Condiciones comerciales");
  drawBulletList(ctx, ctx.proposal.terms ?? []);
  drawSectionTitle(ctx, "Próximos pasos");
  drawBulletList(ctx, ctx.proposal.nextSteps ?? []);

  drawSignature(ctx);

  ensureSpace(ctx, 80);
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 64,
    width: CONTENT_W,
    height: 64,
    color: COLORS.primaryDark,
  });
  ctx.page.drawText(
    sanitize(ctx.proposal.closingTitle ?? "Listos para impulsar su negocio digital"),
    {
      x: MARGIN + 16,
      y: ctx.y - 22,
      size: 12,
      font: ctx.fontBold,
      color: COLORS.white,
    }
  );
  ctx.page.drawText(
    sanitize(`Contáctenos: ${formatContactInfo(ctx.branding)}`),
    {
      x: MARGIN + 16,
      y: ctx.y - 40,
      size: 9,
      font: ctx.font,
      color: rgb(0.75, 0.75, 0.75),
    }
  );
  ctx.y -= 80;
  ctx.y -= 16;

  drawParagraph(
    ctx,
    ctx.proposal.legalNote ??
      "Documento comercial sin validez fiscal. Los precios no incluyen IVA salvo indicacion expresa. Sujeto a disponibilidad de APIs de terceros (Meta/WhatsApp).",
    { size: 7, color: COLORS.textMuted, gapAfter: 0 }
  );
}

function drawSignature(ctx) {
  const signatory = ctx.proposal.signatory;
  if (!signatory?.name) return;

  const signature = ctx.signature;
  const sigScale = signature
    ? Math.min(150 / signature.width, 42 / signature.height, 1)
    : 0;
  const sigH = signature ? signature.height * sigScale : 0;
  const sigW = signature ? signature.width * sigScale : 0;

  ensureSpace(ctx, 150 + sigH);
  const blockTop = ctx.y;

  ctx.page.drawText("Atentamente,", {
    x: MARGIN,
    y: blockTop,
    size: 10,
    font: ctx.font,
    color: COLORS.text,
  });

  let nameY = blockTop - 28;
  if (signature) {
    ctx.page.drawImage(signature, {
      x: MARGIN,
      y: blockTop - 12 - sigH,
      width: sigW,
      height: sigH,
    });
    nameY = blockTop - 18 - sigH;
  }

  ctx.page.drawText(sanitize(signatory.name), {
    x: MARGIN,
    y: nameY,
    size: 12,
    font: ctx.fontBold,
    color: COLORS.text,
  });

  if (signatory.title) {
    ctx.page.drawText(sanitize(signatory.title), {
      x: MARGIN,
      y: nameY - 16,
      size: 9,
      font: ctx.font,
      color: COLORS.textMuted,
    });
    ctx.y = nameY - 34;
  } else {
    ctx.y = nameY - 20;
  }
}
