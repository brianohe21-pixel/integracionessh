import { assertDemoSeedEnvironment } from "./environment.js";

describe("assertDemoSeedEnvironment", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("allows dev table and environment", () => {
    process.env.ENVIRONMENT = "dev";
    process.env.TABLE_NAME = "chatbot-platform-dev";
    expect(() => assertDemoSeedEnvironment()).not.toThrow();
  });

  it("rejects non-dev environment", () => {
    process.env.ENVIRONMENT = "prod";
    process.env.TABLE_NAME = "chatbot-platform-dev";
    expect(() => assertDemoSeedEnvironment()).toThrow(/ENVIRONMENT=dev/);
  });

  it("rejects non-dev table", () => {
    process.env.ENVIRONMENT = "dev";
    process.env.TABLE_NAME = "chatbot-platform-prod";
    expect(() => assertDemoSeedEnvironment()).toThrow(/chatbot-platform-dev/);
  });
});
