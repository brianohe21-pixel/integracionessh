import type { Bot } from "../../types/index.js";
import type { OutreachChannel } from "../../types/index.js";
import { checkAndIncrement } from "../rate-limiter/index.js";
import {
  OTP_DEFAULT_MAX_ATTEMPTS,
  OTP_TTL_SECONDS,
  generateOtpCode,
  generateOtpSalt,
  hashOtpCode,
  hashOtpDestination,
  normalizeOtpDestination,
  verifyOtpCodeHash,
} from "./crypto.js";
import {
  getOtpRecord,
  incrementOtpAttempts,
  markOtpVerified,
  putOtpRecord,
} from "./repository.js";
import { sendOtpViaChannel } from "./send-channel.js";

export type OtpVerifyReason =
  | "verified"
  | "invalid_code"
  | "expired"
  | "max_attempts"
  | "not_found"
  | "already_verified";

export interface SendOtpParams {
  tenantId: string;
  botId: string;
  channel: OutreachChannel;
  to: string;
  messageTemplate?: string;
  whatsappTemplate?: {
    name: string;
    language: string;
  };
  maxAttempts?: number;
  accessToken?: string;
  environment?: string;
}

export interface SendOtpResult {
  destination: string;
  channel: OutreachChannel;
  messageId: string;
  expiresAt: string;
  maxAttempts: number;
  receiptId?: string;
}

export interface VerifyOtpParams {
  tenantId: string;
  to: string;
  code: string;
}

export interface VerifyOtpResult {
  verified: boolean;
  reason: OtpVerifyReason;
  attemptsRemaining?: number;
}

const OTP_SEND_LIMIT_PER_MINUTE = 3;
const OTP_SEND_LIMIT_PER_DAY = 20;

async function assertOtpSendRateLimit(tenantId: string, destination: string): Promise<void> {
  const rateKey = `otp-send:${tenantId}:${destination}`;
  const result = await checkAndIncrement(
    rateKey,
    OTP_SEND_LIMIT_PER_MINUTE,
    OTP_SEND_LIMIT_PER_DAY
  );
  if (!result.allowed) {
    throw Object.assign(new Error("OTP send rate limit exceeded"), {
      statusCode: 429,
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
}

export async function sendOtp(params: SendOtpParams): Promise<SendOtpResult> {
  const destination = normalizeOtpDestination(params.to);
  if (destination.length < 7) {
    throw Object.assign(new Error("Invalid phone number"), { statusCode: 400 });
  }

  await assertOtpSendRateLimit(params.tenantId, destination);

  const code = generateOtpCode();
  const salt = generateOtpSalt();
  const destinationHash = hashOtpDestination(params.tenantId, destination);
  const maxAttempts = params.maxAttempts ?? OTP_DEFAULT_MAX_ATTEMPTS;
  const expiresAt = Math.floor(Date.now() / 1000) + OTP_TTL_SECONDS;

  const delivery = await sendOtpViaChannel({
    tenantId: params.tenantId,
    botId: params.botId,
    channel: params.channel,
    to: destination,
    code,
    ...(params.messageTemplate ? { messageTemplate: params.messageTemplate } : {}),
    ...(params.whatsappTemplate ? { whatsappTemplate: params.whatsappTemplate } : {}),
    ...(params.accessToken ? { accessToken: params.accessToken } : {}),
    ...(params.environment ? { environment: params.environment } : {}),
  });

  await putOtpRecord({
    tenantId: params.tenantId,
    destinationHash,
    destination,
    botId: params.botId,
    channel: params.channel,
    codeHash: hashOtpCode(code, salt),
    salt,
    attempts: 0,
    maxAttempts,
    expiresAt,
    status: "pending",
  });

  return {
    destination,
    channel: params.channel,
    messageId: delivery.messageId,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    maxAttempts,
    ...(delivery.receiptId ? { receiptId: delivery.receiptId } : {}),
  };
}

export async function verifyOtp(params: VerifyOtpParams): Promise<VerifyOtpResult> {
  const destination = normalizeOtpDestination(params.to);
  const destinationHash = hashOtpDestination(params.tenantId, destination);
  const record = await getOtpRecord(params.tenantId, destinationHash);

  if (!record) {
    return { verified: false, reason: "not_found" };
  }

  if (record.status === "verified") {
    return { verified: false, reason: "already_verified" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (record.expiresAt <= now) {
    return { verified: false, reason: "expired" };
  }

  if (record.attempts >= record.maxAttempts) {
    return { verified: false, reason: "max_attempts", attemptsRemaining: 0 };
  }

  const normalizedCode = params.code.replace(/\D/g, "");
  const matches = verifyOtpCodeHash(normalizedCode, record.salt, record.codeHash);
  if (matches) {
    await markOtpVerified(params.tenantId, destinationHash);
    return { verified: true, reason: "verified" };
  }

  const updated = await incrementOtpAttempts(params.tenantId, destinationHash);
  const attempts = updated?.attempts ?? record.attempts + 1;
  const attemptsRemaining = Math.max(0, record.maxAttempts - attempts);

  if (attempts >= record.maxAttempts) {
    return { verified: false, reason: "max_attempts", attemptsRemaining: 0 };
  }

  return {
    verified: false,
    reason: "invalid_code",
    attemptsRemaining,
  };
}

export function assertOtpChannelReady(bot: Bot, channel: OutreachChannel): void {
  if (channel === "sms") {
    if (!bot.smsEnabled) {
      throw Object.assign(new Error("SMS is not enabled for this bot"), { statusCode: 400 });
    }
    if (!bot.smsOriginationNumber?.trim()) {
      throw Object.assign(new Error("SMS sender label is not configured for this bot"), {
        statusCode: 400,
      });
    }
    return;
  }

  if (!bot.phoneNumberId?.trim()) {
    throw Object.assign(new Error("WhatsApp is not configured for this bot"), { statusCode: 400 });
  }
}
