import { getDemoCredentials, isDemoLoginEnabled } from "@/lib/demo-access";

describe("demo-access", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("enables demo login only in develop with credentials", () => {
    process.env.NEXT_PUBLIC_ENV = "dev";
    process.env.NEXT_PUBLIC_DEMO_EMAIL = "demo@integracionessh.dev";
    process.env.NEXT_PUBLIC_DEMO_PASSWORD = "DemoAccess2026!";

    expect(isDemoLoginEnabled()).toBe(true);
    expect(getDemoCredentials()).toEqual({
      email: "demo@integracionessh.dev",
      password: "DemoAccess2026!",
    });
  });

  it("disables demo login outside develop", () => {
    process.env.NEXT_PUBLIC_ENV = "prod";
    process.env.NEXT_PUBLIC_DEMO_EMAIL = "demo@integracionessh.dev";
    process.env.NEXT_PUBLIC_DEMO_PASSWORD = "DemoAccess2026!";

    expect(isDemoLoginEnabled()).toBe(false);
  });
});
