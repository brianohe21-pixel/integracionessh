import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { buildBindingContext, conversationBindingFromContext, resolveBindingValue } from "../binding.js";
import { getNextNodeId } from "../graph.js";
import { getGoogleDriveConfig } from "../../dynamodb/google-drive.repository.js";
import { getOneDriveConfig } from "../../dynamodb/onedrive.repository.js";
import { resolveGoogleDriveAccessToken } from "../../google-drive/token.js";
import {
  appendRowsToGoogleSheet,
  appendTextToGoogleDoc,
  parseSpreadsheetValues as parseGoogleSheetValues,
} from "../../google-drive/documents.js";
import { resolveOneDriveAccessToken } from "../../onedrive/token.js";
import {
  appendRowsToOneDriveExcel,
  appendTextToOneDriveDocument,
  parseSpreadsheetValues as parseOneDriveSheetValues,
} from "../../onedrive/documents.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

function resolveContent(
  template: string | undefined,
  bindingContext: Record<string, unknown>,
  variables: Record<string, string>
): string {
  let content = template ?? "";
  for (const [key, val] of Object.entries(variables)) {
    content = content.replaceAll(`{{${key}}}`, val);
  }
  return resolveBindingValue(content, bindingContext);
}

export async function executeCloudDriveWriteNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  run: FlowRun
): Promise<NodeExecutionResult> {
  const provider = node.data.cloudDriveProvider;
  const targetType = node.data.cloudDriveTargetType;
  const fileIdTemplate = node.data.cloudDriveFileId?.trim() ?? "";
  const contentTemplate = node.data.cloudDriveContent ?? "";

  if (!provider || (provider !== "google-drive" && provider !== "onedrive")) {
    throw new Error("cloudDriveProvider must be google-drive or onedrive");
  }
  if (!targetType || (targetType !== "document" && targetType !== "spreadsheet")) {
    throw new Error("cloudDriveTargetType must be document or spreadsheet");
  }
  if (!fileIdTemplate) {
    throw new Error("cloudDriveFileId is required");
  }
  if (!contentTemplate.trim()) {
    throw new Error("cloudDriveContent is required");
  }

  const bindingContext = buildBindingContext({
    formPayload: ctx.formPayload,
    variables: run.variables,
    conversation: conversationBindingFromContext(ctx),
  });
  const fileId = resolveBindingValue(fileIdTemplate, bindingContext);
  if (!fileId) {
    throw new Error("Resolved cloudDriveFileId is empty");
  }
  const content = resolveContent(contentTemplate, bindingContext, run.variables);
  if (!content.trim()) {
    throw new Error("Resolved cloudDriveContent is empty");
  }

  const sheetName =
    resolveBindingValue(node.data.cloudDriveSheetName, bindingContext).trim() || "Sheet1";

  if (provider === "google-drive") {
    const config = await getGoogleDriveConfig(ctx.tenantId);
    if (!config || config.status !== "connected" || !config.enabled) {
      throw new Error("Connect and enable Google Drive in Apps before using this node");
    }
    const accessToken = await resolveGoogleDriveAccessToken(ctx.tenantId, ENVIRONMENT);

    if (targetType === "document") {
      await appendTextToGoogleDoc(accessToken, fileId, content);
    } else {
      await appendRowsToGoogleSheet(
        accessToken,
        fileId,
        parseGoogleSheetValues(content),
        sheetName
      );
    }
  } else {
    const config = await getOneDriveConfig(ctx.tenantId);
    if (!config || config.status !== "connected" || !config.enabled) {
      throw new Error("Connect and enable OneDrive in Apps before using this node");
    }
    const accessToken = await resolveOneDriveAccessToken(ctx.tenantId, ENVIRONMENT);

    if (targetType === "document") {
      await appendTextToOneDriveDocument(accessToken, fileId, content);
    } else {
      await appendRowsToOneDriveExcel(
        accessToken,
        fileId,
        parseOneDriveSheetValues(content),
        sheetName
      );
    }
  }

  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    variables: {
      cloud_drive_file_id: fileId,
      cloud_drive_provider: provider,
      cloud_drive_target_type: targetType,
    },
    output: `${provider}:${targetType}:${fileId}`,
  };
}
