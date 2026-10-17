export type FlowConditionOperator =
  | "contains"
  | "equals"
  | "not_equals"
  | "matches"
  | "not_matches";

export function evaluateConditionMatch(
  source: string,
  operator: FlowConditionOperator | string | undefined,
  expected: string
): boolean {
  const op = operator ?? "contains";
  if (op === "contains") {
    return source.toLowerCase().includes(expected.toLowerCase());
  }
  if (op === "equals") {
    return source.toLowerCase() === expected.toLowerCase();
  }
  if (op === "not_equals") {
    return source.toLowerCase() !== expected.toLowerCase();
  }
  if (op === "matches" || op === "not_matches") {
    const matched = testRegex(source.trim(), expected);
    return op === "matches" ? matched : !matched;
  }
  return false;
}

function testRegex(source: string, pattern: string): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) return false;
  try {
    return new RegExp(trimmed).test(source);
  } catch {
    return false;
  }
}
