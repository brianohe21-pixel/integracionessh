import { getBot, listBots, updateBot } from "../dynamodb/bot.repository.js";
import {
  deleteTelephonyNumberLookup,
  getBotByTelephonyNumber,
} from "../dynamodb/bot-lookup.repository.js";
import {
  clearStaleTelephonyNumberLookup,
  releaseTelephonyNumberFromBot,
  reassignTelephonyNumber,
} from "./number-assignment.js";

jest.mock("../dynamodb/bot.repository.js", () => ({
  getBot: jest.fn(),
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
    (getBot as jest.Mock).mockResolvedValue({ botId: "bot-a" });

    await releaseTelephonyNumberFromBot("tenant-1", "bot-a", "+14478429620");

    expect(deleteTelephonyNumberLookup).toHaveBeenCalledWith("+14478429620");
    expect(updateBot).toHaveBeenCalledWith("tenant-1", "bot-a", {
      telephonyPhoneNumber: undefined,
      telephonyEnabled: false,
    });
  });

  it("skips bot update when releasing from a deleted bot", async () => {
    (getBot as jest.Mock).mockResolvedValue(null);

    await releaseTelephonyNumberFromBot("tenant-1", "bot-a", "+14478429620");

    expect(deleteTelephonyNumberLookup).toHaveBeenCalledWith("+14478429620");
    expect(updateBot).not.toHaveBeenCalled();
  });

  it("clears stale telephony lookup when bot no longer exists", async () => {
    (getBotByTelephonyNumber as jest.Mock).mockResolvedValue({
      tenantId: "tenant-1",
      botId: "deleted-bot",
    });
    (listBots as jest.Mock).mockResolvedValue([{ botId: "current-bot" }]);

    const cleared = await clearStaleTelephonyNumberLookup("tenant-1", "+14478429620");

    expect(cleared).toBe(true);
    expect(deleteTelephonyNumberLookup).toHaveBeenCalledWith("+14478429620");
  });

  it("reassigns a number from lookup and bot records", async () => {
    (getBotByTelephonyNumber as jest.Mock)
      .mockResolvedValueOnce({
        tenantId: "tenant-1",
        botId: "bot-a",
      })
      .mockResolvedValueOnce(null);
    (listBots as jest.Mock).mockResolvedValue([
      { botId: "bot-a", telephonyPhoneNumber: "+14478429620" },
      { botId: "bot-b", telephonyPhoneNumber: "+14478429620" },
    ]);
    (getBot as jest.Mock).mockResolvedValue({ botId: "bot-a" });

    await reassignTelephonyNumber({
      tenantId: "tenant-1",
      targetBotId: "bot-c",
      phoneNumber: "+14478429620",
    });

    expect(deleteTelephonyNumberLookup).toHaveBeenCalledWith("+14478429620");
    expect(updateBot).toHaveBeenCalled();
  });
});
