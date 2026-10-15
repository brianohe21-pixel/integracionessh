import { createHash, randomBytes } from "crypto";
import type { CloudDriveFileItem } from "../../types/index.js";

const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const OAUTH_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

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

interface GoogleDriveFileRaw {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
}

function getCredentials(): GoogleOAuthCredentials {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim() ?? "";
  const redirectUri =
    process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim() ||
    `${(process.env.API_PUBLIC_URL ?? "").replace(/\/$/, "")}/public/integrations/google-drive/oauth/callback`;
  if (!clientId || !clientSecret || !redirectUri) {
    throw Object.assign(new Error("Google Drive OAuth is not configured"), {
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

async function googleFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const message = await parseGoogleError(response);
    throw Object.assign(new Error(message), {
      statusCode: response.status === 403 ? 403 : response.status === 401 ? 401 : 502,
    });
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

function toFileItem(raw: GoogleDriveFileRaw): CloudDriveFileItem | null {
  if (!raw.id || !raw.name) return null;
  const mimeType = raw.mimeType ?? "application/octet-stream";
  return {
    id: raw.id,
    name: raw.name,
    mimeType,
    isFolder: mimeType === FOLDER_MIME,
    ...(raw.size ? { size: Number(raw.size) } : {}),
    ...(raw.modifiedTime ? { modifiedAt: raw.modifiedTime } : {}),
    ...(raw.webViewLink ? { webUrl: raw.webViewLink } : {}),
    ...(raw.parents?.[0] ? { parentId: raw.parents[0] } : {}),
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
    scope: GOOGLE_DRIVE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${OAUTH_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<GoogleTokenResponse> {
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
    }),
  });
  if (!response.ok) {
    const message = await parseGoogleError(response);
    throw Object.assign(new Error(message), { statusCode: 400 });
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
    throw Object.assign(new Error(message), { statusCode: 401 });
  }
  return (await response.json()) as GoogleTokenResponse;
}

export async function revokeToken(token: string): Promise<void> {
  const response = await fetch(`${OAUTH_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!response.ok && response.status !== 400) {
    const message = await parseGoogleError(response);
    throw Object.assign(new Error(message), { statusCode: 502 });
  }
}

export async function getGoogleUserEmail(accessToken: string): Promise<string | undefined> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return undefined;
  const data = (await response.json()) as { email?: string };
  return data.email?.trim() || undefined;
}

export async function listGoogleDriveFiles(
  accessToken: string,
  options?: { folderId?: string; pageToken?: string; query?: string; pageSize?: number }
): Promise<{ files: CloudDriveFileItem[]; nextPageToken?: string }> {
  const clauses = ["trashed = false"];
  if (options?.folderId?.trim()) {
    clauses.push(`'${options.folderId.trim().replace(/'/g, "\\'")}' in parents`);
  } else if (!options?.query?.trim()) {
    clauses.push("'root' in parents");
  }
  if (options?.query?.trim()) {
    const safe = options.query.trim().replace(/'/g, "\\'");
    clauses.push(`name contains '${safe}'`);
  }

  const params = new URLSearchParams({
    q: clauses.join(" and "),
    fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,parents)",
    pageSize: String(Math.min(100, Math.max(1, options?.pageSize ?? 50))),
    orderBy: "folder,name",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  if (options?.pageToken) params.set("pageToken", options.pageToken);

  const data = await googleFetch<{ files?: GoogleDriveFileRaw[]; nextPageToken?: string }>(
    `${DRIVE_API}/files?${params.toString()}`,
    accessToken
  );

  return {
    files: (data.files ?? [])
      .map(toFileItem)
      .filter((item): item is CloudDriveFileItem => Boolean(item)),
    ...(data.nextPageToken ? { nextPageToken: data.nextPageToken } : {}),
  };
}

export async function getGoogleDriveFile(
  accessToken: string,
  fileId: string
): Promise<CloudDriveFileItem> {
  const data = await googleFetch<GoogleDriveFileRaw>(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,modifiedTime,webViewLink,parents&supportsAllDrives=true`,
    accessToken
  );
  const item = toFileItem(data);
  if (!item) {
    throw Object.assign(new Error("File not found"), { statusCode: 404 });
  }
  return item;
}

export async function createGoogleDriveFolder(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<CloudDriveFileItem> {
  const body: Record<string, unknown> = {
    name,
    mimeType: FOLDER_MIME,
  };
  if (parentId?.trim()) body.parents = [parentId.trim()];

  const data = await googleFetch<GoogleDriveFileRaw>(
    `${DRIVE_API}/files?fields=id,name,mimeType,modifiedTime,webViewLink,parents&supportsAllDrives=true`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const item = toFileItem(data);
  if (!item) {
    throw Object.assign(new Error("Failed to create folder"), { statusCode: 502 });
  }
  return item;
}

export async function uploadGoogleDriveFile(
  accessToken: string,
  params: {
    name: string;
    mimeType: string;
    contentBase64: string;
    parentId?: string;
  }
): Promise<CloudDriveFileItem> {
  const metadata: Record<string, unknown> = {
    name: params.name,
    mimeType: params.mimeType,
  };
  if (params.parentId?.trim()) metadata.parents = [params.parentId.trim()];

  const boundary = `boundary_${randomBytes(8).toString("hex")}`;
  const binary = Buffer.from(params.contentBase64, "base64");
  const preamble =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${params.mimeType}\r\n\r\n`;
  const epilogue = `\r\n--${boundary}--`;
  const body = Buffer.concat([Buffer.from(preamble, "utf8"), binary, Buffer.from(epilogue, "utf8")]);

  const response = await fetch(
    `${DRIVE_API}/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink,parents&supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body,
    }
  );
  if (!response.ok) {
    const message = await parseGoogleError(response);
    throw Object.assign(new Error(message), { statusCode: response.status === 403 ? 403 : 502 });
  }
  const data = (await response.json()) as GoogleDriveFileRaw;
  const item = toFileItem(data);
  if (!item) {
    throw Object.assign(new Error("Failed to upload file"), { statusCode: 502 });
  }
  return item;
}

export async function updateGoogleDriveFile(
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
      `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,mimeType,size,modifiedTime,webViewLink,parents&supportsAllDrives=true`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": mimeType,
          "Content-Length": String(binary.length),
        },
        body: binary,
      }
    );
    if (!response.ok) {
      const message = await parseGoogleError(response);
      throw Object.assign(new Error(message), {
        statusCode: response.status === 403 ? 403 : response.status === 404 ? 404 : 502,
      });
    }
  }

  if (params.name?.trim()) {
    await googleFetch<GoogleDriveFileRaw>(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
      accessToken,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: params.name.trim() }),
      }
    );
  }

  return getGoogleDriveFile(accessToken, fileId);
}
