import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import type { BotLocale } from "./types.js";

const region = process.env.AWS_REGION ?? "us-east-1";
const lambdaName = process.env.TELEPHONY_LAMBDA_NAME ?? "";

const lambdaClient = new LambdaClient({ region });

export async function fetchVoiceRuntime(params: {
  tenantId: string;
  botId: string;
  locale: BotLocale;
}): Promise<{
  instructions: string;
  tools: Array<Record<string, unknown>>;
  hasHandoff: boolean;
  knowledgeEnabled: boolean;
} | null> {
  if (!lambdaName) return null;

  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: lambdaName,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(
        JSON.stringify({
          source: "telephony-gateway",
          action: "get_voice_runtime",
          ...params,
        })
      ),
    })
  );

  if (response.FunctionError) return null;
  const raw = response.Payload ? Buffer.from(response.Payload).toString("utf8") : "{}";
  try {
    const parsed = JSON.parse(raw) as {
      runtime?: {
        instructions: string;
        tools: Array<Record<string, unknown>>;
        hasHandoff: boolean;
        knowledgeEnabled: boolean;
      } | null;
    };
    return parsed.runtime ?? null;
  } catch {
    return null;
  }
}

export async function executeTelephonyTool(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  participantId: string;
  locale: BotLocale;
  name: string;
  arguments: string;
  callId?: string;
}): Promise<{ output: string; handoff?: boolean }> {
  if (!lambdaName) {
    return { output: JSON.stringify({ error: "Tool execution is not configured" }) };
  }

  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: lambdaName,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(
        JSON.stringify({
          source: "telephony-gateway",
          action: "execute_tool",
          ...params,
        })
      ),
    })
  );

  if (response.FunctionError) {
    return { output: JSON.stringify({ error: "Tool execution failed" }) };
  }

  const raw = response.Payload ? Buffer.from(response.Payload).toString("utf8") : "{}";
  try {
    const parsed = JSON.parse(raw) as { output?: string; handoff?: boolean };
    return {
      output: parsed.output ?? JSON.stringify({ error: "Empty tool response" }),
      ...(parsed.handoff ? { handoff: true } : {}),
    };
  } catch {
    return { output: JSON.stringify({ error: "Invalid tool response" }) };
  }
}

export function parseToolExecutionResult(output: string): {
  success: boolean;
  statusCode?: number;
  error?: string;
} {
  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return { success: false, error: parsed.error.trim() };
    }
    const statusCode = typeof parsed.status === "number" ? parsed.status : undefined;
    if (parsed.ok === false || (statusCode !== undefined && statusCode >= 400)) {
      return {
        success: false,
        statusCode,
        error: typeof parsed.error === "string" ? parsed.error : undefined,
      };
    }
    return {
      success: true,
      ...(statusCode !== undefined ? { statusCode } : {}),
    };
  } catch {
    return { success: false, error: "Invalid tool response" };
  }
}

export async function reportToolExecution(params: {
  tenantId: string;
  botId: string;
  callId: string;
  toolName: string;
  latencyMs: number;
  success: boolean;
  statusCode?: number;
  error?: string;
}): Promise<void> {
  if (!lambdaName) return;

  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: lambdaName,
      InvocationType: "Event",
      Payload: Buffer.from(
        JSON.stringify({
          source: "telephony-gateway",
          action: "report_tool_execution",
          tenantId: params.tenantId,
          botId: params.botId,
          callId: params.callId,
          toolName: params.toolName,
          latencyMs: params.latencyMs,
          success: params.success,
          ...(params.statusCode !== undefined ? { statusCode: params.statusCode } : {}),
          ...(params.error ? { error: params.error } : {}),
        })
      ),
    })
  );
}

export async function reportCallUsage(params: {
  tenantId: string;
  botId: string;
  callId: string;
  usage: {
    openaiInputTokens?: number;
    openaiOutputTokens?: number;
    elevenlabsCharacters?: number;
    elevenlabsModelId?: string;
  };
}): Promise<void> {
  if (!lambdaName) return;

  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: lambdaName,
      InvocationType: "Event",
      Payload: Buffer.from(
        JSON.stringify({
          source: "telephony-gateway",
          action: "report_usage",
          ...params,
        })
      ),
    })
  );
}

export function buildRealtimeTools(params: {
  locale: BotLocale;
  knowledgeEnabled: boolean;
  calendarEnabled: boolean;
  handoffEnabled?: boolean;
}): Array<Record<string, unknown>> {
  const isEn = params.locale === "en";
  const handoffEnabled = params.handoffEnabled === true;
  const tools: Array<Record<string, unknown>> = [];

  if (handoffEnabled) {
    tools.push({
      type: "function",
      name: "transfer_to_human",
      description: isEn
        ? "Transfer the call to a human advisor"
        : "Transfiere la llamada a un asesor humano",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: isEn ? "Reason for transfer" : "Motivo de la transferencia",
          },
        },
        required: ["reason"],
      },
    });
  }

  if (params.knowledgeEnabled) {
    tools.push({
      type: "function",
      name: "search_knowledge",
      description: isEn
        ? "Search the business knowledge base for relevant information"
        : "Busca en la base de conocimiento del negocio información relevante",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: isEn ? "Search query" : "Consulta de búsqueda",
          },
        },
        required: ["query"],
      },
    });
  }

  if (params.calendarEnabled) {
    tools.push(
      {
        type: "function",
        name: "list_available_slots",
        description: isEn
          ? "List available time slots for a date in YYYY-MM-DD"
          : "Lista horarios disponibles para una fecha en YYYY-MM-DD",
        parameters: {
          type: "object",
          properties: {
            date: { type: "string", description: "YYYY-MM-DD" },
          },
          required: ["date"],
        },
      },
      {
        type: "function",
        name: "create_booking",
        description: isEn
          ? "Create a booking at an available slot"
          : "Crea una reserva en un horario disponible",
        parameters: {
          type: "object",
          properties: {
            startAt: { type: "string" },
            contactName: { type: "string" },
          },
          required: ["startAt"],
        },
      },
      {
        type: "function",
        name: "cancel_booking",
        description: isEn ? "Cancel an existing booking" : "Cancela una reserva existente",
        parameters: {
          type: "object",
          properties: {
            bookingId: { type: "string" },
          },
          required: ["bookingId"],
        },
      }
    );
  }

  return tools;
}
