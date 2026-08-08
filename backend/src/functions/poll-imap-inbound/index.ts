import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { pollAllActiveImapMailboxes } from "../../lib/email/imap/poll.js";
import { handleError } from "../../lib/http.js";

export async function handler(
  _event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    await pollAllActiveImapMailboxes();
    return { statusCode: 200, body: "OK" };
  } catch (error) {
    return handleError(error);
  }
}
