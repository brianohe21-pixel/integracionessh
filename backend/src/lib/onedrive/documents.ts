const GRAPH_API = "https://graph.microsoft.com/v1.0";

async function parseGraphError(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const json = JSON.parse(body) as {
      error?: string | { message?: string };
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
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const message = await parseGraphError(response);
    throw Object.assign(new Error(message), {
      statusCode: response.status === 403 ? 403 : response.status === 404 ? 404 : 502,
    });
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
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
      // fall through
    }
  }
  const cells = trimmed.split(",").map((cell) => cell.trim());
  return [cells.length ? cells : [trimmed]];
}

export async function appendRowsToOneDriveExcel(
  accessToken: string,
  fileId: string,
  values: string[][],
  sheetName = "Sheet1"
): Promise<void> {
  const session = await graphFetch<{ id?: string }>(
    `${GRAPH_API}/me/drive/items/${encodeURIComponent(fileId)}/workbook/createSession`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({ persistChanges: true }),
    }
  );
  const sessionId = session.id;
  const sessionHeaders = sessionId ? { "workbook-session-id": sessionId } : {};

  try {
    const usedRange = await graphFetch<{
      address?: string;
      rowCount?: number;
      columnCount?: number;
    }>(
      `${GRAPH_API}/me/drive/items/${encodeURIComponent(fileId)}/workbook/worksheets('${encodeURIComponent(sheetName)}')/usedRange?$select=address,rowCount,columnCount`,
      accessToken,
      { headers: sessionHeaders }
    );

    const startRow = Math.max(1, (usedRange.rowCount ?? 0) + 1);
    const columnCount = Math.max(
      1,
      usedRange.columnCount ?? 0,
      ...values.map((row) => row.length)
    );
    const endCol = columnIndexToLetter(columnCount - 1);
    const endRow = startRow + values.length - 1;
    const address = `A${startRow}:${endCol}${endRow}`;
    const normalized = values.map((row) => {
      const next = [...row];
      while (next.length < columnCount) next.push("");
      return next.slice(0, columnCount);
    });

    await graphFetch(
      `${GRAPH_API}/me/drive/items/${encodeURIComponent(fileId)}/workbook/worksheets('${encodeURIComponent(sheetName)}')/range(address='${address}')`,
      accessToken,
      {
        method: "PATCH",
        headers: sessionHeaders,
        body: JSON.stringify({ values: normalized }),
      }
    );
  } finally {
    if (sessionId) {
      try {
        await graphFetch(
          `${GRAPH_API}/me/drive/items/${encodeURIComponent(fileId)}/workbook/closeSession`,
          accessToken,
          { method: "POST", headers: sessionHeaders, body: "{}" }
        );
      } catch {
        // ignore close failures
      }
    }
  }
}

function columnIndexToLetter(index: number): string {
  let n = index;
  let result = "";
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

export async function appendTextToOneDriveDocument(
  accessToken: string,
  fileId: string,
  text: string,
  mimeType?: string
): Promise<void> {
  const meta = await graphFetch<{
    name?: string;
    file?: { mimeType?: string };
  }>(`${GRAPH_API}/me/drive/items/${encodeURIComponent(fileId)}?$select=name,file`, accessToken);

  const resolvedMime = mimeType ?? meta.file?.mimeType ?? "text/plain";
  const isText =
    resolvedMime.startsWith("text/") ||
    resolvedMime === "application/json" ||
    /\.(txt|md|csv|log)$/i.test(meta.name ?? "");

  if (!isText) {
    throw Object.assign(
      new Error(
        "OneDrive document append supports text files (.txt, .md, .csv). For Word .docx use Google Docs, or convert the file to .txt."
      ),
      { statusCode: 400 }
    );
  }

  const response = await fetch(
    `${GRAPH_API}/me/drive/items/${encodeURIComponent(fileId)}/content`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok && response.status !== 404) {
    const message = await parseGraphError(response);
    throw Object.assign(new Error(message), { statusCode: 502 });
  }
  const existing = response.ok ? await response.text() : "";
  const content = text.endsWith("\n") ? text : `${text}\n`;
  const next = existing
    ? `${existing}${existing.endsWith("\n") ? "" : "\n"}${content}`
    : content;

  const put = await fetch(`${GRAPH_API}/me/drive/items/${encodeURIComponent(fileId)}/content`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": resolvedMime.startsWith("text/") ? resolvedMime : "text/plain",
    },
    body: next,
  });
  if (!put.ok) {
    const message = await parseGraphError(put);
    throw Object.assign(new Error(message), { statusCode: 502 });
  }
}
