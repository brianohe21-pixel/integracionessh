import { createHash } from "crypto";
import { listContacts } from "../dynamodb/contact.repository.js";
import {
  commitMailrelaySyncPage,
  getMailrelayConfig,
  getMailrelaySyncJob,
  getMailrelaySyncPageState,
  saveMailrelaySubscriberLink,
  updateMailrelaySyncJob,
} from "../dynamodb/mailrelay.repository.js";
import type { Contact, MailrelaySyncError } from "../../types/index.js";
import { createMailrelayClient, type MailrelayClient } from "./client.js";
import { getMailrelayCredentials } from "./secrets.js";
import { isMailrelaySyncEligible, mapContactToMailrelaySubscriber } from "./mapping.js";
import { enqueueMailrelaySync } from "./sync-queue.js";

function subscriberId(response: Record<string, unknown>): number | null {
  const nested = response.data;
  const id =
    typeof response.id === "number"
      ? response.id
      : nested && typeof nested === "object"
        ? Number((nested as Record<string, unknown>).id)
        : Number.NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

export interface ProcessMailrelaySyncOptions {
  cursor?: string;
  queueUrl?: string;
  clientFactory?: (apiKey: string, baseUrl: string) => MailrelayClient;
}

export async function processMailrelaySync(
  tenantId: string,
  jobId: string,
  environment: string,
  options: ProcessMailrelaySyncOptions = {}
): Promise<void> {
  const pageToken = createHash("sha256")
    .update(options.cursor ?? "first")
    .digest("hex");
  const completedPage = await getMailrelaySyncPageState(tenantId, jobId, pageToken);
  if (completedPage) {
    if (completedPage.nextCursor) {
      await enqueueMailrelaySync(options.queueUrl ?? "", {
        tenantId,
        jobId,
        cursor: completedPage.nextCursor,
      });
    }
    return;
  }

  const existingJob = await getMailrelaySyncJob(tenantId, jobId);
  if (!existingJob) throw new Error("Email sync job not found");
  await updateMailrelaySyncJob(tenantId, jobId, {
    status: "running",
    ...(existingJob.startedAt ? {} : { startedAt: new Date().toISOString() }),
  });

  try {
    const [credentials, config, page] = await Promise.all([
      getMailrelayCredentials(environment),
      getMailrelayConfig(tenantId),
      listContacts(tenantId, {
        limit: 100,
        ...(options.cursor ? { cursor: options.cursor } : {}),
      }),
    ]);
    if (!credentials) throw new Error("Email marketing credentials are not configured");
    if (!config?.enabled) throw new Error("Email marketing is disabled");

    const contacts: Contact[] = page.items.filter(isMailrelaySyncEligible);
    const client =
      options.clientFactory?.(credentials.apiKey, credentials.baseUrl) ??
      createMailrelayClient(credentials);
    const errors: MailrelaySyncError[] = [];
    let succeeded = 0;

    for (let index = 0; index < contacts.length; index += 10) {
      const batch = contacts.slice(index, index + 10);
      const results = await Promise.all(
        batch.map(async (contact) => {
          try {
            const response = await client.syncSubscriber(
              mapContactToMailrelaySubscriber(contact, config)
            );
            const id = subscriberId(response);
            if (id && contact.email) {
              const now = new Date().toISOString();
              await saveMailrelaySubscriberLink({
                tenantId,
                subscriberId: id,
                email: contact.email.trim().toLowerCase(),
                phoneNumber: contact.phoneNumber,
                syncedAt: now,
                updatedAt: now,
              });
            }
            return null;
          } catch (error) {
            return {
              ...(contact.email ? { email: contact.email } : {}),
              message: error instanceof Error ? error.message : "Subscriber sync failed",
            };
          }
        })
      );
      for (const result of results) {
        if (result) errors.push(result);
        else succeeded++;
      }
    }

    await commitMailrelaySyncPage({
      tenantId,
      jobId,
      pageToken,
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
      processed: contacts.length,
      succeeded,
      errors,
    });
    if (page.nextCursor) {
      await enqueueMailrelaySync(options.queueUrl ?? "", {
        tenantId,
        jobId,
        cursor: page.nextCursor,
      });
    }
  } catch (error) {
    await updateMailrelaySyncJob(tenantId, jobId, {
      status: "failed",
      errors: [{ message: error instanceof Error ? error.message : "Email sync failed" }],
      completedAt: new Date().toISOString(),
    });
    throw error;
  }
}
