const STORAGE_PREFIX = "unread-messages";

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}:${scope}`;
}

export function loadUnreadCounts(scope: string): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && value > 0) {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function saveUnreadCounts(scope: string, counts: Record<string, number>): void {
  if (typeof window === "undefined") return;
  const filtered = Object.fromEntries(
    Object.entries(counts).filter(([, value]) => value > 0)
  );
  if (Object.keys(filtered).length === 0) {
    window.localStorage.removeItem(storageKey(scope));
    return;
  }
  window.localStorage.setItem(storageKey(scope), JSON.stringify(filtered));
}
