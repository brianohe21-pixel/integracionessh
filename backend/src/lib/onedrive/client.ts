import { createHash, randomBytes } from "crypto";
import type { CloudDriveFileItem } from "../../types/index.js";

const OAUTH_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const OAUTH_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_API = "https://graph.microsoft.com/v1.0";
const FOLDER_MIME = "application/vnd.ms-folder";

export const ONEDRIVE_SCOPES = [
  "offline_access",
  "User.Read",
  "Files.Read",
  "Files.ReadWrite",
].join(" ");

export interface OneDriveOAuthCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OneDriveTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

interface GraphDriveItem {
  id?: string;
  name?: string;
  size?: number;
  lastModifiedDateTime?: string;
  webUrl?: string;
  folder?: Record<string, unknown>;
  file?: { mimeType?: string };
  parentReference?: { id?: string };
}

function getCredentials(): OneDriveOAuthCredentials {
  const clientId = process.env.ONEDRIVE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET?.trim() ?? "";
  const redirectUri =
    process.env.ONEDRIVE_REDIRECT_URI?.trim() ||
    `${(process.env.API_PUBLIC_URL ?? "").replace(/\/$/, "")}/public/integrations/onedrive/oauth/callback`;
  if (!clientId || !clientSecret || !redirectUri) {
    throw Object.assign(new Error("OneDrive OAuth is not configured"), {
      statusCode: 503,
    });
  }
  return { clientId, clientSecret, redirectUri };
}

async function parseGraphError(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const json = JSON.parse(body) as {
      error?: string | { message?: string; code?: string };
      error_description?: string;
    };
    if (typeof json.error === "string") {
      return json.error_description ?? json.error;
    }
    return json.error?.message ?? json.error_description ?? body;
  } catch {
    return body || response.statusText;
  }
}

async function graphFetch<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const message = await parseGraphError(response);
    throw Object.assign(new Error(message), {
      statusCode: response.status === 403 ? 403 : response.status === 401 ? 401 : 502,
    });
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

function toFileItem(raw: GraphDriveItem): CloudDriveFileItem | null {
  if (!raw.id || !raw.name) return null;
  const isFolder = Boolean(raw.folder);
  return {
    id: raw.id,
    name: raw.name,
    mimeType: isFolder ? FOLDER_MIME : raw.file?.mimeType ?? "application/octet-stream",
    isFolder,
    ...(typeof raw.size === "number" ? { size: raw.size } : {}),
    ...(raw.lastModifiedDateTime ? { modifiedAt: raw.lastModifiedDateTime } : {}),
    ...(raw.webUrl ? { webUrl: raw.webUrl } : {}),
    ...(raw.parentReference?.id ? { parentId: raw.parentReference.id } : {}),
  };
}

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildOAuthUrl(state: string, codeChallenge: string): string {
  const { clientId, redirectUri } = getCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: ONEDRIVE_SCOPES,
    response_mode: "query",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${OAUTH_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<OneDriveTokenResponse> {
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
      code_verifier: codeVerifier,
      scope: ONEDRIVE_SCOPES,
    }),
  });
  if (!response.ok) {
    const message = await parseGraphError(response);
    throw Object.assign(new Error(message), { statusCode: 400 });
  }
  return (await response.json()) as OneDriveTokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<OneDriveTokenResponse> {
  const { clientId, clientSecret } = getCredentials();
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      scope: ONEDRIVE_SCOPES,
    }),
  });
  if (!response.ok) {
    const message = await parseGraphError(response);
    throw Object.assign(new Error(message), { statusCode: 401 });
  }
  return (await response.json()) as OneDriveTokenResponse;
}

export async function getMicrosoftUserProfile(
  accessToken: string
): Promise<{ email?: string; displayName?: string }> {
  try {
    const data = await graphFetch<{ mail?: string; userPrincipalName?: string; displayName?: string }>(
      `${GRAPH_API}/me`,
      accessToken
    );
    const email = (data.mail ?? data.userPrincipalName)?.trim();
    return {
      ...(email ? { email } : {}),
      ...(data.displayName ? { displayName: data.displayName.trim() } : {}),
    };
  } catch {
    return {};
  }
}

export async function listOneDriveFiles(
  accessToken: string,
  options?: { folderId?: string; pageToken?: string; query?: string; pageSize?: number }
): Promise<{ files: CloudDriveFileItem[]; nextPageToken?: string }> {
  const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 50));

  if (options?.query?.trim()) {
    const params = new URLSearchParams({
      $top: String(pageSize),
      $select: "id,name,size,lastModifiedDateTime,webUrl,folder,file,parentReference",
    });
    const data = await graphFetch<{ value?: GraphDriveItem[] }>(
      `${GRAPH_API}/me/drive/root/search(q='${encodeURIComponent(options.query.trim())}')?${params.toString()}`,
      accessToken
    );
    return {
      files: (data.value ?? [])
        .map(toFileItem)
        .filter((item): item is CloudDriveFileItem => Boolean(item)),
    };
  }

  if (options?.pageToken?.startsWith("http")) {
    const data = await graphFetch<{ value?: GraphDriveItem[]; "@odata.nextLink"?: string }>(
      options.pageToken,
      accessToken
    );
    return {
      files: (data.value ?? [])
        .map(toFileItem)
        .filter((item): item is CloudDriveFileItem => Boolean(item)),
      ...(data["@odata.nextLink"] ? { nextPageToken: data["@odata.nextLink"] } : {}),
    };
  }

  const params = new URLSearchParams({
    $top: String(pageSize),
    $orderby: "name",
    $select: "id,name,size,lastModifiedDateTime,webUrl,folder,file,parentReference",
  });
  const basePath = options?.folderId?.trim()
    ? `${GRAPH_API}/me/drive/items/${encodeURIComponent(options.folderId.trim())}/children`
    : `${GRAPH_API}/me/drive/root/children`;

  const data = await graphFetch<{ value?: GraphDriveItem[]; "@odata.nextLink"?: string }>(
    `${basePath}?${params.toString()}`,
    accessToken
  );

  return {
    files: (data.value ?? [])
      .map(toFileItem)
      .filter((item): item is CloudDriveFileItem => Boolean(item)),
    ...(data["@odata.nextLink"] ? { nextPageToken: data["@odata.nextLink"] } : {}),
  };
}

export async function getOneDriveFile(
  accessToken: string,
  fileId: string
): Promise<CloudDriveFileItem> {
  const data = await graphFetch<GraphDriveItem>(
    `${GRAPH_API}/me/drive/items/${encodeURIComponent(fileId)}?$select=id,name,size,lastModifiedDateTime,webUrl,folder,file,parentReference`,
    accessToken
  );
  const item = toFileItem(data);
  if (!item) {
    throw Object.assign(new Error("File not found"), { statusCode: 404 });
  }
  return item;
}

export async function createOneDriveFolder(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<CloudDriveFileItem> {
  const path = parentId?.trim()
    ? `${GRAPH_API}/me/drive/items/${encodeURIComponent(parentId.trim())}/children`
    : `${GRAPH_API}/me/drive/root/children`;

  const data = await graphFetch<GraphDriveItem>(path, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      folder: {},
      "@microsoft.graph.conflictBehavior": "rename",
    }),
  });
  const item = toFileItem(data);
  if (!item) {
    throw Object.assign(new Error("Failed to create folder"), { statusCode: 502 });
  }
  return item;
}

export async function uploadOneDriveFile(
  accessToken: string,
  params: {
    name: string;
    mimeType: string;
    contentBase64: string;
    parentId?: string;
  }
): Promise<CloudDriveFileItem> {
  const binary = Buffer.from(params.contentBase64, "base64");
  const safeName = encodeURIComponent(params.name);
  const path = params.parentId?.trim()
    ? `${GRAPH_API}/me/drive/items/${encodeURIComponent(params.parentId.trim())}:/${safeName}:/content`
    : `${GRAPH_API}/me/drive/root:/${safeName}:/content`;

  const response = await fetch(path, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": params.mimeType,
      "Content-Length": String(binary.length),
    },
    body: binary,
  });
  if (!response.ok) {
    const message = await parseGraphError(response);
    throw Object.assign(new Error(message), { statusCode: response.status === 403 ? 403 : 502 });
  }
  const data = (await response.json()) as GraphDriveItem;
  const item = toFileItem(data);
  if (!item) {
    throw Object.assign(new Error("Failed to upload file"), { statusCode: 502 });
  }
  return item;
}

export async function updateOneDriveFile(
  accessToken: string,
  fileId: string,
  params: {
    name?: string;
    mimeType?: string;
    contentBase64?: string;
  }
): Promise<CloudDriveFileItem> {
  if (!params.name && !params.contentBase64) {
    throw Object.assign(new Error("Provide name and/or contentBase64 to update the file"), {
      statusCode: 400,
    });
  }

  if (params.contentBase64) {
    const mimeType = params.mimeType ?? "application/octet-stream";
    const binary = Buffer.from(params.contentBase64, "base64");
    const response = await fetch(
      `${GRAPH_API}/me/drive/items/${encodeURIComponent(fileId)}/content`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": mimeType,
          "Content-Length": String(binary.length),
        },
        body: binary,
      }
    );
    if (!response.ok) {
      const message = await parseGraphError(response);
      throw Object.assign(new Error(message), {
        statusCode: response.status === 403 ? 403 : response.status === 404 ? 404 : 502,
      });
    }
  }

  if (params.name?.trim()) {
    await graphFetch<GraphDriveItem>(
      `${GRAPH_API}/me/drive/items/${encodeURIComponent(fileId)}`,
      accessToken,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: params.name.trim() }),
      }
    );
  }

  return getOneDriveFile(accessToken, fileId);
}
