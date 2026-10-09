const GRAPH_API_URL = "https://graph.facebook.com/v22.0";

export type InstagramPageCandidate = {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  instagramAccountId: string;
  instagramUsername?: string;
};

export type ResolveInstagramLoginResult =
  | { status: "ready"; page: InstagramPageCandidate }
  | { status: "needs_selection"; pages: InstagramPageCandidate[] };

function httpError(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

export async function exchangeInstagramCodeForToken(
  code: string,
  appId: string,
  appSecret: string
): Promise<string> {
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
  });

  const response = await fetch(`${GRAPH_API_URL}/oauth/access_token?${params.toString()}`);
  if (!response.ok) {
    const body = await response.text();
    throw httpError(`Failed to exchange authorization code: ${body}`, 502);
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw httpError("Meta did not return an access token", 502);
  }

  return json.access_token;
}

export async function exchangeForLongLivedUserToken(
  shortLivedToken: string,
  appId: string,
  appSecret: string
): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(`${GRAPH_API_URL}/oauth/access_token?${params.toString()}`);
  if (!response.ok) {
    const body = await response.text();
    throw httpError(`Failed to exchange long-lived user token: ${body}`, 502);
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw httpError("Meta did not return a long-lived access token", 502);
  }

  return json.access_token;
}

export async function listInstagramPagesForUser(
  userAccessToken: string
): Promise<InstagramPageCandidate[]> {
  const fields = "id,name,access_token,instagram_business_account{id,username}";
  const response = await fetch(
    `${GRAPH_API_URL}/me/accounts?fields=${encodeURIComponent(fields)}&limit=100&access_token=${encodeURIComponent(userAccessToken)}`
  );

  if (!response.ok) {
    const body = await response.text();
    throw httpError(`Failed to list Facebook Pages: ${body}`, 502);
  }

  const json = (await response.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string; username?: string };
    }>;
  };

  const pages: InstagramPageCandidate[] = [];
  for (const page of json.data ?? []) {
    if (!page.id || !page.access_token || !page.instagram_business_account?.id) continue;
    pages.push({
      pageId: page.id,
      pageName: page.name ?? page.id,
      pageAccessToken: page.access_token,
      instagramAccountId: page.instagram_business_account.id,
      ...(page.instagram_business_account.username
        ? { instagramUsername: page.instagram_business_account.username }
        : {}),
    });
  }

  return pages;
}

export function selectInstagramPage(
  pages: InstagramPageCandidate[],
  preferredPageId?: string
): ResolveInstagramLoginResult {
  if (pages.length === 0) {
    throw httpError(
      "No Facebook Page with a linked Instagram Business/Creator account was granted. Link Instagram in Meta Business Suite and grant page access.",
      400
    );
  }

  if (preferredPageId) {
    const match = pages.find((page) => page.pageId === preferredPageId);
    if (!match) {
      throw httpError(
        `Selected page ${preferredPageId} was not granted or has no linked Instagram account`,
        400
      );
    }
    return { status: "ready", page: match };
  }

  if (pages.length === 1) {
    return { status: "ready", page: pages[0] };
  }

  return { status: "needs_selection", pages };
}

export async function resolveInstagramPageFromLogin(params: {
  code?: string;
  userAccessToken?: string;
  preferredPageId?: string;
  appId: string;
  appSecret: string;
}): Promise<ResolveInstagramLoginResult> {
  let userToken = params.userAccessToken?.trim() ?? "";

  if (params.code?.trim()) {
    const shortLived = await exchangeInstagramCodeForToken(
      params.code.trim(),
      params.appId,
      params.appSecret
    );
    userToken = await exchangeForLongLivedUserToken(shortLived, params.appId, params.appSecret);
  } else if (userToken) {
    userToken = await exchangeForLongLivedUserToken(userToken, params.appId, params.appSecret);
  } else {
    throw httpError("Authorization code or user access token is required", 400);
  }

  const pages = await listInstagramPagesForUser(userToken);
  return selectInstagramPage(pages, params.preferredPageId);
}
