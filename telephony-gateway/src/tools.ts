import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import type { BotLocale } from "./types.js";

const region = process.env.AWS_REGION ?? "us-east-1";
const lambdaName = process.env.TELEPHONY_LAMBDA_NAME ?? "";

const lambdaClient = new LambdaClient({ region });

export async function executeTelephonyTool(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  participantId: string;
  locale: BotLocale;
  name: string;
  arguments: string;
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

export async function reportCallUsage(params: {
  tenantId: string;
  botId: string;
  callId: string;
  usage: {
    openaiInputTokens?: number;
    openaiOutputTokens?: number;
    elevenlabsCharacters?: number;
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
}): Array<Record<string, unknown>> {
  const isEn = params.locale === "en";
  const tools: Array<Record<string, unknown>> = [
    {
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
    },
  ];

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
