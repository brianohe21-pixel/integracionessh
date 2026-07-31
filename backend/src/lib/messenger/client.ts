const GRAPH_API_URL = "https://graph.facebook.com/v22.0";

export async function sendMessengerTextMessage(params: {
  pageId: string;
  recipientId: string;
  text: string;
  accessToken: string;
}): Promise<{ messageId: string }> {
  const response = await fetch(`${GRAPH_API_URL}/${params.pageId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: { id: params.recipientId },
      message: { text: params.text },
      messaging_type: "RESPONSE",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Messenger send failed: ${response.status} ${err}`);
  }

  const data = (await response.json()) as { message_id?: string };
  return { messageId: data.message_id ?? `msg-${Date.now()}` };
}
