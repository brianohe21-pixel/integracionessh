import { randomUUID } from "crypto";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { conversationLookupGsi1pk } from "../src/lib/channels/keys.js";
import { docClient, TABLE_NAME } from "../src/lib/dynamodb/client.js";
import { addMessageIdempotent } from "../src/lib/dynamodb/conversation.repository.js";
import {
  DEMO_BOT_WA_ID,
  DEMO_TENANT_ID,
  demoAdvisorId,
} from "../src/lib/demo/constants.js";
import type { Conversation, Message } from "../src/types/index.js";

async function main(): Promise<void> {
  const now = new Date();
  const conversationId = randomUUID();
  const phone = process.env.FAKE_PHONE?.trim() || "573009998877";
  const contactName = process.env.FAKE_CONTACT_NAME?.trim() || "Cliente Prueba Tareas";
  const tenantId = process.env.FAKE_TENANT_ID?.trim() || DEMO_TENANT_ID;
  const botId = process.env.FAKE_BOT_ID?.trim() || DEMO_BOT_WA_ID;
  const advisorId = process.env.FAKE_ADVISOR_ID?.trim() || demoAdvisorId(0);
  const createdAt = now.toISOString();

  const conversation: Conversation = {
    conversationId,
    tenantId,
    botId,
    channel: "whatsapp",
    participantId: phone,
    phoneNumber: phone,
    contactName,
    status: "active",
    handoffMode: "human",
    assignedAdvisorId: advisorId,
    handoffAt: createdAt,
    workflowStatus: "open",
    messageCount: 3,
    lastMessageAt: createdAt,
    createdAt,
    detectedIntent: "seguimiento",
  };

  const gsi1pk = conversationLookupGsi1pk(tenantId, botId, "whatsapp", phone);

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `TENANT#${tenantId}#BOT#${botId}`,
        SK: `CONV#${conversationId}`,
        GSI1PK: gsi1pk,
        GSI1SK: `CONV#${createdAt}`,
        ...conversation,
      },
    })
  );

  const messages: Array<{ role: Message["role"]; content: string; minutesAgo: number }> = [
    {
      role: "user",
      content: "Hola, quiero seguimiento de mi cotización.",
      minutesAgo: 12,
    },
    {
      role: "assistant",
      content: "Claro, te paso con un asesor.",
      minutesAgo: 10,
    },
    {
      role: "advisor",
      content: "Hola. ¿Te creo una tarea de seguimiento para mañana?",
      minutesAgo: 2,
    },
  ];

  for (const item of messages) {
    const timestamp = new Date(now.getTime() - item.minutesAgo * 60_000).toISOString();
    await addMessageIdempotent(
      {
        messageId: randomUUID(),
        conversationId,
        tenantId,
        role: item.role,
        content: item.content,
        channel: "whatsapp",
        timestamp,
      },
      botId,
      {
        updateCounters: false,
        updateLastMessageAt: false,
        publishRealtime: false,
      }
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        tenantId,
        botId,
        conversationId,
        contactName,
        phone,
        assignedAdvisorId: advisorId,
        inboxHint: "Abre /conversations o /inbox y busca Cliente Prueba Tareas",
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
