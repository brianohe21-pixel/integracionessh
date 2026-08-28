import { listBots, updateBot } from "../dynamodb/bot.repository.js";
import {
  deleteTelephonyNumberLookup,
  getBotByTelephonyNumber,
} from "../dynamodb/bot-lookup.repository.js";
import {
  releaseTelephonyNumberFromBot,
  reassignTelephonyNumber,
} from "./number-assignment.js";

jest.mock("../dynamodb/bot.repository.js", () => ({
  listBots: jest.fn(),
  updateBot: jest.fn(),
}));

jest.mock("../dynamodb/bot-lookup.repository.js", () => ({
  getBotByTelephonyNumber: jest.fn(),
  deleteTelephonyNumberLookup: jest.fn(),
}));

describe("telephony number assignment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("releases telephony from a bot", async () => {
    await releaseTelephonyNumberFromBot("tenant-1", "bot-a", "+14478429620");

    expect(deleteTelephonyNumberLookup).toHaveBeenCalledWith("+14478429620");
    expect(updateBot).toHaveBeenCalledWith("tenant-1", "bot-a", {
      telephonyPhoneNumber: undefined,
      telephonyEnabled: false,
    });
  });

  it("reassigns a number from lookup and bot records", async () => {
    (getBotByTelephonyNumber as jest.Mock).mockResolvedValue({
      tenantId: "tenant-1",
      botId: "bot-a",
    });
    (listBots as jest.Mock).mockResolvedValue([
      { botId: "bot-a", telephonyPhoneNumber: "+14478429620" },
      { botId: "bot-b", telephonyPhoneNumber: "+14478429620" },
    ]);

    await reassignTelephonyNumber({
      tenantId: "tenant-1",
      targetBotId: "bot-c",
      phoneNumber: "+14478429620",
    });

    expect(deleteTelephonyNumberLookup).toHaveBeenCalledWith("+14478429620");
    expect(updateBot).toHaveBeenCalledWith("tenant-1", "bot-a", {
      telephonyPhoneNumber: undefined,
      telephonyEnabled: false,
    });
    expect(updateBot).toHaveBeenCalledWith("tenant-1", "bot-b", {
      telephonyPhoneNumber: undefined,
      telephonyEnabled: false,
    });
  });
});
