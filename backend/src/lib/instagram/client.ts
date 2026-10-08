const GRAPH_API_URL = "https://graph.facebook.com/v22.0";

const INSTAGRAM_CLIENT_ERROR_CODES = new Set([
  10, 100, 190, 200, 551, 613, 900,
]);

function throwInstagramGraphError(status: number, body: string): never {
  try {
    const parsed = JSON.parse(body) as {
      error?: {
        code?: number;
        error_subcode?: number;
        error_user_msg?: string;
        message?: string;
        is_transient?: boolean;
      };
    };
    const graphError = parsed.error;
    if (!graphError) throw new SyntaxError();

    const message =
      graphError.error_user_msg ?? graphError.message ?? "Instagram API request failed";

    if (status === 429 || graphError.code === 4 || graphError.code === 17 || graphError.code === 613) {
      const err = new Error(
        `Instagram rate limit exceeded: ${message}`
      ) as Error & { statusCode?: number; code?: string };
      err.statusCode = 429;
      err.code = "INSTAGRAM_RATE_LIMIT";
      throw err;
    }

    if (graphError.code === 10 || graphError.code === 200 || graphError.code === 551) {
      const err = new Error(
        `Instagram messaging window closed or permission denied: ${message}`
      ) as Error & { statusCode?: number; code?: string };
      err.statusCode = 400;
      err.code = "INSTAGRAM_MESSAGING_WINDOW_CLOSED";
      throw err;
    }

    if (graphError.code !== undefined && INSTAGRAM_CLIENT_ERROR_CODES.has(graphError.code)) {
      const err = new Error(message) as Error & { statusCode?: number };
      err.statusCode = graphError.code === 190 || status === 401 ? 401 : 400;
      throw err;
    }

    if (graphError.is_transient || graphError.code === 2) {
      const err = new Error(message) as Error & { statusCode?: number };
      err.statusCode = 502;
      throw err;
    }
  } catch (e) {
    if ((e as Error & { statusCode?: number }).statusCode) throw e;
  }

  const err = new Error(`Instagram send failed: ${status} ${body}`) as Error & {
    statusCode?: number;
  };
  err.statusCode = 502;
  throw err;
}

export async function sendInstagramTextMessage(params: {
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
    throwInstagramGraphError(response.status, await response.text());
  }

  const data = (await response.json()) as { message_id?: string };
  return { messageId: data.message_id ?? `ig-${Date.now()}` };
}
