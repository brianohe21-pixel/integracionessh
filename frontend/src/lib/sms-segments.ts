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
