const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const SCOPE = [
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

const ACCOUNT_API = "https://mybusinessaccountmanagement.googleapis.com/v1";
const LOCATIONS_API = "https://mybusinessbusinessinformation.googleapis.com/v1";
const REVIEWS_API = "https://mybusiness.googleapis.com/v4";

export interface GoogleOAuthCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface GoogleReview {
  reviewId: string;
  name: string;
  reviewer?: {
    displayName?: string;
    profilePhotoUrl?: string;
    isAnonymous?: boolean;
  };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: {
    comment?: string;
    updateTime?: string;
  };
}

export interface GoogleReviewsListResponse {
  reviews: GoogleReview[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
}

function getCredentials(): GoogleOAuthCredentials {
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET?.trim() ?? "";
  const redirectUri =
    process.env.GOOGLE_BUSINESS_REDIRECT_URI?.trim() ||
    `${(process.env.API_PUBLIC_URL ?? "").replace(/\/$/, "")}/public/integrations/google-business/oauth/callback`;
  if (!clientId || !clientSecret || !redirectUri) {
    throw Object.assign(new Error("Google Business Profile OAuth is not configured"), {
      statusCode: 503,
    });
  }
  return { clientId, clientSecret, redirectUri };
}

async function parseGoogleError(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const json = JSON.parse(body) as { error?: { message?: string }; error_description?: string };
    return json.error?.message ?? json.error_description ?? body;
  } catch {
    return body || response.statusText;
  }
}

function isQuotaError(message: string): boolean {
  return /quota exceeded/i.test(message);
}

export function formatGoogleApiError(message: string): string {
  if (isQuotaError(message)) {
    return "Google API rate limit reached. Wait one minute and try connecting again.";
  }
  return message;
}

function isRetryableGoogleResponse(status: number, message: string): boolean {
  return status === 429 || status === 503 || isQuotaError(message);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function googleFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (response.ok) {
      if (response.status === 204) return {} as T;
      return (await response.json()) as T;
    }
    const message = await parseGoogleError(response);
    if (attempt < maxAttempts && isRetryableGoogleResponse(response.status, message)) {
      await sleep(2_000 * attempt);
      continue;
    }
    const statusCode =
      response.status === 403 ? 403 : response.status === 429 || isQuotaError(message) ? 429 : 502;
    throw Object.assign(new Error(formatGoogleApiError(message)), { statusCode });
  }
  throw Object.assign(new Error("Google API request failed"), { statusCode: 502 });
}

export function buildOAuthUrl(state: string): string {
  const { clientId, redirectUri } = getCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${OAUTH_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getCredentials();
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    const message = await parseGoogleError(response);
    throw Object.assign(new Error(`OAuth token exchange failed: ${message}`), { statusCode: 400 });
  }
  return (await response.json()) as GoogleTokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = getCredentials();
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    const message = await parseGoogleError(response);
    throw Object.assign(new Error(`Token refresh failed: ${message}`), { statusCode: 401 });
  }
  return (await response.json()) as GoogleTokenResponse;
}

export async function getGoogleUserEmail(accessToken: string): Promise<string | undefined> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return undefined;
  const data = (await response.json()) as { email?: string };
  return data.email?.trim() || undefined;
}

export async function listGoogleAccounts(accessToken: string): Promise<
  { id: string; name: string }[]
> {
  const data = await googleFetch<{ accounts?: { name?: string; accountName?: string }[] }>(
    `${ACCOUNT_API}/accounts`,
    accessToken
  );
  return (data.accounts ?? [])
    .map((account) => {
      const resourceName = account.name?.trim() ?? "";
      const id = resourceName.replace(/^accounts\//, "");
      const label = account.accountName?.trim() || id;
      if (!id) return null;
      return { id: resourceName, name: label };
    })
    .filter((item): item is { id: string; name: string } => Boolean(item));
}

export async function listGoogleLocations(
  accessToken: string,
  accountResourceName: string
): Promise<{ id: string; name: string; address?: string }[]> {
  const params = new URLSearchParams({
    readMask: "name,title,storefrontAddress",
    pageSize: "100",
  });
  const data = await googleFetch<{
    locations?: {
      name?: string;
      title?: string;
      storefrontAddress?: {
        addressLines?: string[];
        locality?: string;
        administrativeArea?: string;
      };
    }[];
  }>(`${LOCATIONS_API}/${accountResourceName}/locations?${params.toString()}`, accessToken);

  return (data.locations ?? [])
    .map((location) => {
      const id = location.name?.trim() ?? "";
      if (!id) return null;
      const addressParts = [
        ...(location.storefrontAddress?.addressLines ?? []),
        location.storefrontAddress?.locality,
        location.storefrontAddress?.administrativeArea,
      ].filter(Boolean);
      return {
        id,
        name: location.title?.trim() || id,
        ...(addressParts.length ? { address: addressParts.join(", ") } : {}),
      };
    })
    .filter((item): item is { id: string; name: string; address?: string } => Boolean(item));
}

function starRatingToNumber(rating?: string): number {
  const map: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };
  return map[rating ?? ""] ?? 0;
}

function normalizeReview(raw: Record<string, unknown>): GoogleReview {
  const name = String(raw.name ?? "");
  const reviewId = name.split("/").pop() ?? name;
  const review: GoogleReview = {
    reviewId,
    name,
  };
  if (raw.reviewer) {
    review.reviewer = raw.reviewer as NonNullable<GoogleReview["reviewer"]>;
  }
  if (raw.starRating) {
    review.starRating = String(raw.starRating);
  }
  if (raw.comment) {
    review.comment = String(raw.comment);
  }
  if (raw.createTime) {
    review.createTime = String(raw.createTime);
  }
  if (raw.updateTime) {
    review.updateTime = String(raw.updateTime);
  }
  if (raw.reviewReply) {
    review.reviewReply = raw.reviewReply as NonNullable<GoogleReview["reviewReply"]>;
  }
  return review;
}

export async function listGoogleReviews(
  accessToken: string,
  locationResourceName: string,
  options?: { pageToken?: string; orderBy?: string; pageSize?: number }
): Promise<GoogleReviewsListResponse> {
  const params = new URLSearchParams();
  if (options?.pageToken) params.set("pageToken", options.pageToken);
  if (options?.orderBy) params.set("orderBy", options.orderBy);
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  const query = params.toString();
  const url = `${REVIEWS_API}/${locationResourceName}/reviews${query ? `?${query}` : ""}`;
  const data = await googleFetch<Record<string, unknown>>(url, accessToken);
  const reviews = Array.isArray(data.reviews)
    ? data.reviews.map((review) => normalizeReview(review as Record<string, unknown>))
    : [];
  return {
    reviews,
    ...(typeof data.averageRating === "number" ? { averageRating: data.averageRating } : {}),
    ...(typeof data.totalReviewCount === "number"
      ? { totalReviewCount: data.totalReviewCount }
      : {}),
    ...(typeof data.nextPageToken === "string" ? { nextPageToken: data.nextPageToken } : {}),
  };
}

export async function updateGoogleReviewReply(
  accessToken: string,
  locationResourceName: string,
  reviewId: string,
  comment: string
): Promise<{ comment: string; updateTime?: string }> {
  const reviewName = `${locationResourceName}/reviews/${reviewId}`;
  const data = await googleFetch<{ comment?: string; updateTime?: string }>(
    `${REVIEWS_API}/${reviewName}/reply`,
    accessToken,
    {
      method: "PUT",
      body: JSON.stringify({ comment }),
    }
  );
  return {
    comment: data.comment ?? comment,
    ...(data.updateTime ? { updateTime: data.updateTime } : {}),
  };
}

export async function deleteGoogleReviewReply(
  accessToken: string,
  locationResourceName: string,
  reviewId: string
): Promise<void> {
  const reviewName = `${locationResourceName}/reviews/${reviewId}`;
  await googleFetch<Record<string, never>>(
    `${REVIEWS_API}/${reviewName}/reply`,
    accessToken,
    { method: "DELETE" }
  );
}

export function reviewStarCount(review: GoogleReview): number {
  return starRatingToNumber(review.starRating);
}
