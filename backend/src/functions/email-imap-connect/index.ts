import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { resolveRequestAuth, assertMemberRole } from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import { getBot, updateBot } from "../../lib/dynamodb/bot.repository.js";
import {
  putEmailAddressLookup,
  deleteEmailAddressLookup,
} from "../../lib/dynamodb/bot-lookup.repository.js";
import {
  putEmailImapActiveLookup,
  deleteEmailImapActiveLookup,
  putEmailImapSyncState,
  deleteEmailImapSyncState,
} from "../../lib/dynamodb/email-imap-sync.repository.js";
import { saveImapSecret, deleteImapSecret } from "../../lib/email/imap/secrets.js";
import { testImapConnection } from "../../lib/email/imap/client.js";
import { assertCanEnableChannel } from "../../lib/billing/assert-plan.js";
import { ensureTenant } from "../../lib/dynamodb/tenant.repository.js";
import { ok, badRequest, handleError } from "../../lib/http.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

const ImapConfigSchema = z.object({
  botId: z.string().uuid(),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).default(993),
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(512),
  mailbox: z.string().min(1).max(255).default("INBOX"),
  useTls: z.boolean().default(true),
  emailAddress: z.string().email(),
});

const TestSchema = ImapConfigSchema;

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? "";

    const auth = await resolveRequestAuth(event);
    assertMemberRole(auth);
    await assertAssignedServices(auth.tenantId, "bots");

    if (method === "POST" && rawPath.endsWith("/test")) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = TestSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const bot = await getBot(auth.tenantId, parsed.data.botId);
      if (!bot) return badRequest("Bot not found");

      const status = await testImapConnection({
        host: parsed.data.host,
        port: parsed.data.port,
        username: parsed.data.username,
        password: parsed.data.password,
        useTls: parsed.data.useTls,
        mailbox: parsed.data.mailbox,
      });

      return ok({ ok: true, uidValidity: status.uidValidity, uidNext: status.uidNext });
    }

    if (method === "POST" && rawPath.endsWith("/connect")) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = ImapConfigSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const bot = await getBot(auth.tenantId, parsed.data.botId);
      if (!bot) return badRequest("Bot not found");

      const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
      await assertCanEnableChannel(tenant, bot, "email");

      const status = await testImapConnection({
        host: parsed.data.host,
        port: parsed.data.port,
        username: parsed.data.username,
        password: parsed.data.password,
        useTls: parsed.data.useTls,
        mailbox: parsed.data.mailbox,
      });

      await saveImapSecret(auth.tenantId, parsed.data.botId, ENVIRONMENT, {
        password: parsed.data.password,
      });

      const emailAddress = parsed.data.emailAddress.toLowerCase();
      if (bot.emailAddress && bot.emailAddress !== emailAddress) {
        await deleteEmailAddressLookup(bot.emailAddress);
      }

      await putEmailAddressLookup(emailAddress, auth.tenantId, parsed.data.botId);
      await putEmailImapActiveLookup(auth.tenantId, parsed.data.botId, emailAddress);

      const initialLastUid = Math.max((status.uidNext ?? 1) - 1, 0);
      await putEmailImapSyncState({
        tenantId: auth.tenantId,
        botId: parsed.data.botId,
        uidValidity: status.uidValidity,
        lastUid: initialLastUid,
        consecutiveFailures: 0,
      });

      const updated = await updateBot(auth.tenantId, parsed.data.botId, {
        emailEnabled: true,
        emailInboundProvider: "imap",
        emailAddress,
        emailImapHost: parsed.data.host,
        emailImapPort: parsed.data.port,
        emailImapMailbox: parsed.data.mailbox,
        emailImapUseTls: parsed.data.useTls,
        emailImapUsername: parsed.data.username,
        emailImapConnectedAt: new Date().toISOString(),
        emailImapLastError: "",
        emailImapPollingEnabled: true,
      });

      return ok({
        connected: true,
        emailEnabled: updated.emailEnabled,
        emailAddress: updated.emailAddress,
        emailInboundProvider: updated.emailInboundProvider,
        emailImapLastSyncAt: updated.emailImapLastSyncAt,
      });
    }

    if (method === "DELETE" && rawPath.includes("/connect")) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = z.object({ botId: z.string().uuid() }).safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const bot = await getBot(auth.tenantId, parsed.data.botId);
      if (!bot) return badRequest("Bot not found");

      await deleteImapSecret(auth.tenantId, parsed.data.botId, ENVIRONMENT);
      await deleteEmailImapActiveLookup(auth.tenantId, parsed.data.botId);
      await deleteEmailImapSyncState(auth.tenantId, parsed.data.botId);
      if (bot.emailAddress) {
        await deleteEmailAddressLookup(bot.emailAddress);
      }

      const updated = await updateBot(auth.tenantId, parsed.data.botId, {
        emailEnabled: false,
        emailImapPollingEnabled: false,
      });

      return ok({
        connected: false,
        emailEnabled: updated.emailEnabled,
      });
    }

    return badRequest("Method not allowed");
  } catch (error) {
    return handleError(error);
  }
}
