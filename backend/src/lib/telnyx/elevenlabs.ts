import { getElevenLabsSecrets } from "./secrets.js";

export interface ElevenLabsVoice {
  id: string;
  name: string;
}

export async function listElevenLabsVoices(environment: string): Promise<ElevenLabsVoice[]> {
  const { apiKey } = await getElevenLabsSecrets(environment);
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw Object.assign(new Error("Failed to fetch ElevenLabs voices"), {
      statusCode: response.status === 401 ? 503 : 502,
    });
  }

  const data = (await response.json()) as {
    voices?: Array<{ voice_id?: string; name?: string }>;
  };

  return (data.voices ?? [])
    .filter((voice) => voice.voice_id && voice.name)
    .map((voice) => ({
      id: voice.voice_id!,
      name: voice.name!,
    }));
}
