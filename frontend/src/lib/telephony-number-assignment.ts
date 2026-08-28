import type { TelnyxNumber } from "@/hooks/useTelephony";

export function getTelephonyNumberAssignment(
  numbers: TelnyxNumber[],
  phoneNumber: string,
  botId: string
): { botId: string; botName?: string } | null {
  const entry = numbers.find((item) => item.phoneNumber === phoneNumber);
  if (!entry?.assignedBotId || entry.assignedBotId === botId) return null;
  return { botId: entry.assignedBotId, botName: entry.assignedBotName };
}
