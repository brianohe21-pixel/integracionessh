import { PLAN_LIST_PRICE_USD, PRO_PLAN_CATALOG_LIMITS } from "@/lib/plan-config";

export type QuotePlanKind = "pro" | "reseller";

export type WhatsappMessageCategory =
  | "marketing"
  | "utility"
  | "authentication"
  | "service";

export const WHATSAPP_MESSAGE_CATEGORIES: WhatsappMessageCategory[] = [
  "marketing",
  "utility",
  "authentication",
  "service",
];

export const RESELLER_LIST_PRICE_USD = 999;
export const RESELLER_DEFAULT_MESSAGE_BAG = 50_000;
export const DEFAULT_QUOTE_VALIDITY_DAYS = 15;
export const DEFAULT_TRM_COP = 4100;

export type WhatsappCategoryFeesCents = Record<WhatsappMessageCategory, number>;
export type WhatsappCategoryMessages = Record<WhatsappMessageCategory, number>;

export interface WhatsappCategoryBreakdown {
  category: WhatsappMessageCategory;
  messages: number;
  feePerMessageCents: number;
  amountCop: number;
  amountUsd: number;
}

export interface ProQuoteInput {
  baseFeeUsd: number;
  trm: number;
  includedMessages: number;
  expectedMessages: number;
  pricePerMessageCents: number;
  whatsappCategoryFeesCents: WhatsappCategoryFeesCents;
  whatsappCategoryMessages: WhatsappCategoryMessages;
  discountPercent: number;
}

export interface ResellerQuoteInput {
  baseFeeUsd: number;
  trm: number;
  subaccounts: number;
  messageBag: number;
  expectedMessages: number;
  pricePerMessageCents: number;
  whatsappCategoryFeesCents: WhatsappCategoryFeesCents;
  whatsappCategoryMessages: WhatsappCategoryMessages;
  marginPercent: number;
}

export interface QuoteLine {
  key: string;
  amountCop: number;
  amountUsd: number;
}

export interface ProQuoteResult {
  kind: "pro";
  baseFeeCop: number;
  baseFeeUsd: number;
  discountedFeeCop: number;
  discountedFeeUsd: number;
  discountCop: number;
  discountUsd: number;
  overageMessages: number;
  overageCop: number;
  overageUsd: number;
  whatsappMessages: number;
  whatsappFeeCop: number;
  whatsappFeeUsd: number;
  whatsappBreakdown: WhatsappCategoryBreakdown[];
  totalCop: number;
  totalUsd: number;
  lines: QuoteLine[];
}

export interface ResellerQuoteResult {
  kind: "reseller";
  baseFeeCop: number;
  baseFeeUsd: number;
  overageMessages: number;
  overageCop: number;
  overageUsd: number;
  whatsappMessages: number;
  whatsappFeeCop: number;
  whatsappFeeUsd: number;
  whatsappBreakdown: WhatsappCategoryBreakdown[];
  platformCostCop: number;
  platformCostUsd: number;
  suggestedPriceCop: number;
  suggestedPriceUsd: number;
  marginCop: number;
  marginUsd: number;
  costPerSubaccountCop: number;
  costPerSubaccountUsd: number;
  lines: QuoteLine[];
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function usdToCop(usd: number, trm: number): number {
  return Math.round(clampNonNegative(usd) * clampNonNegative(trm));
}

export function copToUsd(cop: number, trm: number): number {
  const rate = clampNonNegative(trm);
  if (rate <= 0) return 0;
  return Math.round((clampNonNegative(cop) / rate) * 100) / 100;
}

export function centsToPesos(cents: number): number {
  return clampNonNegative(cents) / 100;
}

export function defaultWhatsappCategoryFeesCents(): WhatsappCategoryFeesCents {
  return {
    marketing: 0,
    utility: 0,
    authentication: 0,
    service: 0,
  };
}

export function defaultWhatsappCategoryMessages(
  totalMessages = 0
): WhatsappCategoryMessages {
  const utilityShare = Math.floor(clampNonNegative(totalMessages));
  return {
    marketing: 0,
    utility: utilityShare,
    authentication: 0,
    service: 0,
  };
}

export function totalWhatsappMessages(messages: WhatsappCategoryMessages): number {
  return WHATSAPP_MESSAGE_CATEGORIES.reduce(
    (sum, category) => sum + Math.floor(clampNonNegative(messages[category])),
    0
  );
}

export function computeWhatsappCategoryBreakdown(
  feesCents: WhatsappCategoryFeesCents,
  messages: WhatsappCategoryMessages,
  trm: number
): { totalCop: number; totalMessages: number; breakdown: WhatsappCategoryBreakdown[] } {
  const breakdown = WHATSAPP_MESSAGE_CATEGORIES.map((category) => {
    const count = Math.floor(clampNonNegative(messages[category]));
    const feeCents = clampNonNegative(feesCents[category]);
    const feePesos = centsToPesos(feeCents);
    const amountCop = Math.round(count === 0 ? feePesos : count * feePesos);
    return {
      category,
      messages: count,
      feePerMessageCents: feeCents,
      amountCop,
      amountUsd: copToUsd(amountCop, trm),
    };
  });

  return {
    totalCop: breakdown.reduce((sum, row) => sum + row.amountCop, 0),
    totalMessages: breakdown.reduce((sum, row) => sum + row.messages, 0),
    breakdown,
  };
}

export function defaultProQuoteInput(overrides?: Partial<ProQuoteInput>): ProQuoteInput {
  const includedMessages = PRO_PLAN_CATALOG_LIMITS.maxMessagesPerMonth;
  return {
    baseFeeUsd: PLAN_LIST_PRICE_USD.pro,
    trm: DEFAULT_TRM_COP,
    includedMessages,
    expectedMessages: includedMessages,
    pricePerMessageCents: 0,
    whatsappCategoryFeesCents: defaultWhatsappCategoryFeesCents(),
    whatsappCategoryMessages: defaultWhatsappCategoryMessages(includedMessages),
    discountPercent: 0,
    ...overrides,
  };
}

export function defaultResellerQuoteInput(
  overrides?: Partial<ResellerQuoteInput>
): ResellerQuoteInput {
  return {
    baseFeeUsd: RESELLER_LIST_PRICE_USD,
    trm: DEFAULT_TRM_COP,
    subaccounts: 25,
    messageBag: RESELLER_DEFAULT_MESSAGE_BAG,
    expectedMessages: RESELLER_DEFAULT_MESSAGE_BAG,
    pricePerMessageCents: 0,
    whatsappCategoryFeesCents: defaultWhatsappCategoryFeesCents(),
    whatsappCategoryMessages: defaultWhatsappCategoryMessages(RESELLER_DEFAULT_MESSAGE_BAG),
    marginPercent: 20,
    ...overrides,
  };
}

export function calculateProQuote(input: ProQuoteInput): ProQuoteResult {
  const baseFeeUsd = clampNonNegative(input.baseFeeUsd);
  const trm = clampNonNegative(input.trm);
  const includedMessages = Math.floor(clampNonNegative(input.includedMessages));
  const expectedMessages = Math.floor(clampNonNegative(input.expectedMessages));
  const pricePerMessagePesos = centsToPesos(input.pricePerMessageCents);
  const discountPercent = clampPercent(input.discountPercent);

  const baseFeeCop = usdToCop(baseFeeUsd, trm);
  const discountCop = Math.round(baseFeeCop * (discountPercent / 100));
  const discountedFeeCop = baseFeeCop - discountCop;
  const overageMessages = Math.max(0, expectedMessages - includedMessages);
  const overageCop = Math.round(overageMessages * pricePerMessagePesos);
  const whatsapp = computeWhatsappCategoryBreakdown(
    input.whatsappCategoryFeesCents,
    input.whatsappCategoryMessages,
    trm
  );
  const totalCop = discountedFeeCop + overageCop + whatsapp.totalCop;

  const discountUsd = copToUsd(discountCop, trm);
  const discountedFeeUsd = copToUsd(discountedFeeCop, trm);
  const overageUsd = copToUsd(overageCop, trm);
  const whatsappFeeUsd = copToUsd(whatsapp.totalCop, trm);
  const totalUsd = copToUsd(totalCop, trm);

  return {
    kind: "pro",
    baseFeeCop,
    baseFeeUsd,
    discountedFeeCop,
    discountedFeeUsd,
    discountCop,
    discountUsd,
    overageMessages,
    overageCop,
    overageUsd,
    whatsappMessages: whatsapp.totalMessages,
    whatsappFeeCop: whatsapp.totalCop,
    whatsappFeeUsd,
    whatsappBreakdown: whatsapp.breakdown,
    totalCop,
    totalUsd,
    lines: [
      { key: "baseFee", amountCop: baseFeeCop, amountUsd: baseFeeUsd },
      { key: "discount", amountCop: -discountCop, amountUsd: -discountUsd },
      { key: "overage", amountCop: overageCop, amountUsd: overageUsd },
      { key: "whatsappFee", amountCop: whatsapp.totalCop, amountUsd: whatsappFeeUsd },
      { key: "total", amountCop: totalCop, amountUsd: totalUsd },
    ],
  };
}

export function calculateResellerQuote(input: ResellerQuoteInput): ResellerQuoteResult {
  const baseFeeUsd = clampNonNegative(input.baseFeeUsd);
  const trm = clampNonNegative(input.trm);
  const subaccounts = Math.max(1, Math.floor(clampNonNegative(input.subaccounts)));
  const messageBag = Math.floor(clampNonNegative(input.messageBag));
  const expectedMessages = Math.floor(clampNonNegative(input.expectedMessages));
  const pricePerMessagePesos = centsToPesos(input.pricePerMessageCents);
  const marginPercent = clampPercent(input.marginPercent);

  const baseFeeCop = usdToCop(baseFeeUsd, trm);
  const overageMessages = Math.max(0, expectedMessages - messageBag);
  const overageCop = Math.round(overageMessages * pricePerMessagePesos);
  const whatsapp = computeWhatsappCategoryBreakdown(
    input.whatsappCategoryFeesCents,
    input.whatsappCategoryMessages,
    trm
  );
  const platformCostCop = baseFeeCop + overageCop + whatsapp.totalCop;
  const suggestedPriceCop = Math.round(platformCostCop * (1 + marginPercent / 100));
  const marginCop = suggestedPriceCop - platformCostCop;
  const costPerSubaccountCop = Math.round(platformCostCop / subaccounts);

  const overageUsd = copToUsd(overageCop, trm);
  const whatsappFeeUsd = copToUsd(whatsapp.totalCop, trm);
  const platformCostUsd = copToUsd(platformCostCop, trm);
  const suggestedPriceUsd = copToUsd(suggestedPriceCop, trm);
  const marginUsd = copToUsd(marginCop, trm);
  const costPerSubaccountUsd = copToUsd(costPerSubaccountCop, trm);

  return {
    kind: "reseller",
    baseFeeCop,
    baseFeeUsd,
    overageMessages,
    overageCop,
    overageUsd,
    whatsappMessages: whatsapp.totalMessages,
    whatsappFeeCop: whatsapp.totalCop,
    whatsappFeeUsd,
    whatsappBreakdown: whatsapp.breakdown,
    platformCostCop,
    platformCostUsd,
    suggestedPriceCop,
    suggestedPriceUsd,
    marginCop,
    marginUsd,
    costPerSubaccountCop,
    costPerSubaccountUsd,
    lines: [
      { key: "baseFee", amountCop: baseFeeCop, amountUsd: baseFeeUsd },
      { key: "overage", amountCop: overageCop, amountUsd: overageUsd },
      { key: "whatsappFee", amountCop: whatsapp.totalCop, amountUsd: whatsappFeeUsd },
      { key: "platformCost", amountCop: platformCostCop, amountUsd: platformCostUsd },
      { key: "margin", amountCop: marginCop, amountUsd: marginUsd },
      { key: "suggestedPrice", amountCop: suggestedPriceCop, amountUsd: suggestedPriceUsd },
    ],
  };
}

export function formatCopAmount(pesos: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(pesos);
}

export function formatUsdAmount(usd: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(usd);
}
