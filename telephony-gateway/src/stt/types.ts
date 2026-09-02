export type SttProviderId = "openai" | "deepgram";

export interface SttModelDefinition {
  id: string;
  provider: SttProviderId;
  providerLabel: string;
  model: string;
  label: string;
  description: string;
}

export interface SttSessionCallbacks {
  onFinalTranscript: (text: string, externalId: string) => void;
  onError?: (message: string) => void;
}

export interface SttLiveSession {
  sendAudio(base64Mulaw: string): void;
  close(): void;
  getAudioSeconds(): number;
}

export interface SttAdapterConnectParams {
  locale: "es" | "en";
  silenceMs: number;
  model: string;
  apiKey: string;
  callbacks: SttSessionCallbacks;
}

export interface SttAdapter {
  provider: SttProviderId;
  connect(params: SttAdapterConnectParams): Promise<SttLiveSession>;
}

export interface ResolvedSttModel {
  id: string;
  provider: SttProviderId;
  model: string;
  usesOpenAiNativeTranscription: boolean;
}
