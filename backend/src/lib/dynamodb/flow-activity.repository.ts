import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type {
  FlowActivitySummary,
  FlowEventSubmission,
  FlowRun,
  FlowRunSource,
} from "../../types/index.js";

export type FlowActivitySourceFilter = "all" | FlowRunSource;

export interface ListFlowActivityOptions {
  limit?: number;
  cursor?: string;
  status?: string;
  source?: FlowActivitySourceFilter;
  q?: string;
}

export interface ListFlowActivityResult {
  items: FlowActivitySummary[];
  nextCursor?: string;
}

interface FlowActivityCursorState {
  runs?: Record<string, unknown>;
  events?: Record<string, unknown>;
}

interface ActivityStreamItem {
  activity: FlowActivitySummary;
  resumeKey: Record<string, unknown>;
}

const MAX_QUERY_ROUNDS = 15;
const BATCH_SIZE = 40;

function decodeCursor(cursor?: string): FlowActivityCursorState {
  if (!cursor) return {};
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as FlowActivityCursorState;
  } catch {
    return {};
  }
}

function encodeCursor(state: FlowActivityCursorState): string | undefined {
  if (!state.runs && !state.events) return undefined;
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

function stripRun(item: Record<string, unknown>): FlowRun {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as FlowRun;
}

function stripEvent(item: Record<string, unknown>): FlowEventSubmission {
  const { PK, SK, GSI1PK, GSI1SK, ttl, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  void ttl;
  return rest as unknown as FlowEventSubmission;
}

function runResumeKey(tenantId: string, flowId: string, run: FlowRun): Record<string, unknown> {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `FLOWRUN#${run.runId}`,
    GSI1PK: `TENANT#${tenantId}#FLOW#${flowId}#RUNS`,
    GSI1SK: `CREATED#${run.createdAt}#${run.runId}`,
  };
}

function eventResumeKey(
  tenantId: string,
  flowId: string,
  event: FlowEventSubmission
): Record<string, unknown> {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `FLOWEVENT#${event.submissionId}`,
    GSI1PK: `TENANT#${tenantId}#FLOW#${flowId}#EVENTS`,
    GSI1SK: `CREATED#${event.createdAt}#${event.submissionId}`,
  };
}

function payloadPreview(payload: Record<string, unknown>): string {
  try {
    const raw = JSON.stringify(payload);
    return raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
  } catch {
    return "";
  }
}

function runToActivity(run: FlowRun): FlowActivitySummary {
  return {
    activityId: run.runId,
    kind: "run",
    flowId: run.flowId,
    status: run.status,
    source: run.source ?? "conversation",
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    runId: run.runId,
    ...(run.eventSubmissionId ? { submissionId: run.eventSubmissionId } : {}),
    ...(run.conversationId ? { conversationId: run.conversationId } : {}),
    ...(run.customerPhone ? { customerPhone: run.customerPhone } : {}),
    stepCount: run.stepCount,
    ...(run.errorMessage ? { errorMessage: run.errorMessage } : {}),
    ...(run.formPayload ? { payloadPreview: payloadPreview(run.formPayload) } : {}),
  };
}

function eventToActivity(event: FlowEventSubmission): FlowActivitySummary | null {
  if (event.runId) return null;
  return {
    activityId: event.submissionId,
    kind: "event",
    flowId: event.flowId,
    status: event.status,
    source: "webhook",
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    submissionId: event.submissionId,
    ...(event.errorMessage ? { errorMessage: event.errorMessage } : {}),
    payloadPreview: payloadPreview(event.payload),
  };
}

function matchesActivity(
  item: FlowActivitySummary,
  options: ListFlowActivityOptions
): boolean {
  if (options.status && options.status !== "all" && item.status !== options.status) {
    return false;
  }

  if (options.source && options.source !== "all") {
    if (options.source === "conversation") {
      if (item.kind !== "run" || item.source !== "conversation") return false;
    } else if (options.source === "event") {
      const isEventSource =
        item.kind === "event" || (item.kind === "run" && item.source === "event");
      if (!isEventSource) return false;
    }
  }

  if (options.q) {
    const q = options.q.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      item.activityId,
      item.runId,
      item.submissionId,
      item.conversationId,
      item.customerPhone,
      item.errorMessage,
      item.payloadPreview,
      item.status,
      item.source,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  return true;
}

async function queryRuns(
  tenantId: string,
  flowId: string,
  limit: number,
  lastKey?: Record<string, unknown>
): Promise<{ items: FlowRun[]; lastKey?: Record<string, unknown> }> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#FLOW#${flowId}#RUNS`,
      },
      ScanIndexForward: false,
      Limit: limit,
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    })
  );
  return {
    items: (result.Items ?? []).map(stripRun),
    ...(result.LastEvaluatedKey ? { lastKey: result.LastEvaluatedKey } : {}),
  };
}

async function queryEvents(
  tenantId: string,
  flowId: string,
  limit: number,
  lastKey?: Record<string, unknown>
): Promise<{ items: FlowEventSubmission[]; lastKey?: Record<string, unknown> }> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#FLOW#${flowId}#EVENTS`,
      },
      ScanIndexForward: false,
      Limit: limit,
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    })
  );
  return {
    items: (result.Items ?? []).map(stripEvent),
    ...(result.LastEvaluatedKey ? { lastKey: result.LastEvaluatedKey } : {}),
  };
}

export async function listFlowActivity(
  tenantId: string,
  flowId: string,
  options: ListFlowActivityOptions = {}
): Promise<ListFlowActivityResult> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const includeEvents = options.source !== "conversation";
  const cursorState = decodeCursor(options.cursor);

  let runItems: FlowRun[] = [];
  let eventItems: FlowEventSubmission[] = [];
  let runQueryKey = cursorState.runs;
  let eventQueryKey = cursorState.events;
  let runExhausted = false;
  let eventExhausted = !includeEvents;

  let runIndex = 0;
  let eventIndex = 0;

  const items: FlowActivitySummary[] = [];
  let nextRunsKey: Record<string, unknown> | undefined = cursorState.runs;
  let nextEventsKey: Record<string, unknown> | undefined = cursorState.events;

  let rounds = 0;

  while (items.length < limit && rounds < MAX_QUERY_ROUNDS) {
    rounds += 1;

    if (runIndex >= runItems.length && !runExhausted) {
      const page = await queryRuns(tenantId, flowId, BATCH_SIZE, runQueryKey);
      runItems = page.items;
      runIndex = 0;
      runQueryKey = page.lastKey;
      if (!page.lastKey) runExhausted = true;
    }

    if (includeEvents && eventIndex >= eventItems.length && !eventExhausted) {
      const page = await queryEvents(tenantId, flowId, BATCH_SIZE, eventQueryKey);
      eventItems = page.items;
      eventIndex = 0;
      eventQueryKey = page.lastKey;
      if (!page.lastKey) eventExhausted = true;
    }

    const run = runItems[runIndex];
    const event = eventItems[eventIndex];

    if (!run && !event) break;

    let picked: ActivityStreamItem | null = null;

    if (run && event) {
      if (run.createdAt >= event.createdAt) {
        picked = {
          activity: runToActivity(run),
          resumeKey: runResumeKey(tenantId, flowId, run),
        };
        runIndex += 1;
      } else {
        const activity = eventToActivity(event);
        if (activity) {
          picked = {
            activity,
            resumeKey: eventResumeKey(tenantId, flowId, event),
          };
        }
        eventIndex += 1;
      }
    } else if (run) {
      picked = {
        activity: runToActivity(run),
        resumeKey: runResumeKey(tenantId, flowId, run),
      };
      runIndex += 1;
    } else if (event) {
      const activity = eventToActivity(event);
      if (activity) {
        picked = {
          activity,
          resumeKey: eventResumeKey(tenantId, flowId, event),
        };
      }
      eventIndex += 1;
    }

    if (!picked) continue;

    if (picked.activity.kind === "run") {
      nextRunsKey = picked.resumeKey;
    } else {
      nextEventsKey = picked.resumeKey;
    }

    if (matchesActivity(picked.activity, options)) {
      items.push(picked.activity);
    }
  }

  const hasMore =
    items.length >= limit &&
    (!runExhausted || runIndex < runItems.length || !eventExhausted || eventIndex < eventItems.length);

  if (!hasMore) {
    return { items };
  }

  const nextState: FlowActivityCursorState = {};
  if (!runExhausted || runIndex < runItems.length) {
    if (runIndex < runItems.length) {
      nextState.runs = runResumeKey(tenantId, flowId, runItems[runIndex]);
    } else if (runQueryKey) {
      nextState.runs = runQueryKey;
    } else if (nextRunsKey) {
      nextState.runs = nextRunsKey;
    }
  }

  if (includeEvents && (!eventExhausted || eventIndex < eventItems.length)) {
    if (eventIndex < eventItems.length) {
      nextState.events = eventResumeKey(tenantId, flowId, eventItems[eventIndex]);
    } else if (eventQueryKey) {
      nextState.events = eventQueryKey;
    } else if (nextEventsKey) {
      nextState.events = nextEventsKey;
    }
  }

  return {
    items,
    ...(encodeCursor(nextState) ? { nextCursor: encodeCursor(nextState) } : {}),
  };
}
