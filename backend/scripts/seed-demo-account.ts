import { upsertDemoCognitoUser } from "../src/lib/demo/cognito-user.js";
import { DEMO_TENANT_ID } from "../src/lib/demo/constants.js";
import {
  assertDemoSeedEnvironment,
  resolveDemoCredentials,
} from "../src/lib/demo/environment.js";
import {
  seedAdvisors,
  seedAutomations,
  seedBots,
  seedCalls,
  seedContacts,
  seedConversations,
  seedFlows,
  seedMacros,
  seedMarketing,
  seedMember,
  seedSales,
  seedTemplates,
  seedTenantRecord,
  seedUsage,
} from "../src/lib/demo/seed-expanded.js";
import { seedDemoFlowActivity } from "../src/lib/demo/seed-flow-activity.js";

export async function seedDemoAccount(options: { reset?: boolean } = {}): Promise<void> {
  assertDemoSeedEnvironment();
  const credentials = resolveDemoCredentials();
  const now = new Date().toISOString();

  if (options.reset) {
    const { wipeDemoTenant } = await import("./wipe-demo-tenant.js");
    await wipeDemoTenant();
  }

  const cognitoUser = await upsertDemoCognitoUser({
    email: credentials.email,
    password: credentials.password,
    name: "Demo Presenter",
  });

  await seedTenantRecord(now, credentials.email);
  await seedBots(now);
  await seedFlows(now);
  await seedDemoFlowActivity();
  await seedContacts(now);
  await seedConversations(now);
  await seedCalls(now);
  await seedSales(now);
  await seedMarketing(now);
  await seedAdvisors(now);
  await seedAutomations(now);
  await seedTemplates(now);
  await seedMacros(now);
  await seedUsage(now);
  await seedMember(cognitoUser.userId, credentials.email, now);
}

const reset = process.argv.includes("--reset");
seedDemoAccount({ reset })
  .then(() => {
    console.log(`Demo tenant seeded: ${DEMO_TENANT_ID}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
