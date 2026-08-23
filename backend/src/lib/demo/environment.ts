import { DEMO_DEV_TABLE_NAME } from "./constants.js";

export function assertDemoSeedEnvironment(): void {
  const environment = (process.env.ENVIRONMENT ?? "dev").trim();
  const tableName = (process.env.TABLE_NAME ?? "").trim();

  if (environment !== "dev") {
    throw new Error(`Demo seed is only allowed when ENVIRONMENT=dev (got "${environment}")`);
  }

  if (tableName !== DEMO_DEV_TABLE_NAME) {
    throw new Error(
      `Demo seed is only allowed on table ${DEMO_DEV_TABLE_NAME} (got "${tableName || "unset"}")`
    );
  }
}

export function resolveDemoCredentials(): { email: string; password: string } {
  const email = (process.env.DEMO_ACCOUNT_EMAIL ?? process.env.DEMO_EMAIL ?? "").trim();
  const password = (process.env.DEMO_ACCOUNT_PASSWORD ?? process.env.DEMO_PASSWORD ?? "").trim();

  if (!email || !password) {
    throw new Error(
      "DEMO_ACCOUNT_EMAIL and DEMO_ACCOUNT_PASSWORD must be set to provision the demo Cognito user"
    );
  }

  return { email, password };
}
