import { SESClient } from "@aws-sdk/client-ses";

const ses = new SESClient({});

export async function sendEmail(params: {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  inReplyTo?: string;
  references?: string;
}): Promise<{ messageId: string }> {
  const from = params.from?.trim() || process.env.SES_FROM_EMAIL?.trim();
  if (!from) {
    console.warn("SES_FROM_EMAIL is not configured; skipping email send");
    return { messageId: `skipped-${Date.now()}` };
  }

  const recipients = params.to.map((email) => email.trim()).filter(Boolean);
  if (recipients.length === 0) {
    console.warn("No email recipients configured; skipping email send");
    return { messageId: `skipped-${Date.now()}` };
  }

  const headers: string[] = [];
  if (params.inReplyTo) headers.push(`In-Reply-To: ${params.inReplyTo}`);
  if (params.references) headers.push(`References: ${params.references}`);

  const boundary = `boundary-${Date.now()}`;
  const rawMessage = [
    `From: ${from}`,
    `To: ${recipients.join(", ")}`,
    `Subject: ${params.subject}`,
    ...headers,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    params.text,
    ...(params.html
      ? [
          `--${boundary}`,
          "Content-Type: text/html; charset=UTF-8",
          "",
          params.html,
        ]
      : []),
    `--${boundary}--`,
  ].join("\r\n");

  const { SendRawEmailCommand } = await import("@aws-sdk/client-ses");
  const result = await ses.send(
    new SendRawEmailCommand({
      Source: from,
      Destinations: recipients,
      RawMessage: { Data: Buffer.from(rawMessage) },
    })
  );

  return { messageId: result.MessageId ?? `email-${Date.now()}` };
}

export function parseEmailList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(",").map((email) => email.trim()).filter(Boolean))];
}
