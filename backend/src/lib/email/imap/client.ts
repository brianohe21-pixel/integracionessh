import { ImapFlow } from "imapflow";

export interface ImapConnectionConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  useTls: boolean;
  mailbox?: string;
}

export interface ImapMailboxStatus {
  uidValidity: number;
  uidNext: number;
  exists: number;
}

export async function withImapClient<T>(
  config: ImapConnectionConfig,
  fn: (client: ImapFlow) => Promise<T>
): Promise<T> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.useTls,
    auth: {
      user: config.username,
      pass: config.password,
    },
    logger: false,
  });

  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function testImapConnection(config: ImapConnectionConfig): Promise<ImapMailboxStatus> {
  return withImapClient(config, async (client) => {
    const mailbox = config.mailbox || "INBOX";
    const lock = await client.getMailboxLock(mailbox);
    try {
      const status = await client.status(mailbox, { uidValidity: true, uidNext: true, messages: true });
      return {
        uidValidity: Number(status.uidValidity ?? 0),
        uidNext: Number(status.uidNext ?? 1),
        exists: Number(status.messages ?? 0),
      };
    } finally {
      lock.release();
    }
  });
}

export async function fetchImapMessagesSinceUid(
  config: ImapConnectionConfig,
  uidValidity: number,
  lastUid: number,
  limit = 50
): Promise<{
  uidValidity: number;
  messages: Array<{ uid: number; source: Buffer }>;
}> {
  return withImapClient(config, async (client) => {
    const mailbox = config.mailbox || "INBOX";
    const lock = await client.getMailboxLock(mailbox);
    try {
      const status = await client.status(mailbox, { uidValidity: true, uidNext: true });
      const currentUidValidity = Number(status.uidValidity ?? 0);
      if (currentUidValidity !== uidValidity && uidValidity > 0) {
        return { uidValidity: currentUidValidity, messages: [] };
      }

      const startUid = Math.max(lastUid + 1, 1);
      const range = `${startUid}:*`;
      const messages: Array<{ uid: number; source: Buffer }> = [];

      for await (const message of client.fetch(range, { uid: true, source: true }, { uid: true })) {
        if (!message.uid || !message.source) continue;
        if (message.uid <= lastUid) continue;
        messages.push({ uid: message.uid, source: message.source });
        if (messages.length >= limit) break;
      }

      return { uidValidity: currentUidValidity, messages };
    } finally {
      lock.release();
    }
  });
}
