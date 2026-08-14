export function isTelnyxMachineResult(result: string): boolean {
  const normalized = result.trim().toLowerCase();
  return normalized === "machine" || normalized === "fax_detected" || normalized === "silence";
}

export function isTelnyxHumanResult(result: string): boolean {
  const normalized = result.trim().toLowerCase();
  return (
    normalized === "human" ||
    normalized === "human_residence" ||
    normalized === "human_business"
  );
}

export function isTelnyxUncertainResult(result: string): boolean {
  return result.trim().toLowerCase() === "not_sure";
}

export function shouldConnectOutboundAfterAmd(result: string): boolean {
  return isTelnyxHumanResult(result) || isTelnyxUncertainResult(result);
}

export function isTelnyxSilenceResult(result: string): boolean {
  return result.trim().toLowerCase() === "silence";
}

export function shouldHangupOutboundAfterAmd(
  result: string,
  alreadyConnected: boolean
): boolean {
  const normalized = result.trim().toLowerCase();
  if (normalized === "beep_detected" || normalized === "machine" || normalized === "fax_detected") {
    return true;
  }
  if (normalized === "silence") {
    return !alreadyConnected;
  }
  return false;
}
