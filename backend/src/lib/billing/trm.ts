const TRM_DATASET_URL =
  "https://www.datos.gov.co/resource/32sa-z8j3.json?$order=vigenciadesde%20DESC&$limit=1";

type TrmCache = {
  dateKey: string;
  value: number;
};

let cache: TrmCache | null = null;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseTrmValue(row: Record<string, unknown>): number | null {
  const raw = row.valor ?? row.valor_certificado ?? row.value;
  const value = typeof raw === "string" ? Number.parseFloat(raw) : Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function roundCopToNearestThousand(cop: number): number {
  return Math.round(cop / 1000) * 1000;
}

export function copToAmountCents(cop: number): number {
  return Math.round(cop * 100);
}

export function usdToCopWithTrm(usd: number, trm: number): number {
  return roundCopToNearestThousand(usd * trm);
}

export async function getTrmCopPerUsd(): Promise<number> {
  const dateKey = todayKey();
  if (cache?.dateKey === dateKey) return cache.value;

  const fallback = Number(process.env.BILLING_TRM_FALLBACK_COP);
  const hasFallback = Number.isFinite(fallback) && fallback > 0;

  try {
    const response = await fetch(TRM_DATASET_URL, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`TRM HTTP ${response.status}`);
    const rows = (await response.json()) as Record<string, unknown>[];
    const row = rows[0];
    if (!row) throw new Error("TRM dataset empty");
    const value = parseTrmValue(row);
    if (!value) throw new Error("TRM value missing");
    cache = { dateKey, value };
    return value;
  } catch (error) {
    console.warn("TRM fetch failed:", error);
    if (cache) return cache.value;
    if (hasFallback) {
      cache = { dateKey, value: fallback };
      return fallback;
    }
    throw new Error("TRM not available");
  }
}

export async function calculateUsdPriceInCopCents(
  usd: number
): Promise<{ amountCents: number; trm: number }> {
  const trm = await getTrmCopPerUsd();
  const cop = usdToCopWithTrm(usd, trm);
  return { amountCents: copToAmountCents(cop), trm };
}

export function resetTrmCacheForTests(): void {
  cache = null;
}
