const GRAPH_API_URL = "https://graph.facebook.com/v22.0";

export interface VerifiedInstagramPage {
  pageId: string;
  pageName: string;
  instagramAccountId: string;
  instagramUsername?: string;
}

export async function verifyInstagramPageToken(
  pageAccessToken: string,
  options?: {
    expectedPageId?: string | undefined;
    expectedInstagramAccountId?: string | undefined;
    metaAppId?: string | undefined;
    metaAppSecret?: string | undefined;
  }
): Promise<VerifiedInstagramPage> {
  const meResponse = await fetch(
    `${GRAPH_API_URL}/me?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(pageAccessToken)}`
  );

  if (!meResponse.ok) {
    const err = await meResponse.text();
    throw new Error(`Invalid page access token: ${err}`);
  }

  const page = (await meResponse.json()) as {
    id?: string;
    name?: string;
    instagram_business_account?: { id?: string; username?: string };
  };

  if (!page.id) {
    throw new Error("Page access token did not resolve to a Facebook Page");
  }

  if (options?.expectedPageId && options.expectedPageId !== page.id) {
    throw new Error(
      `Page ID mismatch: token belongs to "${page.name ?? "unknown"}" (${page.id}), not ${options.expectedPageId}`
    );
  }

  const instagramAccountId = page.instagram_business_account?.id;
  if (!instagramAccountId) {
    throw new Error(
      "This Facebook Page has no linked Instagram Business/Creator account. Link Instagram in Meta Business Suite first."
    );
  }

  if (
    options?.expectedInstagramAccountId &&
    options.expectedInstagramAccountId !== instagramAccountId
  ) {
    throw new Error(
      `Instagram Account ID mismatch: page is linked to ${instagramAccountId}, not ${options.expectedInstagramAccountId}`
    );
  }

  if (options?.metaAppId && options?.metaAppSecret) {
    const appToken = `${options.metaAppId}|${options.metaAppSecret}`;
    const debugResponse = await fetch(
      `${GRAPH_API_URL}/debug_token?input_token=${encodeURIComponent(pageAccessToken)}&access_token=${encodeURIComponent(appToken)}`
    );
    const debugPayload = (await debugResponse.json()) as {
      error?: { message?: string };
      data?: { app_id?: string; is_valid?: boolean };
    };

    if (debugPayload.error) {
      throw new Error(
        `This token was not issued by the platform Meta app. Generate it in Meta for Developers → Messenger → API Setup for app ${options.metaAppId}.`
      );
    }

    if (!debugPayload.data?.is_valid) {
      throw new Error("Page access token is not valid");
    }

    if (debugPayload.data.app_id !== options.metaAppId) {
      throw new Error(
        `Token belongs to Meta app ${debugPayload.data.app_id}, expected ${options.metaAppId}`
      );
    }
  }

  return {
    pageId: page.id,
    pageName: page.name ?? page.id,
    instagramAccountId,
    ...(page.instagram_business_account?.username
      ? { instagramUsername: page.instagram_business_account.username }
      : {}),
  };
}
