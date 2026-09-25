import type { PublicServiceStatusResponse } from "@/types";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export async function fetchPublicServiceStatus(): Promise<PublicServiceStatusResponse> {
  if (!BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }

  const response = await fetch(`${BASE_URL}/v1/status`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<PublicServiceStatusResponse>;
}

export function buildApiOutageStatus(): PublicServiceStatusResponse {
  const now = new Date().toISOString();
  const unknownDays = Array.from({ length: 90 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (89 - index));
    return {
      date: date.toISOString().slice(0, 10),
      status: "unknown" as const,
    };
  });

  return {
    updatedAt: now,
    overall: "outage",
    stale: true,
    components: [
      {
        id: "api",
        status: "outage",
        checkedAt: now,
        days: unknownDays.map((day, index) =>
          index === unknownDays.length - 1 ? { ...day, status: "outage" } : day
        ),
      },
      {
        id: "data",
        status: "unknown",
        checkedAt: now,
        days: unknownDays,
      },
    ],
  };
}
