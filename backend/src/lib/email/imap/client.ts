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

export class ImapConnectionError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "ImapConnectionError";
    this.statusCode = statusCode;
  }
}

type ImapFlowLikeError = Error & {
  code?: string;
  hostname?: string;
  response?: string;
  authenticationFailed?: boolean;
  serverResponseCode?: string;
};

export function formatImapError(error: unknown): { message: string; statusCode: number } {
  if (error instanceof ImapConnectionError) {
    return { message: error.message, statusCode: error.statusCode };
  }

  const err = error as ImapFlowLikeError;

  if (err.authenticationFailed || err.serverResponseCode === "AUTHENTICATIONFAILED") {
    return {
      statusCode: 400,
      message:
        "Invalid IMAP credentials. Verify username and password. For Gmail or Outlook, use an app-specific password.",
    };
  }

  if (err.response) {
    const match = err.response.match(/^\d+\s+(?:NO|BAD)\s+(?:\[[^\]]+\]\s*)?(.+)$/i);
    const detail = match?.[1]?.trim() || err.response;
    return { statusCode: 400, message: detail };
  }

  if (err.code === "ENOTFOUND") {
    return {
      statusCode: 400,
      message: `IMAP server not found (${err.hostname ?? "unknown host"})`,
    };
  }

  if (err.code === "ECONNREFUSED") {
    return { statusCode: 400, message: "Connection refused. Check IMAP host and port." };
  }

  if (err.code === "ETIMEDOUT" || err.code === "ESOCKETTIMEDOUT") {
    return { statusCode: 400, message: "IMAP connection timed out. Check host, port, and network access." };
  }

  if (err.message === "Unexpected close") {
    return {
      statusCode: 400,
      message: "IMAP connection closed. For port 993 enable TLS. For port 143 try TLS (STARTTLS).",
    };
  }

  return { statusCode: 400, message: err.message || "IMAP connection failed" };
}

function resolveSecureMode(config: ImapConnectionConfig): boolean {
  if (config.port === 993) return true;
  if (config.port === 143) return false;
  return config.useTls;
}

export async function withImapClient<T>(
  config: ImapConnectionConfig,
  fn: (client: ImapFlow) => Promise<T>
): Promise<T> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: resolveSecureMode(config),
    auth: {
      user: config.username,
      pass: config.password,
    },
    logger: false,
  });

  try {
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.logout().catch(() => {});
    }
  } catch (error) {
    const formatted = formatImapError(error);
    throw new ImapConnectionError(formatted.message, formatted.statusCode);
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
