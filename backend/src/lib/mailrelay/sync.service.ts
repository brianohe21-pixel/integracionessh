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
import type { Contact, MailrelayConfig, MailrelaySyncError } from "../../types/index.js";
import { createMailrelayClient, type MailrelayClient } from "./client.js";
import { getMailrelayCredentials } from "./secrets.js";
import { groupIdsForContact, isMailrelaySyncEligible, mapContactToMailrelaySubscriber } from "./mapping.js";
import { enqueueMailrelaySync } from "./sync-queue.js";
import { createNrs360Client } from "../nrs360/client.js";
import { getNrs360Credentials } from "../nrs360/secrets.js";

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

async function syncMailrelayContacts(params: {
  tenantId: string;
  contacts: Contact[];
  config: MailrelayConfig;
  environment: string;
  options: ProcessMailrelaySyncOptions;
}): Promise<{ succeeded: number; errors: MailrelaySyncError[] }> {
  const credentials = await getMailrelayCredentials(params.environment);
  if (!credentials) throw new Error("Email marketing credentials are not configured");
  const client =
    params.options.clientFactory?.(credentials.apiKey, credentials.baseUrl) ??
    createMailrelayClient(credentials);
  const errors: MailrelaySyncError[] = [];
  let succeeded = 0;

  for (let index = 0; index < params.contacts.length; index += 10) {
    const batch = params.contacts.slice(index, index + 10);
    const results = await Promise.all(
      batch.map(async (contact) => {
        try {
          const response = await client.syncSubscriber(
            mapContactToMailrelaySubscriber(contact, params.config)
          );
          const id = subscriberId(response);
          if (id && contact.email) {
            const now = new Date().toISOString();
            await saveMailrelaySubscriberLink({
              tenantId: params.tenantId,
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

  return { succeeded, errors };
}

async function syncNrs360Contacts(params: {
  tenantId: string;
  contacts: Contact[];
  config: MailrelayConfig;
  environment: string;
}): Promise<{ succeeded: number; errors: MailrelaySyncError[] }> {
  const credentials = await getNrs360Credentials(params.environment, params.tenantId);
  if (!credentials) throw new Error("360nrs credentials are not configured");
  const client = createNrs360Client(credentials);
  const errors: MailrelaySyncError[] = [];
  let succeeded = 0;

  for (let index = 0; index < params.contacts.length; index += 10) {
    const batch = params.contacts.slice(index, index + 10);
    const results = await Promise.all(
      batch.map(async (contact) => {
        try {
          const groupsIds = groupIdsForContact(contact, params.config);
          if (groupsIds.length === 0) {
            return {
              ...(contact.email ? { email: contact.email } : {}),
              message: "No audience groups mapped for contact",
            };
          }
          const response = await client.syncContact({
            email: contact.email!.trim().toLowerCase(),
            groupsIds,
            ...(contact.displayName ? { name: contact.displayName } : {}),
          });
          const id = subscriberId(response);
          if (id && contact.email) {
            const now = new Date().toISOString();
            await saveMailrelaySubscriberLink({
              tenantId: params.tenantId,
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

  return { succeeded, errors };
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
    const [config, page] = await Promise.all([
      getMailrelayConfig(tenantId),
      listContacts(tenantId, {
        limit: 100,
        ...(options.cursor ? { cursor: options.cursor } : {}),
      }),
    ]);
    if (!config?.enabled) throw new Error("Email marketing is disabled");

    const contacts: Contact[] = page.items.filter(isMailrelaySyncEligible);
    const provider = config.provider ?? "mailrelay";
    const { succeeded, errors } =
      provider === "nrs360"
        ? await syncNrs360Contacts({ tenantId, contacts, config, environment })
        : await syncMailrelayContacts({ tenantId, contacts, config, environment, options });

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
