import { randomBytes } from "crypto";
import {
  deleteCalendarPublicKeyLookup,
  getBotByCalendarPublicKey,
  putCalendarPublicKeyLookup,
} from "../dynamodb/bot-lookup.repository.js";
import { getCalendarConfig, upsertCalendarConfig } from "../dynamodb/calendar-config.repository.js";
import { getBot } from "../dynamodb/bot.repository.js";
import { requireEnabledCalendar } from "./calendar.service.js";
import type { CalendarConfig } from "../../types/index.js";

export function generateCalendarPublicKey(): string {
  return `clk_${randomBytes(24).toString("base64url")}`;
}

export function buildPublicCalendarUrl(publicKey: string): string {
  const base = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/book/${publicKey}`;
}

export async function resolvePublicCalendarContext(publicKey: string): Promise<{
  tenantId: string;
  botId: string;
  config: CalendarConfig;
  botName: string;
}> {
  const lookup = await getBotByCalendarPublicKey(publicKey);
  if (!lookup) {
    const err = new Error("Invalid calendar link") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  const config = await getCalendarConfig(lookup.tenantId, lookup.botId);
  if (!config?.enabled || !config.publicLinkEnabled || !config.calendarPublicKey) {
    const err = new Error("Public calendar link is not available") as Error & {
      statusCode?: number;
    };
    err.statusCode = 404;
    throw err;
  }

  if (config.calendarPublicKey !== publicKey) {
    const err = new Error("Invalid calendar link") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  await requireEnabledCalendar(lookup.tenantId, lookup.botId);

  const bot = await getBot(lookup.tenantId, lookup.botId);
  if (!bot) {
    const err = new Error("Bot not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  return {
    tenantId: lookup.tenantId,
    botId: lookup.botId,
    config,
    botName: bot.name,
  };
}

export async function getPublicLinkStatus(
  tenantId: string,
  botId: string
): Promise<{
  publicLinkEnabled: boolean;
  calendarPublicKey?: string;
  publicUrl?: string;
}> {
  const config = await getCalendarConfig(tenantId, botId);
  const publicKey = config?.calendarPublicKey;
  return {
    publicLinkEnabled: config?.publicLinkEnabled ?? false,
    ...(publicKey ? { calendarPublicKey: publicKey } : {}),
    ...(publicKey && config?.publicLinkEnabled
      ? { publicUrl: buildPublicCalendarUrl(publicKey) }
      : {}),
  };
}

export async function enablePublicCalendarLink(
  tenantId: string,
  botId: string
): Promise<{
  publicLinkEnabled: boolean;
  calendarPublicKey: string;
  publicUrl: string;
}> {
  await requireEnabledCalendar(tenantId, botId);
  const existing = await getCalendarConfig(tenantId, botId);
  if (!existing) {
    throw new Error("Calendar config not found");
  }

  let publicKey = existing.calendarPublicKey;
  if (!publicKey) {
    publicKey = generateCalendarPublicKey();
    await putCalendarPublicKeyLookup(publicKey, tenantId, botId);
  } else {
    await putCalendarPublicKeyLookup(publicKey, tenantId, botId);
  }

  const updated = await upsertCalendarConfig({
    ...existing,
    calendarPublicKey: publicKey,
    publicLinkEnabled: true,
  });

  return {
    publicLinkEnabled: true,
    calendarPublicKey: updated.calendarPublicKey!,
    publicUrl: buildPublicCalendarUrl(updated.calendarPublicKey!),
  };
}

export async function disablePublicCalendarLink(
  tenantId: string,
  botId: string
): Promise<{ publicLinkEnabled: boolean; calendarPublicKey?: string }> {
  const existing = await getCalendarConfig(tenantId, botId);
  if (!existing) {
    throw new Error("Calendar config not found");
  }

  const updated = await upsertCalendarConfig({
    ...existing,
    publicLinkEnabled: false,
  });

  return {
    publicLinkEnabled: false,
    ...(updated.calendarPublicKey ? { calendarPublicKey: updated.calendarPublicKey } : {}),
  };
}

export async function rotatePublicCalendarLink(
  tenantId: string,
  botId: string
): Promise<{
  publicLinkEnabled: boolean;
  calendarPublicKey: string;
  publicUrl: string;
}> {
  await requireEnabledCalendar(tenantId, botId);
  const existing = await getCalendarConfig(tenantId, botId);
  if (!existing) {
    throw new Error("Calendar config not found");
  }

  if (existing.calendarPublicKey) {
    await deleteCalendarPublicKeyLookup(existing.calendarPublicKey);
  }

  const publicKey = generateCalendarPublicKey();
  await putCalendarPublicKeyLookup(publicKey, tenantId, botId);

  const updated = await upsertCalendarConfig({
    ...existing,
    calendarPublicKey: publicKey,
    publicLinkEnabled: existing.publicLinkEnabled ?? true,
  });

  return {
    publicLinkEnabled: updated.publicLinkEnabled ?? true,
    calendarPublicKey: publicKey,
    publicUrl: buildPublicCalendarUrl(publicKey),
  };
}
