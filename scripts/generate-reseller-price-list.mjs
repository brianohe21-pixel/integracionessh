import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const PUBLIC_STARTER_USD = 80;
const PUBLIC_PRO_USD = 199;
const PRO_RANGE_CEILING_USD = 699;
const RESELLER_PLAN_DISCOUNT = 0.3;
const PRO_CLIENT_BANDS = [
  [199, 299],
  [300, 499],
  [500, 699],
];
const RESELLER_WHATSAPP_FEE_COP = 20;
const SMS_RESELLER_MARGIN_COP = 1;
const REFERENCE_TRM = 4100;

const SMS_TIERS = [
  ["0 a 500.000 SMS", 12],
  ["500.000 a 1.000.000 SMS", 11.5],
  ["1.000.000 a 1.500.000 SMS", 11],
  ["1.500.001 a 2.000.000 SMS", 10.5],
  ["2.000.001 a 2.500.000 SMS", 10],
  ["Más de 3.000.000 SMS", 9.5],
];

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLORS = {
  ink: rgb(0.1, 0.1, 0.1),
  text: rgb(0.12, 0.12, 0.14),
  muted: rgb(0.38, 0.38, 0.42),
  line: rgb(0.82, 0.82, 0.82),
  zebra: rgb(0.96, 0.96, 0.96),
  white: rgb(1, 1, 1),
  header: rgb(0.08, 0.08, 0.08),
  highlight: rgb(0.93, 0.93, 0.93),
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
  return output.replace(/[ \t]+/g, " ").trim();
}

function partnerUsd(listUsd) {
  return Math.round(listUsd * (1 - RESELLER_PLAN_DISCOUNT));
}

function usdBand(min, max) {
  const format = (amount) => Math.round(amount).toLocaleString("en-US");
  return `USD ${format(min)} a ${format(max)}`;
}

function usd(amount) {
  const rounded = Math.round(amount);
  return `USD ${rounded.toLocaleString("en-US")}`;
}

function copThousands(amount) {
  const rounded = Math.round(amount);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$${formatted}`;
}

function copUnit(amount) {
  return `$${amount.toFixed(2)}`;
}

function formatLongDate(date) {
  return date.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function wrapText(text, font, size, maxWidth) {
  const words = sanitize(text).split(" ").filter(Boolean);
  if (words.length === 0) return [""];
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
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

function createContext(pdf, font, fontBold, logo) {
  return {
    pdf,
    font,
    fontBold,
    logo,
    page: null,
    y: 0,
    pageNumber: 0,
  };
}

function drawFooter(ctx) {
  const { page, font, pageNumber } = ctx;
  page.drawLine({
    start: { x: MARGIN, y: 36 },
    end: { x: PAGE_W - MARGIN, y: 36 },
    thickness: 0.4,
    color: COLORS.line,
  });
  page.drawText("Integraciones Software & Hardware  |  integracionessh.lat  |  WhatsApp 322 311 7078", {
    x: MARGIN,
    y: 22,
    size: 7,
    font,
    color: COLORS.muted,
  });
  const label = `Página ${pageNumber}`;
  page.drawText(label, {
    x: PAGE_W - MARGIN - font.widthOfTextAtSize(label, 7),
    y: 22,
    size: 7,
    font,
    color: COLORS.muted,
  });
}

function newPage(ctx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.pageNumber += 1;
  ctx.y = PAGE_H - 28;
  drawFooter(ctx);
}

function drawBand(ctx) {
  const bandH = 78;
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_H - bandH,
    width: PAGE_W,
    height: bandH,
    color: COLORS.header,
  });
  if (ctx.logo) {
    const maxW = 150;
    const maxH = 58;
    const scale = Math.min(maxW / ctx.logo.width, maxH / ctx.logo.height);
    const width = ctx.logo.width * scale;
    const height = ctx.logo.height * scale;
    ctx.page.drawImage(ctx.logo, {
      x: MARGIN,
      y: PAGE_H - bandH + (bandH - height) / 2,
      width,
      height,
    });
  }
  const title = "Lista de precios";
  const subtitle = "Canal reseller";
  ctx.page.drawText(title, {
    x: PAGE_W - MARGIN - ctx.fontBold.widthOfTextAtSize(title, 14),
    y: PAGE_H - 36,
    size: 14,
    font: ctx.fontBold,
    color: COLORS.white,
  });
  ctx.page.drawText(subtitle, {
    x: PAGE_W - MARGIN - ctx.font.widthOfTextAtSize(subtitle, 9),
    y: PAGE_H - 52,
    size: 9,
    font: ctx.font,
    color: rgb(0.82, 0.82, 0.82),
  });
  ctx.y = PAGE_H - bandH - 22;
}

function ensureSpace(ctx, needed) {
  if (ctx.y - needed < 52) {
    newPage(ctx);
    drawBand(ctx);
  }
}

function drawParagraph(ctx, text, options = {}) {
  const size = options.size ?? 9.5;
  const lineHeight = options.lineHeight ?? 13;
  const color = options.color ?? COLORS.text;
  const font = options.bold ? ctx.fontBold : ctx.font;
  const lines = wrapText(text, font, size, CONTENT_W);
  ensureSpace(ctx, lines.length * lineHeight + 4);
  for (const line of lines) {
    ctx.page.drawText(line, { x: MARGIN, y: ctx.y, size, font, color });
    ctx.y -= lineHeight;
  }
  ctx.y -= options.gapAfter ?? 8;
}

function drawSectionTitle(ctx, title, minFollowing = 0) {
  ensureSpace(ctx, 28 + minFollowing);
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 4,
    width: 3,
    height: 14,
    color: COLORS.ink,
  });
  ctx.page.drawText(sanitize(title), {
    x: MARGIN + 10,
    y: ctx.y,
    size: 12,
    font: ctx.fontBold,
    color: COLORS.ink,
  });
  ctx.y -= 20;
}

function cellLines(cell, font, size, maxWidth) {
  return String(cell)
    .split("\n")
    .flatMap((part) => wrapText(part, font, size, maxWidth));
}

function measureRow(cells, widths, font, size) {
  const padX = 6;
  const padY = 5;
  const lineHeight = size + 3;
  const wrapped = cells.map((cell, index) =>
    cellLines(cell, font, size, widths[index] - padX * 2)
  );
  const lines = Math.max(...wrapped.map((item) => item.length), 1);
  return { wrapped, height: lines * lineHeight + padY * 2, lineHeight, padX, padY };
}

function drawTable(ctx, headers, rows, widths, options = {}) {
  const headerSize = 7.5;
  const bodySize = options.bodySize ?? 8;
  const headerMeasure = measureRow(headers, widths, ctx.fontBold, headerSize);
  const bodyMeasures = rows.map((row) => measureRow(row, widths, ctx.font, bodySize));
  const tableHeight = headerMeasure.height + bodyMeasures.reduce((sum, row) => sum + row.height, 0);
  ensureSpace(ctx, tableHeight + 8);

  let yTop = ctx.y + 8;
  const drawRow = (measure, font, size, background, color, boldFirst) => {
    ctx.page.drawRectangle({
      x: MARGIN,
      y: yTop - measure.height,
      width: CONTENT_W,
      height: measure.height,
      color: background,
    });
    let x = MARGIN;
    measure.wrapped.forEach((lines, index) => {
      const cellFont = boldFirst && index === 0 ? ctx.fontBold : font;
      let textY = yTop - measure.padY - size;
      for (const line of lines) {
        ctx.page.drawText(line, {
          x: x + measure.padX,
          y: textY,
          size,
          font: cellFont,
          color,
        });
        textY -= measure.lineHeight;
      }
      x += widths[index];
    });
    yTop -= measure.height;
  };

  drawRow(headerMeasure, ctx.fontBold, headerSize, COLORS.header, COLORS.white, false);
  bodyMeasures.forEach((measure, index) => {
    drawRow(
      measure,
      ctx.font,
      bodySize,
      index % 2 === 0 ? COLORS.white : COLORS.zebra,
      COLORS.text,
      true
    );
  });

  ctx.page.drawRectangle({
    x: MARGIN,
    y: yTop,
    width: CONTENT_W,
    height: tableHeight,
    borderColor: COLORS.line,
    borderWidth: 0.6,
  });

  let ruleX = MARGIN;
  for (let index = 0; index < widths.length - 1; index += 1) {
    ruleX += widths[index];
    ctx.page.drawLine({
      start: { x: ruleX, y: yTop },
      end: { x: ruleX, y: yTop + tableHeight },
      thickness: 0.3,
      color: COLORS.line,
    });
  }

  ctx.y = yTop - 12;
}

function drawBullet(ctx, text) {
  const size = 9;
  const lineHeight = 12;
  const lines = wrapText(text, ctx.font, size, CONTENT_W - 14);
  ensureSpace(ctx, lines.length * lineHeight + 2);
  ctx.page.drawText("-", {
    x: MARGIN,
    y: ctx.y,
    size,
    font: ctx.fontBold,
    color: COLORS.ink,
  });
  for (const line of lines) {
    ctx.page.drawText(line, {
      x: MARGIN + 12,
      y: ctx.y,
      size,
      font: ctx.font,
      color: COLORS.text,
    });
    ctx.y -= lineHeight;
  }
  ctx.y -= 2;
}

const starterPartner = partnerUsd(PUBLIC_STARTER_USD);
const proResellerFloor = partnerUsd(PUBLIC_PRO_USD);
const proResellerCeiling = partnerUsd(PRO_RANGE_CEILING_USD);
const issuedAt = new Date();
const validUntil = new Date(issuedAt);
validUntil.setDate(validUntil.getDate() + 30);

const planWidths = [180, 335];
const proBandWidths = [220, 295];
const limitWidths = [340, 175];
const whatsappWidths = [300, 215];
const smsWidths = [300, 215];

let logoBytes;
try {
  logoBytes = await readFile(join(root, "scripts/assets/ish-logo.png"));
} catch {
  logoBytes = undefined;
}

const pdf = await PDFDocument.create();
pdf.setTitle("Lista de precios - Canal reseller");
pdf.setAuthor("Integraciones Software & Hardware");
pdf.setSubject("Precio que paga el partner por la plataforma");

const font = await pdf.embedFont(StandardFonts.Helvetica);
const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
const logo = await embedLogo(pdf, logoBytes);
const ctx = createContext(pdf, font, fontBold, logo);

newPage(ctx);
drawBand(ctx);

drawParagraph(
  ctx,
  `Documento confidencial para partners. Emitido el ${formatLongDate(issuedAt)}. Vigente hasta el ${formatLongDate(validUntil)}.`,
  { size: 8, color: COLORS.muted, gapAfter: 10 }
);

drawParagraph(
  ctx,
  "Estos valores son lo que el partner paga a Integraciones Software & Hardware. Starter tiene un precio fijo. En Pro los cupos se acuerdan con cada cliente y el cargo mensual del partner queda en una de las bandas."
);

drawParagraph(
  ctx,
  "WhatsApp y SMS se cobran al precio reseller de cada tabla. Al SMS se suma IVA."
);

drawSectionTitle(ctx, "Starter");

drawTable(
  ctx,
  ["Plan", "Precio reseller"],
  [
    [
      "Starter",
      `${usd(starterPartner)} / mes\n${copThousands(starterPartner * REFERENCE_TRM)} COP`,
    ],
  ],
  planWidths
);

drawSectionTitle(ctx, "Pro, rangos de precio reseller", 130);

drawTable(
  ctx,
  ["Banda", "Precio reseller"],
  [
    ...PRO_CLIENT_BANDS.map(([min, max], index) => [
      ["Inicial", "Media", "Alta"][index],
      `${usdBand(partnerUsd(min), partnerUsd(max))} / mes`,
    ]),
    [`Más de ${usd(proResellerCeiling)} / mes`, "A cotizar"],
  ],
  proBandWidths
);

drawParagraph(
  ctx,
  `El piso de Pro es ${usd(proResellerFloor)} al mes por empresa (${copThousands(proResellerFloor * REFERENCE_TRM)} COP con TRM ${REFERENCE_TRM.toLocaleString("es-CO")}). La banda no fija los límites: se acuerdan en el contrato. Por encima de ${usd(proResellerCeiling)} al mes se cotiza. El cobro en Colombia usa la TRM del día de la factura.`,
  { size: 8, color: COLORS.muted, gapAfter: 12 }
);

drawSectionTitle(ctx, "Límites fijos de Starter");

drawTable(
  ctx,
  ["Capacidad", "Incluido"],
  [
    ["Bots activos", "2"],
    ["Números de WhatsApp por bot", "5"],
    ["Respuestas de IA al mes", "2.000"],
    ["Contactos", "2.000"],
    ["Campañas activas", "2"],
    ["Minutos de voz al mes", "60"],
    ["Base de conocimiento", "25 MB"],
    ["Pedidos al mes", "500"],
    ["Marca propia", "No"],
  ],
  limitWidths
);

drawParagraph(
  ctx,
  "Pro no publica estos topes. Cada cupo se negocia con el cliente y puede quedar por encima o por debajo de Starter.",
  { size: 8, color: COLORS.muted, gapAfter: 12 }
);

drawSectionTitle(ctx, "WhatsApp, por mensaje", 180);

drawTable(
  ctx,
  ["Categoría", "Precio reseller"],
  [
    ["Servicio, ventana 24 h", copUnit(RESELLER_WHATSAPP_FEE_COP)],
    ["Utilidad", copUnit(RESELLER_WHATSAPP_FEE_COP)],
    ["Marketing", copUnit(RESELLER_WHATSAPP_FEE_COP)],
  ],
  whatsappWidths
);

drawParagraph(
  ctx,
  `Precio por mensaje que paga el partner: ${copUnit(RESELLER_WHATSAPP_FEE_COP)} COP en servicio, utilidad y marketing.`,
  { size: 8, color: COLORS.muted }
);

drawSectionTitle(ctx, "SMS, precio final por volumen", 200);

drawTable(
  ctx,
  ["Volumen del mes", "Precio reseller"],
  SMS_TIERS.map(([label, publicPrice]) => [
    label,
    copUnit(publicPrice - SMS_RESELLER_MARGIN_COP),
  ]),
  smsWidths
);

drawParagraph(
  ctx,
  "El tramo se calcula con el volumen del mes en curso y no es retroactivo. Al precio se suma IVA del 19%. Ejemplo en el primer tramo: 2.000 SMS son $22.000 COP más IVA.",
  { size: 8, color: COLORS.muted }
);

drawSectionTitle(ctx, "Cómo se factura", 120);

drawBullet(ctx, "Cada empresa del partner es una subcuenta. La suscripción se paga por adelantado cada 30 días.");
drawBullet(ctx, "WhatsApp y SMS se liquidan al cierre del mes, según el consumo real.");
drawBullet(ctx, "Integraciones Software & Hardware factura al partner los precios de esta lista.");
drawBullet(ctx, "La marca blanca aplica en las subcuentas. El partner puede usar su propia app de Meta o la de la plataforma.");
drawBullet(ctx, "Los precios de suscripción no incluyen IVA. El SMS sí: IVA del 19% sobre el precio final del mensaje.");
drawBullet(ctx, `En Pro el precio reseller parte de ${usd(proResellerFloor)} al mes. Los límites se negocian con cada cliente y el cargo queda en la banda que corresponda.`);
drawBullet(ctx, "Un volumen mayor o un SLA se cotiza aparte. Esta lista no cubre desarrollos a la medida.");

ctx.y -= 6;
drawParagraph(
  ctx,
  "Documento comercial, confidencial y sin validez fiscal. No incluye pauta, numeración telefónica, pasarelas de pago ni licencias de terceros.",
  { size: 8, color: COLORS.muted, gapAfter: 0 }
);

const outputPath = join(root, "lista-precios-resellers.pdf");
await writeFile(outputPath, await pdf.save());

console.log(`PDF generado: ${outputPath}`);
console.log(`Vigente hasta: ${formatLongDate(validUntil)}`);
console.log(`Starter reseller: ${usd(starterPartner)}`);
console.log(`Pro reseller: desde ${usd(proResellerFloor)}`);
