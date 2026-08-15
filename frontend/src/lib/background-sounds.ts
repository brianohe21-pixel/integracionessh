export interface BackgroundSoundDefinition {
  id: string;
  label: string;
  description: string;
}

export const BACKGROUND_SOUND_NONE = "none";

export const BACKGROUND_SOUNDS: BackgroundSoundDefinition[] = [
  {
    id: "office1",
    label: "Office (quiet)",
    description: "Subtle office ambiance with light background activity",
  },
  {
    id: "office2",
    label: "Office (active)",
    description: "Modern office environment with distant chatter",
  },
  {
    id: "restaurant",
    label: "Restaurant",
    description: "Restaurant background ambiance",
  },
  {
    id: "city",
    label: "City",
    description: "Urban street ambiance",
  },
  {
    id: "typing",
    label: "Typing",
    description: "Keyboard typing atmosphere",
  },
  {
    id: "elevator1",
    label: "Elevator music 1",
    description: "Soft ambient background music",
  },
  {
    id: "elevator2",
    label: "Elevator music 2",
    description: "Light upbeat background music",
  },
  {
    id: "elevator3",
    label: "Elevator music 3",
    description: "Calm background music for longer waits",
  },
  {
    id: "elevator4",
    label: "Elevator music 4",
    description: "Gentle melodic background music",
  },
];

export const DEFAULT_BACKGROUND_SOUND_VOLUME = 0.6;

export function getBackgroundSoundLabel(id: string): string {
  if (!id || id === BACKGROUND_SOUND_NONE) return "";
  return BACKGROUND_SOUNDS.find((item) => item.id === id)?.label ?? id;
}

export function getBackgroundSound(id: string): BackgroundSoundDefinition | undefined {
  if (!id || id === BACKGROUND_SOUND_NONE) return undefined;
  return BACKGROUND_SOUNDS.find((item) => item.id === id);
}
