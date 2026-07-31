import {
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { Macro } from "../../types/index.js";

const macroKeys = (tenantId: string, botId: string, macroId: string) => ({
  PK: `TENANT#${tenantId}#BOT#${botId}`,
  SK: `MACRO#${macroId}`,
});

function stripMacro(item: Record<string, unknown>): Macro {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as Macro;
}

function sortMacros(macros: Macro[]): Macro[] {
  return [...macros].sort((a, b) => {
    const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.title.localeCompare(b.title);
  });
}

export async function listMacros(tenantId: string, botId: string): Promise<Macro[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#BOT#${botId}`,
        ":sk": "MACRO#",
      },
    })
  );

  return sortMacros((result.Items ?? []).map(stripMacro));
}

export async function getMacro(
  tenantId: string,
  botId: string,
  macroId: string
): Promise<Macro | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: macroKeys(tenantId, botId, macroId),
    })
  );

  if (!result.Item) return null;
  return stripMacro(result.Item);
}

export async function getMacroByShortcut(
  tenantId: string,
  botId: string,
  shortcut: string
): Promise<Macro | null> {
  const macros = await listMacros(tenantId, botId);
  const normalized = shortcut.toLowerCase();
  return macros.find((m) => m.shortcut?.toLowerCase() === normalized) ?? null;
}

export async function createMacro(macro: Macro): Promise<Macro> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...macroKeys(macro.tenantId, macro.botId, macro.macroId),
        ...macro,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );

  return macro;
}

export async function updateMacro(
  tenantId: string,
  botId: string,
  macroId: string,
  updates: Partial<Pick<Macro, "title" | "content" | "sortOrder">> & {
    shortcut?: string | null;
  }
): Promise<Macro | null> {
  const existing = await getMacro(tenantId, botId, macroId);
  if (!existing) return null;

  const { shortcut, ...restUpdates } = updates;
  const merged: Macro = {
    ...existing,
    ...restUpdates,
    updatedAt: new Date().toISOString(),
  };

  if (shortcut === null) {
    delete merged.shortcut;
  } else if (shortcut !== undefined) {
    merged.shortcut = shortcut;
  }

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...macroKeys(tenantId, botId, macroId),
        ...merged,
      },
    })
  );

  return merged;
}

export async function deleteMacro(
  tenantId: string,
  botId: string,
  macroId: string
): Promise<boolean> {
  const existing = await getMacro(tenantId, botId, macroId);
  if (!existing) return false;

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: macroKeys(tenantId, botId, macroId),
    })
  );

  return true;
}
