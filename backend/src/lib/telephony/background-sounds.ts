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

export function isValidBackgroundSoundId(id: string): boolean {
  return id === BACKGROUND_SOUND_NONE || BACKGROUND_SOUND_IDS.has(id);
}
