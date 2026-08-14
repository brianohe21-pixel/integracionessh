const ULAW_BIAS = 0x84;
const ULAW_CLIP = 32635;

export function ulawDecode(sample: number): number {
  let uval = (~sample & 0xff) & 0xff;
  const sign = uval & 0x80;
  const exponent = (uval >> 4) & 0x07;
  const mantissa = uval & 0x0f;
  let magnitude = ((mantissa << 3) + ULAW_BIAS) << exponent;
  magnitude -= ULAW_BIAS;
  return sign ? -magnitude : magnitude;
}

export function ulawEncode(sample: number): number {
  const sign = sample < 0 ? 0x80 : 0;
  let magnitude = sample < 0 ? -sample : sample;
  if (magnitude > ULAW_CLIP) magnitude = ULAW_CLIP;
  magnitude += ULAW_BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (magnitude & mask) === 0 && exponent > 0; exponent -= 1) {
    mask >>= 1;
  }
  const mantissa = (magnitude >> (exponent + 3)) & 0x0f;
  return (~(sign | (exponent << 4) | mantissa)) & 0xff;
}

export function mixUlawBytes(primary: number, background: number, backgroundGain: number): number {
  const mixed = ulawDecode(primary) + ulawDecode(background) * backgroundGain;
  const clipped = Math.max(-ULAW_CLIP, Math.min(ULAW_CLIP, mixed));
  return ulawEncode(clipped);
}

export function mixUlawBuffers(
  primary: Buffer,
  background: Uint8Array,
  backgroundStart: number,
  backgroundGain: number
): { buffer: Buffer; backgroundPosition: number } {
  const output = Buffer.alloc(primary.length);
  let position = backgroundStart;
  for (let index = 0; index < primary.length; index += 1) {
    const backgroundByte = background[position % background.length];
    output[index] = mixUlawBytes(primary[index], backgroundByte, backgroundGain);
    position += 1;
  }
  return { buffer: output, backgroundPosition: position };
}
