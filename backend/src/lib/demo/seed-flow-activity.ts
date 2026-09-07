import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, TABLE_NAME } from "../dynamodb/client.js";
import {
  demoConversationId,
  demoPhone,
  demoUuid,
  DEMO_BOT_SUPPORT_ID,
  DEMO_BOT_WA_ID,
  DEMO_FLOW_IDS,
  DEMO_TENANT_ID,
} from "./constants.js";
import { demoPersonName, minutesAgo } from "./seed-data.js";
import type {
  FlowEventSubmission,
  FlowEventStatus,
  FlowRun,
  FlowRunStatus,
  FlowRunStep,
} from "../../types/index.js";

const DEMO_FLOW_RUN_SEQ = 0xc50;
const DEMO_FLOW_EVENT_SEQ = 0xcc0;

function demoFlowRunId(index: number): string {
  return demoUuid(DEMO_FLOW_RUN_SEQ + index);
}

function demoFlowEventId(index: number): string {
  return demoUuid(DEMO_FLOW_EVENT_SEQ + index);
}

function runKeys(tenantId: string, runId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `FLOWRUN#${runId}`,
  };
}

function runGsi1ByFlow(tenantId: string, flowId: string, createdAt: string, runId: string) {
  return {
    GSI1PK: `TENANT#${tenantId}#FLOW#${flowId}#RUNS`,
    GSI1SK: `CREATED#${createdAt}#${runId}`,
  };
}

function eventKeys(tenantId: string, submissionId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `FLOWEVENT#${submissionId}`,
  };
}

function eventGsi1(
  tenantId: string,
  flowId: string,
  createdAt: string,
  submissionId: string
) {
  return {
    GSI1PK: `TENANT#${tenantId}#FLOW#${flowId}#EVENTS`,
    GSI1SK: `CREATED#${createdAt}#${submissionId}`,
  };
}

async function putFlowEventForActivity(submission: FlowEventSubmission): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...eventKeys(submission.tenantId, submission.submissionId),
        ...eventGsi1(
          submission.tenantId,
          submission.flowId,
          submission.createdAt,
          submission.submissionId
        ),
        ...submission,
      },
    })
  );
}

function buildStepHistory(status: FlowRunStatus): FlowRunStep[] {
  const base = minutesAgo(0, 45);
  const steps: FlowRunStep[] = [
    { nodeId: "trigger-1", at: base, output: "trigger matched" },
    { nodeId: "message-welcome", at: minutesAgo(0, 44), output: "message sent" },
  ];
  if (status === "failed") {
    steps.push({
      nodeId: "http-request-1",
      at: minutesAgo(0, 43),
      error: "HTTP 502 Bad Gateway",
    });
    return steps;
  }
  steps.push(
    { nodeId: "buttons-menu", at: minutesAgo(0, 43), output: "menu displayed" },
    { nodeId: "end-flow", at: minutesAgo(0, 42), output: "flow completed" }
  );
  return steps;
}

async function putFlowRunForActivity(run: FlowRun): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...runKeys(run.tenantId, run.runId),
        ...runGsi1ByFlow(run.tenantId, run.flowId, run.createdAt, run.runId),
        ...run,
      },
    })
  );
}

export async function seedFlowActivityForFlow(
  tenantId: string,
  flowId: string,
  botId?: string,
  options: { randomizeIds?: boolean } = {}
): Promise<number> {
  const runStatuses: FlowRunStatus[] = ["completed", "failed", "active", "waiting"];
  let created = 0;
  const randomizeIds = options.randomizeIds ?? false;

  for (let index = 0; index < 16; index += 1) {
    const createdAt = minutesAgo(0, index * 17 + 5);
    const updatedAt = minutesAgo(0, index * 17);
    const status = runStatuses[index % runStatuses.length]!;
    const source = index % 3 === 0 ? "conversation" : "event";
    const stepHistory = buildStepHistory(status);
    const runId = randomizeIds ? randomUUID() : demoFlowRunId(index);
    const submissionId =
      source === "event" ? (randomizeIds ? randomUUID() : demoFlowEventId(index)) : undefined;
    const customerPhone = demoPhone(index);
    const conversationId =
      source === "conversation" ? demoConversationId(index % 8) : undefined;

    const run: FlowRun = {
      runId,
      flowId,
      tenantId,
      ...(botId ? { botId } : {}),
      source,
      status,
      currentNodeId: status === "failed" ? "http-request-1" : "end-flow",
      variables: {
        customerName: demoPersonName(index),
        ...(source === "event" ? { formEmail: `cliente${index + 1}@example.com` } : {}),
      },
      stepHistory,
      stepCount: stepHistory.length,
      createdAt,
      updatedAt,
      ...(conversationId ? { conversationId } : {}),
      ...(customerPhone ? { customerPhone } : {}),
      ...(submissionId ? { eventSubmissionId: submissionId } : {}),
      ...(source === "event"
        ? {
            formPayload: {
              email: `cliente${index + 1}@example.com`,
              name: demoPersonName(index),
              product: index % 2 === 0 ? "Plan Pro" : "Plan Starter",
            },
          }
        : {}),
      ...(status === "failed"
        ? { errorMessage: "HTTP 502 Bad Gateway al llamar CRM externo" }
        : {}),
      ...(status === "waiting"
        ? { waitingUntil: minutesAgo(0, -30) }
        : {}),
    };

    await putFlowRunForActivity(run);
    created += 1;

    if (source === "event" && submissionId && status !== "active" && status !== "waiting") {
      const submission: FlowEventSubmission = {
        submissionId,
        tenantId,
        flowId,
        hookKey: `demo-hook-${flowId.slice(0, 8)}`,
        payload: run.formPayload ?? { email: `cliente${index + 1}@example.com` },
        status: status === "failed" ? "failed" : "completed",
        runId: run.runId,
        createdAt,
        updatedAt,
      };
      await putFlowEventForActivity(submission);
      created += 1;
    }
  }

  const orphanStatuses: FlowEventStatus[] = ["accepted", "processing", "failed", "accepted"];
  for (let index = 0; index < orphanStatuses.length; index += 1) {
    const createdAt = minutesAgo(0, index * 5 + 2);
    const status = orphanStatuses[index]!;
    await putFlowEventForActivity({
      submissionId: randomizeIds ? randomUUID() : demoFlowEventId(100 + index),
      tenantId,
      flowId,
      hookKey: `demo-hook-${flowId.slice(0, 8)}`,
      idempotencyKey: randomUUID(),
      payload: {
        email: `pendiente${index + 1}@example.com`,
        name: demoPersonName(index + 30),
        note: "Webhook demo sin ejecución vinculada",
      },
      status,
      ...(status === "failed"
        ? { errorMessage: "Payload inválido: falta campo phone" }
        : {}),
      createdAt,
      updatedAt: createdAt,
    });
    created += 1;
  }

  return created;
}

export async function seedDemoFlowActivity(): Promise<number> {
  const botByFlow: Record<string, string> = {
    [DEMO_FLOW_IDS[0]]: DEMO_BOT_WA_ID,
    [DEMO_FLOW_IDS[1]]: DEMO_BOT_SUPPORT_ID,
    [DEMO_FLOW_IDS[2]]: DEMO_BOT_WA_ID,
  };

  let total = 0;
  for (const flowId of DEMO_FLOW_IDS) {
    total += await seedFlowActivityForFlow(DEMO_TENANT_ID, flowId, botByFlow[flowId]);
  }
  return total;
}
