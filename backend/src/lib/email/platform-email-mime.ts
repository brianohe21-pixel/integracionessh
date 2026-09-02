export type InlineEmailAttachment = {
  cid: string;
  filename: string;
  contentType: string;
  data: Buffer;
};

export function buildRawEmailMessage(params: {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  headers?: string[];
  inlineAttachments?: InlineEmailAttachment[];
}): string {
  const recipients = params.to.join(", ");
  const baseHeaders = [
    `From: ${params.from}`,
    `To: ${recipients}`,
    `Subject: ${params.subject}`,
    ...(params.headers ?? []),
    "MIME-Version: 1.0",
  ];

  if (!params.inlineAttachments?.length) {
    const boundary = `boundary-${Date.now()}`;
    return [
      ...baseHeaders,
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
  }

  const relatedBoundary = `related-${Date.now()}`;
  const altBoundary = `alt-${Date.now() + 1}`;
  const parts = [
    ...baseHeaders,
    `Content-Type: multipart/related; boundary="${relatedBoundary}"`,
    "",
    `--${relatedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    params.text,
  ];

  if (params.html) {
    parts.push(
      `--${altBoundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "",
      params.html
    );
  }

  parts.push(`--${altBoundary}--`);

  for (const attachment of params.inlineAttachments) {
    parts.push(
      `--${relatedBoundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: inline; filename="${attachment.filename}"`,
      `Content-ID: <${attachment.cid}>`,
      "",
      attachment.data.toString("base64")
    );
  }

  parts.push(`--${relatedBoundary}--`);
  return parts.join("\r\n");
}
