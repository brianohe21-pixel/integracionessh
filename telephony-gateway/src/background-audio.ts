import { mixUlawBuffers } from "./ulaw-mixer.js";

const CHUNK_SIZE = 160;
const PUMP_INTERVAL_MS = 20;

export class BackgroundSoundEngine {
  private readonly loop: Uint8Array;
  private readonly volume: number;
  private position = 0;
  private interval: NodeJS.Timeout | null = null;
  private ttsActive = false;

  constructor(loop: Uint8Array, volume: number) {
    this.loop = loop;
    this.volume = volume;
  }

  private nextChunk(size: number): Uint8Array {
    const chunk = new Uint8Array(size);
    for (let index = 0; index < size; index += 1) {
      chunk[index] = this.loop[this.position % this.loop.length];
      this.position += 1;
    }
    return chunk;
  }

  mixTtsPayload(base64Payload: string): string {
    const input = Buffer.from(base64Payload, "base64");
    const mixed = mixUlawBuffers(input, this.loop, this.position, this.volume);
    this.position = mixed.backgroundPosition;
    return mixed.buffer.toString("base64");
  }

  pureBackgroundPayload(): string {
    return Buffer.from(this.nextChunk(CHUNK_SIZE)).toString("base64");
  }

  startIdlePump(send: (payload: string) => void): void {
    this.interval = setInterval(() => {
      if (this.ttsActive) return;
      send(this.pureBackgroundPayload());
    }, PUMP_INTERVAL_MS);
  }

  setTtsActive(active: boolean): void {
    this.ttsActive = active;
  }

  stop(): void {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }
}
