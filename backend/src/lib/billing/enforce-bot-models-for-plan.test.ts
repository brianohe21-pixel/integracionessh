import { enforceBotModelsForPlan } from "./enforce-bot-models-for-plan.js";
import { listBots, updateBot } from "../dynamodb/bot.repository.js";

jest.mock("../dynamodb/bot.repository.js", () => ({
  listBots: jest.fn(),
  updateBot: jest.fn(),
}));

describe("enforceBotModelsForPlan", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resets disallowed chat models when downgrading to starter", async () => {
    (listBots as jest.Mock).mockResolvedValue([
      {
        botId: "bot-1",
        model: "gpt-4.1",
        telephonyModel: "gpt-5",
        voicebotModel: "gpt-realtime-2.1-mini",
      },
      {
        botId: "bot-2",
        model: "gpt-4.1-mini",
        telephonyModel: "gpt-realtime-2.1-mini",
      },
    ]);

    await enforceBotModelsForPlan("tenant-1", "starter");

    expect(updateBot).toHaveBeenCalledTimes(1);
    expect(updateBot).toHaveBeenCalledWith("tenant-1", "bot-1", {
      model: "gpt-4.1-mini",
      telephonyModel: "gpt-4.1-mini",
    });
  });

  it("keeps pro models when plan is pro", async () => {
    (listBots as jest.Mock).mockResolvedValue([
      {
        botId: "bot-1",
        model: "gpt-4.1",
        telephonyModel: "gpt-5",
      },
    ]);

    await enforceBotModelsForPlan("tenant-1", "pro");

    expect(updateBot).not.toHaveBeenCalled();
  });
});
