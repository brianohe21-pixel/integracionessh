export const COEXISTENCE_MAX_MESSAGES_PER_SECOND = 20;

export function getCoexistenceSendDelayMs(): number {
  return Math.ceil(1000 / COEXISTENCE_MAX_MESSAGES_PER_SECOND);
}

export async function applyCoexistenceSendThrottle(
  onboardingMode?: "cloud_api" | "coexistence"
): Promise<void> {
  if (onboardingMode !== "coexistence") return;
  const delayMs = getCoexistenceSendDelayMs();
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
