const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENDED = "^{}\\[~]|€";

function isGsm7(text: string): boolean {
  for (const char of text) {
    if (GSM_BASIC.includes(char) || GSM_EXTENDED.includes(char)) continue;
    return false;
  }
  return true;
}

function gsmLength(text: string): number {
  let length = 0;
  for (const char of text) {
    length += GSM_EXTENDED.includes(char) ? 2 : 1;
  }
  return length;
}

export interface SmsSegmentInfo {
  encoding: "gsm7" | "ucs2";
  chars: number;
  segments: number;
  maxSingle: number;
  maxConcat: number;
}

export interface SmsMessageRow {
  to: string;
  text: string;
}

export interface SmsSegmentRowAnalysis extends SmsSegmentInfo {
  to: string;
  preview: string;
}

export interface SmsSegmentAnalysisSummary {
  total: number;
  overOneSegment: number;
  estimatedBillableSegments: number;
  byEncoding: { gsm7: number; ucs2: number };
  samples: SmsSegmentRowAnalysis[];
}

const PREVIEW_MAX = 120;

export function getSmsSegmentInfo(text: string): SmsSegmentInfo {
  const gsm = isGsm7(text);
  if (gsm) {
    const chars = gsmLength(text);
    const maxSingle = 160;
    const maxConcat = 153;
    const segments = chars === 0 ? 0 : chars <= maxSingle ? 1 : Math.ceil(chars / maxConcat);
    return { encoding: "gsm7", chars, segments, maxSingle, maxConcat };
  }

  const chars = [...text].length;
  const maxSingle = 70;
  const maxConcat = 67;
  const segments = chars === 0 ? 0 : chars <= maxSingle ? 1 : Math.ceil(chars / maxConcat);
  return { encoding: "ucs2", chars, segments, maxSingle, maxConcat };
}

function previewText(text: string): string {
  if (text.length <= PREVIEW_MAX) return text;
  return `${text.slice(0, PREVIEW_MAX)}…`;
}

export function analyzeSmsMessages(
  rows: SmsMessageRow[],
  options?: { sampleLimit?: number }
): SmsSegmentAnalysisSummary {
  const sampleLimit = options?.sampleLimit ?? 20;
  let overOneSegment = 0;
  let estimatedBillableSegments = 0;
  const byEncoding = { gsm7: 0, ucs2: 0 };
  const samples: SmsSegmentRowAnalysis[] = [];

  for (const row of rows) {
    const text = row.text ?? "";
    const info = getSmsSegmentInfo(text);
    estimatedBillableSegments += info.segments;
    byEncoding[info.encoding] += 1;
    if (info.segments > 1) {
      overOneSegment += 1;
      if (samples.length < sampleLimit) {
        samples.push({
          to: row.to,
          preview: previewText(text),
          ...info,
        });
      }
    }
  }

  return {
    total: rows.length,
    overOneSegment,
    estimatedBillableSegments,
    byEncoding,
    samples,
  };
}

export function resolveSmsFreeTextMessages(
  sharedText: string | undefined,
  recipients: Array<{ to: string; text?: string | undefined }>
): SmsMessageRow[] {
  const shared = sharedText?.trim() ?? "";
  return recipients
    .map((recipient) => {
      const text = recipient.text?.trim() || shared;
      return { to: recipient.to, text };
    })
    .filter((row) => row.text.length > 0);
}
