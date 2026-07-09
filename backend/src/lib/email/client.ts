import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({});

export async function sendEmail(params: {
  to: string[];
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const from = process.env.SES_FROM_EMAIL?.trim();
  if (!from) {
    console.warn("SES_FROM_EMAIL is not configured; skipping email send");
    return;
  }

  const recipients = params.to.map((email) => email.trim()).filter(Boolean);
  if (recipients.length === 0) {
    console.warn("No email recipients configured; skipping email send");
    return;
  }

  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: recipients },
      Message: {
        Subject: { Data: params.subject, Charset: "UTF-8" },
        Body: {
          Text: { Data: params.text, Charset: "UTF-8" },
          ...(params.html
            ? { Html: { Data: params.html, Charset: "UTF-8" } }
            : {}),
        },
      },
    })
  );
}

export function parseEmailList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(",").map((email) => email.trim()).filter(Boolean))];
}
