import { buildCsv, downloadCsvFile } from "@/lib/csv";

const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENDED = "^{}\\[~]|€";
const PREVIEW_MAX = 120;

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
  overLimit: SmsSegmentRowAnalysis[];
}

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

export function renderSmsTemplateBody(body: string, values: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, index: string) => {
    const position = parseInt(index, 10) - 1;
    const value = values[position];
    return value !== undefined && value !== "" ? value : `{{${index}}}`;
  });
}

function previewText(text: string): string {
  if (text.length <= PREVIEW_MAX) return text;
  return `${text.slice(0, PREVIEW_MAX)}…`;
}

export function analyzeSmsMessages(rows: SmsMessageRow[]): SmsSegmentAnalysisSummary {
  let overOneSegment = 0;
  let estimatedBillableSegments = 0;
  const byEncoding = { gsm7: 0, ucs2: 0 };
  const overLimit: SmsSegmentRowAnalysis[] = [];

  for (const row of rows) {
    const text = row.text ?? "";
    const info = getSmsSegmentInfo(text);
    estimatedBillableSegments += info.segments;
    byEncoding[info.encoding] += 1;
    if (info.segments > 1) {
      overOneSegment += 1;
      overLimit.push({
        to: row.to,
        preview: previewText(text),
        ...info,
      });
    }
  }

  return {
    total: rows.length,
    overOneSegment,
    estimatedBillableSegments,
    byEncoding,
    overLimit,
  };
}

export function downloadSmsOverLimitCsv(
  analysis: SmsSegmentAnalysisSummary,
  filename = "sms_over_one_segment.csv"
): void {
  const headers = ["phone", "chars", "encoding", "segments", "preview"];
  const rows = analysis.overLimit.map((row) => [
    row.to,
    String(row.chars),
    row.encoding,
    String(row.segments),
    row.preview,
  ]);
  downloadCsvFile(filename, buildCsv(headers, rows));
}
