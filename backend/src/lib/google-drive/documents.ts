const DOCS_API = "https://docs.googleapis.com/v1";
const SHEETS_API = "https://sheets.googleapis.com/v4";

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
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const message = await parseGoogleError(response);
    throw Object.assign(new Error(message), {
      statusCode: response.status === 403 ? 403 : response.status === 404 ? 404 : 502,
    });
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export async function appendTextToGoogleDoc(
  accessToken: string,
  documentId: string,
  text: string
): Promise<void> {
  const content = text.endsWith("\n") ? text : `${text}\n`;
  await googleFetch(`${DOCS_API}/documents/${encodeURIComponent(documentId)}:batchUpdate`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            endOfSegmentLocation: { segmentId: "" },
            text: content,
          },
        },
      ],
    }),
  });
}

export function parseSpreadsheetValues(raw: string): string[][] {
  const trimmed = raw.trim();
  if (!trimmed) return [[""]];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        if (parsed.every((row) => Array.isArray(row))) {
          return parsed.map((row) =>
            (row as unknown[]).map((cell) => (cell == null ? "" : String(cell)))
          );
        }
        return [parsed.map((cell) => (cell == null ? "" : String(cell)))];
      }
    } catch {
      // fall through to CSV-like parsing
    }
  }
  const cells = trimmed
    .split(",")
    .map((cell) => cell.trim())
    .filter((cell, _index, arr) => !(arr.length === 1 && arr[0] === "" && !cell));
  return [cells.length ? cells : [trimmed]];
}

export async function appendRowsToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  values: string[][],
  sheetName = "Sheet1"
): Promise<void> {
  const range = `${sheetName}!A1`;
  await googleFetch(
    `${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({ values }),
    }
  );
}
