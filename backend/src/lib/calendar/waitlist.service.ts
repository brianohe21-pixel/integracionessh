import {
  createWaitlistEntry,
  getWaitlistEntry,
  listWaitlistForBot,
  makeWaitlistId,
  updateWaitlistEntry,
} from "../dynamodb/waitlist.repository.js";
import type {
  Booking,
  WaitlistEntry,
  WaitlistScope,
  WaitlistStatus,
} from "../../types/index.js";
import { createBookingForBot, getConfigOrDefault, requireEnabledCalendar } from "./calendar.service.js";
import { formatDateLabel } from "./slot-engine.js";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function findDuplicate(
  entries: WaitlistEntry[],
  params: {
    contactPhone: string;
    scope: WaitlistScope;
    startAt?: string;
    isoDate?: string;
  }
): WaitlistEntry | undefined {
  const phone = normalizePhone(params.contactPhone);
  return entries.find((entry) => {
    if (entry.status !== "active") return false;
    if (entry.scope !== params.scope) return false;
    if (normalizePhone(entry.contactPhone) !== phone) return false;
    if (params.scope === "slot") return entry.startAt === params.startAt;
    return entry.isoDate === params.isoDate;
  });
}

export async function joinWaitlist(params: {
  tenantId: string;
  botId: string;
  scope: WaitlistScope;
  startAt?: string;
  isoDate?: string;
  contactPhone: string;
  contactName: string;
  notes?: string;
}): Promise<WaitlistEntry> {
  const config = await requireEnabledCalendar(params.tenantId, params.botId);
  if (!config.waitlistEnabled) {
    throw new Error("Waitlist is not enabled for this calendar");
  }

  if (params.scope === "slot") {
    if (!params.startAt) throw new Error("startAt is required for slot waitlist");
  } else {
    if (!params.isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(params.isoDate)) {
      throw new Error("isoDate is required for date waitlist");
    }
  }

  const activeEntries = await listWaitlistForBot({
    tenantId: params.tenantId,
    botId: params.botId,
    status: "active",
  });

  const duplicate = findDuplicate(activeEntries, params);
  if (duplicate) return duplicate;

  const now = new Date().toISOString();
  const base = {
    waitlistId: makeWaitlistId(),
    tenantId: params.tenantId,
    botId: params.botId,
    contactPhone: params.contactPhone.trim(),
    contactName: params.contactName.trim(),
    status: "active" as const,
    source: "public_link" as const,
    createdAt: now,
    updatedAt: now,
    ...(params.notes?.trim() ? { notes: params.notes.trim() } : {}),
  };

  if (params.scope === "slot") {
    const startAt = params.startAt;
    if (!startAt) throw new Error("startAt is required for slot waitlist");
    return createWaitlistEntry({ ...base, scope: "slot", startAt });
  }

  const isoDate = params.isoDate;
  if (!isoDate) throw new Error("isoDate is required for date waitlist");
  return createWaitlistEntry({ ...base, scope: "date", isoDate });
}

export async function listWaitlist(params: {
  tenantId: string;
  botId: string;
  status?: WaitlistStatus;
  scope?: WaitlistScope;
  from?: string;
  to?: string;
}): Promise<WaitlistEntry[]> {
  await getConfigOrDefault(params.tenantId, params.botId);
  return listWaitlistForBot(params);
}

export async function updateWaitlistStatus(params: {
  tenantId: string;
  botId: string;
  waitlistId: string;
  status: WaitlistStatus;
}): Promise<WaitlistEntry> {
  const existing = await getWaitlistEntry(params.tenantId, params.waitlistId);
  if (!existing || existing.botId !== params.botId) {
    throw new Error("Waitlist entry not found");
  }

  const updated = await updateWaitlistEntry(params.tenantId, params.waitlistId, {
    status: params.status,
  });
  if (!updated) throw new Error("Waitlist entry not found");
  return updated;
}

export async function convertWaitlistToBooking(params: {
  tenantId: string;
  botId: string;
  waitlistId: string;
  startAt?: string;
  environment?: string;
}): Promise<{ booking: Awaited<ReturnType<typeof createBookingForBot>>["booking"]; waitlist: WaitlistEntry }> {
  const entry = await getWaitlistEntry(params.tenantId, params.waitlistId);
  if (!entry || entry.botId !== params.botId) {
    throw new Error("Waitlist entry not found");
  }
  if (entry.status !== "active" && entry.status !== "contacted") {
    throw new Error("Waitlist entry cannot be converted");
  }

  const bookingStartAt =
    entry.scope === "slot" ? entry.startAt : params.startAt;
  if (!bookingStartAt) {
    throw new Error("startAt is required to convert a date waitlist entry");
  }

  const result = await createBookingForBot({
    tenantId: params.tenantId,
    botId: params.botId,
    startAt: bookingStartAt,
    contactPhone: entry.contactPhone,
    contactName: entry.contactName,
    ...(entry.notes ? { notes: entry.notes } : {}),
    source: "manual",
    ...(params.environment ? { environment: params.environment } : {}),
  });

  const waitlist = await updateWaitlistEntry(params.tenantId, params.waitlistId, {
    status: "fulfilled",
  });
  if (!waitlist) throw new Error("Failed to update waitlist entry");

  return { booking: result.booking, waitlist };
}

export function listMatchingWaitlistForCancelledBooking(
  entries: WaitlistEntry[],
  booking: Booking
): WaitlistEntry[] {
  const isoDate = booking.startAt.slice(0, 10);
  return entries.filter((entry) => {
    if (entry.status !== "active") return false;
    if (entry.scope === "slot") return entry.startAt === booking.startAt;
    return entry.isoDate === isoDate;
  });
}

export function formatWaitlistLabel(entry: WaitlistEntry, timezone: string): string {
  if (entry.scope === "slot" && entry.startAt) {
    const isoDate = entry.startAt.slice(0, 10);
    return `${formatDateLabel(isoDate, timezone)} ${entry.startAt}`;
  }
  if (entry.isoDate) {
    return formatDateLabel(entry.isoDate, timezone);
  }
  return "";
}
