import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("../rate-limiter/index.js", () => ({
  checkAndIncrement: jest.fn(async () => ({
    allowed: true,
    minuteRemaining: 2,
    dayRemaining: 10,
  })),
}));

jest.mock("./send-channel.js", () => ({
  sendOtpViaChannel: jest.fn(async () => ({
    messageId: "msg-1",
    channel: "sms",
    receiptId: "trace-1",
  })),
}));

jest.mock("./repository.js", () => ({
  putOtpRecord: jest.fn(async (record: unknown) => record),
  getOtpRecord: jest.fn(),
  incrementOtpAttempts: jest.fn(),
  markOtpVerified: jest.fn(),
}));

import { checkAndIncrement } from "../rate-limiter/index.js";
import {
  getOtpRecord,
  incrementOtpAttempts,
  markOtpVerified,
  putOtpRecord,
} from "./repository.js";
import { sendOtpViaChannel } from "./send-channel.js";
import { hashOtpCode, hashOtpDestination, generateOtpSalt } from "./crypto.js";
import { sendOtp, verifyOtp } from "./service.js";

const mockedGetOtpRecord = jest.mocked(getOtpRecord);
const mockedPutOtpRecord = jest.mocked(putOtpRecord);
const mockedIncrementOtpAttempts = jest.mocked(incrementOtpAttempts);
const mockedMarkOtpVerified = jest.mocked(markOtpVerified);
const mockedSendOtpViaChannel = jest.mocked(sendOtpViaChannel);
const mockedCheckAndIncrement = jest.mocked(checkAndIncrement);

describe("otp service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends OTP and stores hashed record", async () => {
    const result = await sendOtp({
      tenantId: "tenant-1",
      botId: "bot-1",
      channel: "sms",
      to: "573001234567",
      messageTemplate: "Code {{code}}",
    });

    expect(mockedCheckAndIncrement).toHaveBeenCalled();
    expect(mockedSendOtpViaChannel).toHaveBeenCalled();
    expect(mockedPutOtpRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        botId: "bot-1",
        channel: "sms",
        destination: "573001234567",
        status: "pending",
      })
    );
    expect(result.destination).toBe("573001234567");
    expect(result.messageId).toBe("msg-1");
  });

  it("verifies valid OTP and consumes record", async () => {
    const salt = generateOtpSalt();
    const destination = "573001234567";
    const destinationHash = hashOtpDestination("tenant-1", destination);
    mockedGetOtpRecord.mockResolvedValue({
      tenantId: "tenant-1",
      destinationHash,
      destination,
      botId: "bot-1",
      channel: "sms",
      codeHash: hashOtpCode("123456", salt),
      salt,
      attempts: 0,
      maxAttempts: 3,
      expiresAt: Math.floor(Date.now() / 1000) + 300,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockedMarkOtpVerified.mockResolvedValue(null);

    const result = await verifyOtp({
      tenantId: "tenant-1",
      to: destination,
      code: "123456",
    });

    expect(result).toEqual({ verified: true, reason: "verified" });
    expect(mockedMarkOtpVerified).toHaveBeenCalledWith("tenant-1", destinationHash);
  });

  it("returns expired for expired OTP", async () => {
    const destination = "573001234567";
    mockedGetOtpRecord.mockResolvedValue({
      tenantId: "tenant-1",
      destinationHash: hashOtpDestination("tenant-1", destination),
      destination,
      botId: "bot-1",
      channel: "sms",
      codeHash: "hash",
      salt: "salt",
      attempts: 0,
      maxAttempts: 3,
      expiresAt: Math.floor(Date.now() / 1000) - 10,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await verifyOtp({
      tenantId: "tenant-1",
      to: destination,
      code: "123456",
    });

    expect(result).toEqual({ verified: false, reason: "expired" });
  });

  it("increments attempts on invalid code", async () => {
    const salt = generateOtpSalt();
    const destination = "573001234567";
    const destinationHash = hashOtpDestination("tenant-1", destination);
    mockedGetOtpRecord.mockResolvedValue({
      tenantId: "tenant-1",
      destinationHash,
      destination,
      botId: "bot-1",
      channel: "sms",
      codeHash: hashOtpCode("123456", salt),
      salt,
      attempts: 0,
      maxAttempts: 3,
      expiresAt: Math.floor(Date.now() / 1000) + 300,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockedIncrementOtpAttempts.mockResolvedValue({
      tenantId: "tenant-1",
      destinationHash,
      destination,
      botId: "bot-1",
      channel: "sms",
      codeHash: hashOtpCode("123456", salt),
      salt,
      attempts: 1,
      maxAttempts: 3,
      expiresAt: Math.floor(Date.now() / 1000) + 300,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await verifyOtp({
      tenantId: "tenant-1",
      to: destination,
      code: "000000",
    });

    expect(result).toEqual({
      verified: false,
      reason: "invalid_code",
      attemptsRemaining: 2,
    });
    expect(mockedIncrementOtpAttempts).toHaveBeenCalledWith("tenant-1", destinationHash);
  });
});
