import { buildVoiceRecordingS3Key, putObjectBuffer } from "../s3/client.js";

export async function downloadRecordingToS3(params: {
  tenantId: string;
  botId: string;
  callId: string;
  sourceUrl: string;
}): Promise<{ s3Key: string; sizeBytes: number }> {
  const response = await fetch(params.sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download recording (${response.status})`);
  }

  const buffer = new Uint8Array(await response.arrayBuffer());
  const s3Key = buildVoiceRecordingS3Key(params.tenantId, params.botId, params.callId);
  await putObjectBuffer(s3Key, buffer, "audio/mpeg");
  return { s3Key, sizeBytes: buffer.byteLength };
}
