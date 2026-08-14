export const BACKGROUND_SOUND_NONE = "none";

export const BACKGROUND_SOUND_IDS = new Set([
  "office1",
  "office2",
  "restaurant",
  "city",
  "typing",
  "elevator1",
  "elevator2",
  "elevator3",
  "elevator4",
]);

const BACKGROUND_SOUND_PROMPTS: Record<string, string> = {
  office1: "Subtle quiet office ambiance with soft distant activity",
  office2: "Modern office environment with gentle background chatter",
  restaurant: "Restaurant background ambiance with soft dining room atmosphere",
  city: "Urban city street ambiance with distant traffic",
  typing: "Keyboard typing sounds in a quiet office",
  elevator1: "Soft elevator background music, calm and unobtrusive",
  elevator2: "Light upbeat elevator background music",
  elevator3: "Calm ambient background music for phone calls",
  elevator4: "Gentle melodic background music loop",
};

const loopCache = new Map<string, Uint8Array>();

export const DEFAULT_BACKGROUND_SOUND_VOLUME = 0.6;

export function isValidBackgroundSoundId(id: string): boolean {
  return id === BACKGROUND_SOUND_NONE || BACKGROUND_SOUND_IDS.has(id);
}

export function resolveBackgroundSoundId(id?: string): string | null {
  const trimmed = id?.trim();
  if (!trimmed || trimmed === BACKGROUND_SOUND_NONE) return null;
  if (BACKGROUND_SOUND_IDS.has(trimmed)) return trimmed;
  return null;
}

export function resolveBackgroundSoundVolume(volume?: number): number {
  if (typeof volume !== "number" || Number.isNaN(volume)) return DEFAULT_BACKGROUND_SOUND_VOLUME;
  return Math.min(1, Math.max(0.01, volume));
}

export async function fetchBackgroundSoundLoop(
  presetId: string,
  apiKey: string
): Promise<Uint8Array | null> {
  const cached = loopCache.get(presetId);
  if (cached) return cached;

  const prompt = BACKGROUND_SOUND_PROMPTS[presetId];
  if (!prompt) return null;

  const url = new URL("https://api.elevenlabs.io/v1/sound-generation");
  url.searchParams.set("output_format", "ulaw_8000");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/basic",
    },
    body: JSON.stringify({
      text: prompt,
      loop: true,
      duration_seconds: 30,
      model_id: "eleven_text_to_sound_v2",
    }),
  });

  if (!response.ok) {
    console.error(
      `Failed to fetch background sound ${presetId}: ${response.status} ${response.statusText}`
    );
    return null;
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) return null;
  loopCache.set(presetId, bytes);
  return bytes;
}
