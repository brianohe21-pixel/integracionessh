import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { docClient, TABLE_NAME } from "../dynamodb/client.js";
import { getTenant, createTenant, updateTenant } from "../dynamodb/tenant.repository.js";
import { getBot, createBot, updateBot } from "../dynamodb/bot.repository.js";
import { createFlowDefinition } from "../dynamodb/flow.repository.js";
import { addMessageIdempotent } from "../dynamodb/conversation.repository.js";
import { upsertFromConversation } from "../dynamodb/contact.repository.js";
import { upsertCallRecord } from "../dynamodb/call.repository.js";
import { createPipeline } from "../dynamodb/pipeline.repository.js";
import { createOpportunity } from "../dynamodb/opportunity.repository.js";
import { createLead } from "../dynamodb/lead.repository.js";
import { createCampaign } from "../dynamodb/campaign.repository.js";
import { createBulkJob } from "../dynamodb/bulk-job.repository.js";
import { putMember } from "../dynamodb/member.repository.js";
import { createAutomation } from "../dynamodb/automation.repository.js";
import { createSalesTask } from "../dynamodb/sales-task.repository.js";
import { upsertCachedTemplate } from "../dynamodb/template.repository.js";
import { currentUsagePeriod } from "../dynamodb/usage.repository.js";
import { conversationLookupGsi1pk } from "../channels/keys.js";
import {
  DEMO_BOT_SUPPORT_ID,
  DEMO_BOT_VOICE_ID,
  DEMO_BOT_WA_ID,
  DEMO_FLOW_ID,
  DEMO_FLOW_ONBOARDING_ID,
  DEMO_FLOW_SUPPORT_ID,
  DEMO_PIPELINE_ID,
  DEMO_SEED_COUNTS,
  DEMO_STAGE_LOST_ID,
  DEMO_STAGE_NEGOTIATION_ID,
  DEMO_STAGE_NEW_ID,
  DEMO_STAGE_QUOTED_ID,
  DEMO_STAGE_WON_ID,
  DEMO_TENANT_ID,
  DEMO_TENANT_NAME,
  demoAdvisorId,
  demoAutomationId,
  demoBulkJobId,
  demoCallId,
  demoCampaignId,
  demoConversationId,
  demoLeadId,
  demoMacroId,
  demoOpportunityId,
  demoPaymentId,
  demoPhone,
  demoSalesTaskId,
  demoUuid,
} from "./constants.js";
import {
  daysAgo,
  demoAdvisorMessage,
  demoAssistantMessage,
  demoAutomationName,
  demoBulkTemplate,
  demoCampaignName,
  demoContactTags,
  demoMacroTitle,
  demoOpportunityTitle,
  demoPersonName,
  demoSalesTaskTitle,
  demoUserMessage,
  hoursAgo,
  minutesAgo,
} from "./seed-data.js";
import type {
  Advisor,
  Bot,
  BulkSendJob,
  CallRecord,
  Campaign,
  CampaignStatus,
  Contact,
  Conversation,
  FlowDefinition,
  LeadStatus,
  Message,
  OpportunityStage,
  SalesPipeline,
  Tenant,
  TenantMember,
  WhatsAppTemplate,
} from "../../types/index.js";

async function putConversation(conversation: Conversation): Promise<void> {
  const gsi1pk = conversationLookupGsi1pk(
    conversation.tenantId,
    conversation.botId,
    conversation.channel,
    conversation.participantId
  );

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `TENANT#${conversation.tenantId}#BOT#${conversation.botId}`,
        SK: `CONV#${conversation.conversationId}`,
        GSI1PK: gsi1pk,
        GSI1SK: `CONV#${conversation.lastMessageAt}`,
        ...conversation,
      },
    })
  );
}

async function ensureBot(bot: Bot): Promise<void> {
  const existing = await getBot(bot.tenantId, bot.botId);
  if (!existing) {
    try {
      await createBot(bot);
      return;
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException)) {
        throw error;
      }
    }
  }
  await updateBot(bot.tenantId, bot.botId, bot);
}

export async function seedTenantRecord(now: string, email: string): Promise<void> {
  const tenant: Tenant = {
    tenantId: DEMO_TENANT_ID,
    name: DEMO_TENANT_NAME,
    email,
    plan: "enterprise",
    tenantKind: "standard",
    status: "active",
    subscriptionStatus: "active",
    branding: {
      brandName: DEMO_TENANT_NAME,
      primaryColor: "#2563eb",
    },
    inboxSla: {
      enabled: true,
      firstResponseMinutes: 15,
    },
    onboardingCompletedAt: now,
    onboardingSkippedAt: now,
    onboardingTestConfirmedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const existing = await getTenant(DEMO_TENANT_ID);
  if (!existing) {
    await createTenant(tenant);
    return;
  }

  const { tenantId: _tenantId, createdAt: _createdAt, ...updates } = tenant;
  await updateTenant(DEMO_TENANT_ID, updates);
}

function buildFlow(
  flowId: string,
  name: string,
  botId: string,
  now: string,
  triggerLabel: string
): FlowDefinition {
  return {
    flowId,
    tenantId: DEMO_TENANT_ID,
    botId,
    name,
    flowKind: "messaging",
    enabled: true,
    version: 1,
    entryNodeId: "trigger-1",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: { label: triggerLabel, triggerType: "first_message" },
      },
      {
        id: "message-welcome",
        type: "message",
        position: { x: 280, y: 0 },
        data: {
          label: "Bienvenida",
          messageText: {
            es: `¡Hola! Bienvenido a ${name}.`,
            en: `Hello! Welcome to ${name}.`,
          },
        },
      },
      {
        id: "buttons-menu",
        type: "buttons",
        position: { x: 560, y: 0 },
        data: {
          label: "Menú",
          messageText: { es: "Elige una opción:", en: "Choose an option:" },
          buttons: [
            { id: "catalog", title: { es: "Ver catálogo", en: "View catalog" } },
            { id: "agent", title: { es: "Hablar con asesor", en: "Talk to advisor" } },
          ],
        },
      },
      {
        id: "handoff-agent",
        type: "handoff",
        position: { x: 840, y: 120 },
        data: { label: "Asesor humano" },
      },
      {
        id: "end-flow",
        type: "end",
        position: { x: 1120, y: 0 },
        data: { label: "Fin" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "message-welcome" },
      { id: "e2", source: "message-welcome", target: "buttons-menu" },
      { id: "e3", source: "buttons-menu", target: "handoff-agent", sourceHandle: "agent" },
      { id: "e4", source: "buttons-menu", target: "end-flow", sourceHandle: "catalog" },
    ],
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export async function seedBots(now: string): Promise<void> {
  const bots: Bot[] = [
    {
      botId: DEMO_BOT_WA_ID,
      tenantId: DEMO_TENANT_ID,
      name: "Asistente NovaRetail",
      defaultLocale: "es",
      responseMode: "openai",
      systemPrompt:
        "Eres el asistente virtual de NovaRetail, una tienda online. Ayudas con catálogo, ofertas y estado de pedidos.",
      phoneNumberId: "demo-phone-wa-001",
      whatsappBusinessAccountId: "demo-waba-001",
      webchatEnabled: true,
      webchatWidgetKey: "demo-widget-key-nova-retail",
      telephonyEnabled: false,
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      botId: DEMO_BOT_VOICE_ID,
      tenantId: DEMO_TENANT_ID,
      name: "Agente de voz NovaRetail",
      defaultLocale: "es",
      responseMode: "openai",
      systemPrompt:
        "Eres un agente de voz para NovaRetail. Atiendes consultas de productos, pedidos y soporte con tono profesional.",
      phoneNumberId: "demo-phone-voice-001",
      whatsappBusinessAccountId: "demo-waba-voice-001",
      telephonyEnabled: true,
      telephonyPhoneNumber: "+573001112200",
      telephonyGreeting: "Hola, gracias por llamar a NovaRetail. ¿En qué puedo ayudarte?",
      telephonySystemPrompt:
        "Atiende llamadas de clientes de NovaRetail. Responde de forma breve y ofrece transferir a un asesor si es necesario.",
      telephonyVoiceFlowId: DEMO_FLOW_ID,
      voicebotEnabled: true,
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      botId: DEMO_BOT_SUPPORT_ID,
      tenantId: DEMO_TENANT_ID,
      name: "Soporte NovaRetail",
      defaultLocale: "es",
      responseMode: "openai",
      systemPrompt:
        "Eres el bot de soporte de NovaRetail. Resuelves incidencias, devoluciones y seguimiento de pedidos.",
      phoneNumberId: "demo-phone-support-001",
      whatsappBusinessAccountId: "demo-waba-support-001",
      webchatEnabled: true,
      webchatWidgetKey: "demo-widget-key-nova-support",
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const bot of bots) {
    await ensureBot(bot);
  }
}

export async function seedFlows(now: string): Promise<void> {
  const flows = [
    buildFlow(DEMO_FLOW_ID, "Ventas y pedidos", DEMO_BOT_WA_ID, now, "Inicio ventas"),
    buildFlow(DEMO_FLOW_SUPPORT_ID, "Soporte postventa", DEMO_BOT_SUPPORT_ID, now, "Inicio soporte"),
    buildFlow(DEMO_FLOW_ONBOARDING_ID, "Onboarding clientes", DEMO_BOT_WA_ID, now, "Inicio onboarding"),
  ];

  for (const flow of flows) {
    await createFlowDefinition(flow);
  }
}

export async function seedContacts(_now: string): Promise<void> {
  for (let index = 0; index < DEMO_SEED_COUNTS.contacts; index += 1) {
    const phone = demoPhone(index);
    const name = demoPersonName(index);
    const updatedAt = daysAgo(index % 28);
    const contact: Contact = {
      phoneNumber: phone,
      tenantId: DEMO_TENANT_ID,
      displayName: name,
      email: `cliente${index + 1}@example.com`,
      tags: demoContactTags(index),
      marketingConsent: index % 3 === 0 ? "opt_in" : index % 3 === 1 ? "opt_out" : "unknown",
      suppressed: index % 17 === 0,
      firstSeenAt: daysAgo(25 + (index % 5)),
      lastSeenAt: updatedAt,
      lastBotId: index % 3 === 0 ? DEMO_BOT_SUPPORT_ID : DEMO_BOT_WA_ID,
      messageCount: 3 + (index % 12),
      source: index % 4 === 0 ? "import" : "manual",
      csatAverage: 3.5 + (index % 3) * 0.5,
      csatRatingCount: 1 + (index % 4),
      createdAt: daysAgo(25 + (index % 5)),
      updatedAt,
      ...(index % 3 === 0
        ? { consentAt: updatedAt, consentSource: "manual" as const }
        : {}),
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `TENANT#${DEMO_TENANT_ID}`,
          SK: `CONTACT#${phone}`,
          GSI1PK: `TENANT#${DEMO_TENANT_ID}#CONTACTS`,
          GSI1SK: `UPDATED#${contact.updatedAt}#CONTACT#${phone}`,
          ...contact,
        },
      })
    );
  }
}

export async function seedConversations(_now: string): Promise<void> {
  const handoffModes = ["bot", "human"] as const;
  const workflowStatuses = ["open", "resolved"] as const;
  const channels = ["whatsapp", "whatsapp", "whatsapp", "webchat"] as const;

  for (let index = 0; index < DEMO_SEED_COUNTS.conversations; index += 1) {
    const conversationId = demoConversationId(index);
    const phone = demoPhone(index);
    const name = demoPersonName(index);
    const channel = channels[index % channels.length]!;
    const botId = index % 5 === 0 ? DEMO_BOT_SUPPORT_ID : DEMO_BOT_WA_ID;
    const participantId = channel === "webchat" ? `webchat-${index}` : phone;
    const handoff = handoffModes[index % handoffModes.length]!;
    const workflow = workflowStatuses[index % workflowStatuses.length]!;
    const lastMessageAt = minutesAgo(index % 20, (index * 7) % 60);
    const createdAt = daysAgo(5 + (index % 25));
    const messageCount = 4 + (index % 5);

    const conversation: Conversation = {
      conversationId,
      tenantId: DEMO_TENANT_ID,
      botId,
      channel,
      participantId,
      phoneNumber: channel === "whatsapp" ? phone : "",
      contactName: name,
      status: index % 9 === 0 ? "closed" : "active",
      handoffMode: handoff,
      workflowStatus: workflow,
      messageCount,
      lastMessageAt,
      createdAt,
      detectedIntent: ["compra", "soporte", "cotizacion", "seguimiento"][index % 4],
      ...(workflow === "resolved"
        ? {
            resolvedAt: hoursAgo(index % 10, 1),
            firstHumanResponseAt: hoursAgo(index % 10, 3),
            csatScore: 3 + (index % 3),
            csatSubmittedAt: hoursAgo(index % 10, 1),
          }
        : {}),
      ...(handoff === "human" && workflow === "open"
        ? { assignedAdvisorId: demoAdvisorId(index % DEMO_SEED_COUNTS.advisors) }
        : {}),
    };

    await putConversation(conversation);

    if (channel === "whatsapp") {
      await upsertFromConversation({
        tenantId: DEMO_TENANT_ID,
        phoneNumber: phone,
        displayName: name,
        botId,
        source: "sync",
      });
    }

    const messages: Message[] = [];
    for (let messageIndex = 0; messageIndex < messageCount; messageIndex += 1) {
      const isUser = messageIndex % 2 === 0;
      const isAdvisor = !isUser && handoff === "human" && messageIndex === messageCount - 1;
      messages.push({
        messageId: `demo-msg-${index}-${messageIndex}`,
        conversationId,
        tenantId: DEMO_TENANT_ID,
        role: isUser ? "user" : isAdvisor ? "advisor" : "assistant",
        content: isUser
          ? demoUserMessage(index + messageIndex)
          : isAdvisor
            ? demoAdvisorMessage(index + messageIndex)
            : demoAssistantMessage(index + messageIndex),
        channel,
        timestamp: minutesAgo(index % 20, (index * 7 + messageIndex * 3) % 60),
      });
    }

    for (const message of messages) {
      await addMessageIdempotent(message, botId, {
        updateCounters: false,
        updateLastMessageAt: false,
        publishRealtime: false,
      });
    }
  }
}

export async function seedCalls(now: string): Promise<void> {
  const statuses = ["completed", "completed", "completed", "failed", "voicemail"] as const;

  for (let index = 0; index < DEMO_SEED_COUNTS.calls; index += 1) {
    const startedAt = daysAgo(index % 25);
    const endedAt = hoursAgo(index % 25, 23);
    const status = statuses[index % statuses.length]!;
    const call: CallRecord = {
      callId: demoCallId(index),
      tenantId: DEMO_TENANT_ID,
      botId: DEMO_BOT_VOICE_ID,
      phoneNumber: demoPhone(index),
      businessPhoneNumber: "+573001112200",
      direction: index % 2 === 0 ? "USER_INITIATED" : "BUSINESS_INITIATED",
      status,
      provider: "telnyx",
      channel: "phone",
      startedAt,
      costStatus: "partial",
      disposition: ["resolved", "callback", "voicemail", "sale"][index % 4],
      createdAt: startedAt,
      updatedAt: endedAt || now,
      ...(status === "completed"
        ? {
            duration: 90 + index * 15,
            endedAt,
            talkSeconds: 60 + index * 10,
            waitSeconds: 10 + (index % 5) * 5,
          }
        : {}),
    };
    await upsertCallRecord(call);
  }
}

export async function seedSales(now: string): Promise<void> {
  const pipeline: SalesPipeline = {
    pipelineId: DEMO_PIPELINE_ID,
    tenantId: DEMO_TENANT_ID,
    name: "Pipeline principal",
    isDefault: true,
    stages: [
      { stageId: DEMO_STAGE_NEW_ID, key: "new", label: "Nuevo", sortOrder: 0, probability: 10 },
      { stageId: DEMO_STAGE_QUOTED_ID, key: "quoted", label: "Cotizado", sortOrder: 1, probability: 30 },
      {
        stageId: DEMO_STAGE_NEGOTIATION_ID,
        key: "negotiation",
        label: "Negociación",
        sortOrder: 2,
        probability: 60,
      },
      {
        stageId: DEMO_STAGE_WON_ID,
        key: "won",
        label: "Ganado",
        sortOrder: 3,
        probability: 100,
        isClosed: true,
        outcome: "won",
      },
      {
        stageId: DEMO_STAGE_LOST_ID,
        key: "lost",
        label: "Perdido",
        sortOrder: 4,
        probability: 0,
        isClosed: true,
        outcome: "lost",
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  await createPipeline(pipeline);

  const stageIds = [
    DEMO_STAGE_NEW_ID,
    DEMO_STAGE_QUOTED_ID,
    DEMO_STAGE_NEGOTIATION_ID,
    DEMO_STAGE_WON_ID,
    DEMO_STAGE_LOST_ID,
  ];
  const stageKeys: OpportunityStage[] = ["new", "quoted", "negotiation", "won", "lost"];

  for (let index = 0; index < DEMO_SEED_COUNTS.opportunities; index += 1) {
    const stageIndex = index % stageIds.length;
    const stageKey = stageKeys[stageIndex]!;
    const updatedAt = daysAgo(index % 20);
    await createOpportunity({
      opportunityId: demoOpportunityId(index),
      tenantId: DEMO_TENANT_ID,
      pipelineId: DEMO_PIPELINE_ID,
      stageId: stageIds[stageIndex]!,
      botId: index % 2 === 0 ? DEMO_BOT_WA_ID : DEMO_BOT_SUPPORT_ID,
      title: demoOpportunityTitle(index),
      amount: 1200 + index * 650,
      currency: "USD",
      stage: stageKey,
      phone: demoPhone(index),
      name: demoPersonName(index),
      email: `ventas${index + 1}@example.com`,
      description: "Oportunidad generada para la demo comercial de NovaRetail.",
      tags: index % 2 === 0 ? ["prioridad", "demo"] : ["seguimiento"],
      conversationId: demoConversationId(index % DEMO_SEED_COUNTS.conversations),
      assignedAdvisorId: demoAdvisorId(index % DEMO_SEED_COUNTS.advisors),
      createdAt: daysAgo(index % 20 + 2),
      updatedAt,
      ...(stageKey === "won" || stageKey === "lost" ? { closedAt: updatedAt } : {}),
    });
  }

  const leadStatuses: LeadStatus[] = [
    "new",
    "contacted",
    "qualified",
    "converted",
    "lost",
    "new",
    "contacted",
  ];

  for (let index = 0; index < DEMO_SEED_COUNTS.leads; index += 1) {
    const phone = demoPhone(index);
    await createLead({
      leadId: demoLeadId(index),
      tenantId: DEMO_TENANT_ID,
      botId: DEMO_BOT_WA_ID,
      phone,
      conversationId: demoConversationId(index % DEMO_SEED_COUNTS.conversations),
      metaFlowId: "demo-meta-flow",
      flowResponseId: `demo-flow-response-${index + 1}`,
      name: demoPersonName(index),
      email: `lead${index + 1}@example.com`,
      status: leadStatuses[index % leadStatuses.length]!,
      tags: ["demo", ...(index % 2 === 0 ? ["prioridad"] : [])],
      assignedAdvisorId: demoAdvisorId(index % DEMO_SEED_COUNTS.advisors),
      createdAt: daysAgo(index % 15 + 1),
      updatedAt: daysAgo(index % 10),
      ...(leadStatuses[index % leadStatuses.length] === "converted"
        ? { convertedAt: daysAgo(index % 5) }
        : {}),
    });
  }

  for (let index = 0; index < DEMO_SEED_COUNTS.salesTasks; index += 1) {
    const status = index % 4 === 0 ? "done" : index % 3 === 0 ? "cancelled" : "open";
    await createSalesTask({
      taskId: demoSalesTaskId(index),
      tenantId: DEMO_TENANT_ID,
      opportunityId: demoOpportunityId(index % DEMO_SEED_COUNTS.opportunities),
      advisorId: demoAdvisorId(index % DEMO_SEED_COUNTS.advisors),
      title: demoSalesTaskTitle(index),
      description: "Tarea de seguimiento comercial para la demo.",
      dueAt: daysAgo(-(index % 5)),
      status,
      createdAt: daysAgo(index % 10 + 1),
      updatedAt: daysAgo(index % 5),
    });
  }

  for (let index = 0; index < DEMO_SEED_COUNTS.paymentRequests; index += 1) {
    const createdAt = daysAgo(index % 20);
    const paid = index % 3 !== 0;
    const payment = {
      paymentId: demoPaymentId(index),
      tenantId: DEMO_TENANT_ID,
      botId: DEMO_BOT_WA_ID,
      contactPhone: demoPhone(index),
      contactName: demoPersonName(index),
      conversationId: demoConversationId(index % DEMO_SEED_COUNTS.conversations),
      amountInCents: 150_000 + index * 25_000,
      currency: "COP" as const,
      description: `Pago demo #${index + 1}`,
      status: paid ? ("paid" as const) : ("pending" as const),
      source: "flow" as const,
      reference: `DEMO-PAY-${index + 1}`,
      checkoutUrl: `https://checkout.wompi.co/demo/${index + 1}`,
      createdAt,
      updatedAt: createdAt,
      ...(paid ? { paidAt: hoursAgo(index % 10, 2) } : {}),
    };
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `TENANT#${DEMO_TENANT_ID}`,
          SK: `PAYREQ#${payment.paymentId}`,
          GSI1PK: `TENANT#${DEMO_TENANT_ID}#BOT#${DEMO_BOT_WA_ID}`,
          GSI1SK: `CREATED#${createdAt}#${payment.paymentId}`,
          ...payment,
        },
      })
    );
  }
}

export async function seedMarketing(_now: string): Promise<void> {
  const campaignStatuses: CampaignStatus[] = [
    "completed",
    "completed",
    "running",
    "scheduled",
    "completed",
    "failed",
  ];

  for (let index = 0; index < DEMO_SEED_COUNTS.campaigns; index += 1) {
    const status = campaignStatuses[index % campaignStatuses.length]!;
    const total = 400 + index * 80;
    const sent = status === "scheduled" ? 0 : Math.floor(total * 0.92);
    const campaign: Campaign = {
      campaignId: demoCampaignId(index),
      tenantId: DEMO_TENANT_ID,
      botId: DEMO_BOT_WA_ID,
      name: demoCampaignName(index),
      channel: "whatsapp",
      templateName: demoBulkTemplate(index),
      language: "es",
      status,
      segments: ["vip", "recurrente", "nuevo"].slice(0, 1 + (index % 3)),
      total,
      sent,
      failed: Math.floor(sent * 0.02),
      deliveredCount: Math.floor(sent * 0.9),
      readCount: Math.floor(sent * 0.62),
      deliveryFailed: Math.floor(sent * 0.03),
      replyCount: Math.floor(sent * 0.11),
      createdAt: daysAgo(10 + index),
      updatedAt: daysAgo(index % 8),
      ...(status === "completed" ? { completedAt: daysAgo(index % 5) } : {}),
      ...(status === "scheduled" ? { scheduledAt: daysAgo(-2) } : {}),
    };
    await createCampaign(campaign);
  }

  const bulkStatuses = ["completed", "completed", "processing", "failed", "completed"] as const;

  for (let index = 0; index < DEMO_SEED_COUNTS.bulkJobs; index += 1) {
    const status = bulkStatuses[index % bulkStatuses.length]!;
    const total = 180 + index * 40;
    const sent = status === "processing" ? Math.floor(total * 0.6) : status === "failed" ? 0 : total - 5;
    const bulkJob: BulkSendJob = {
      jobId: demoBulkJobId(index),
      tenantId: DEMO_TENANT_ID,
      botId: DEMO_BOT_WA_ID,
      channel: "whatsapp",
      templateName: demoBulkTemplate(index),
      language: "es",
      status,
      total,
      sent,
      failed: status === "failed" ? total : 5,
      deliveryFailed: status === "failed" ? 0 : 4,
      createdAt: daysAgo(8 + index),
      updatedAt: daysAgo(index % 6),
    };
    await createBulkJob(bulkJob);
  }
}

export async function seedAdvisors(now: string): Promise<void> {
  for (let index = 0; index < DEMO_SEED_COUNTS.advisors; index += 1) {
    const advisor: Advisor = {
      advisorId: demoAdvisorId(index),
      tenantId: DEMO_TENANT_ID,
      name: demoPersonName(index + 20),
      phoneNumber: demoPhone(100 + index),
      status: index === 3 ? "inactive" : "active",
      botIds: [DEMO_BOT_WA_ID, DEMO_BOT_SUPPORT_ID],
      skills: ["ventas", "soporte", "retail"].slice(0, 1 + (index % 3)),
      voiceEnabled: index % 2 === 0,
      lastAssignedAt: hoursAgo(index, 4),
      createdAt: daysAgo(30 + index),
      updatedAt: now,
    };
    const phone = advisor.phoneNumber.replace(/\D/g, "");
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `TENANT#${DEMO_TENANT_ID}`,
          SK: `ADVISOR#${advisor.advisorId}`,
          GSI1PK: `TENANT#${DEMO_TENANT_ID}#ADVISOR_PHONE#${phone}`,
          GSI1SK: `ADVISOR#${advisor.createdAt}`,
          ...advisor,
        },
      })
    );
  }
}

export async function seedAutomations(_now: string): Promise<void> {
  const triggers = ["first_message", "keyword", "keyword", "schedule", "flow_completed", "keyword"] as const;
  const actions = ["send_text", "handoff", "tag_contact", "send_template", "send_text", "handoff"] as const;

  for (let index = 0; index < DEMO_SEED_COUNTS.automations; index += 1) {
    await createAutomation({
      ruleId: demoAutomationId(index),
      tenantId: DEMO_TENANT_ID,
      botId: index % 2 === 0 ? DEMO_BOT_WA_ID : DEMO_BOT_SUPPORT_ID,
      name: demoAutomationName(index),
      enabled: index !== 5,
      priority: index + 1,
      trigger: triggers[index % triggers.length]!,
      keywords: index % 2 === 0 ? ["asesor", "humano"] : ["pedido", "cotizacion"],
      matchMode: "contains",
      action: actions[index % actions.length]!,
      messageText: {
        es: "Gracias por escribirnos. Un asesor te atenderá en breve.",
        en: "Thanks for reaching out. An advisor will assist you shortly.",
      },
      tags: ["automatizacion"],
      stopProcessing: index % 3 === 0,
    });
  }
}

export async function seedTemplates(now: string): Promise<void> {
  const names = [
    "promo_invierno",
    "catalogo_novedades",
    "recordatorio_carrito",
    "bienvenida_cliente",
    "encuesta_nps",
    "confirmacion_pedido",
  ];
  const statuses = ["APPROVED", "APPROVED", "APPROVED", "PENDING", "APPROVED", "REJECTED"] as const;

  for (let index = 0; index < DEMO_SEED_COUNTS.templates; index += 1) {
    const template: WhatsAppTemplate = {
      templateId: demoUuid(0xc00 + index),
      tenantId: DEMO_TENANT_ID,
      botId: DEMO_BOT_WA_ID,
      channel: "whatsapp",
      name: names[index]!,
      language: "es",
      category: index % 3 === 0 ? "MARKETING" : "UTILITY",
      status: statuses[index % statuses.length]!,
      components: [
        {
          type: "BODY",
          text: `Hola {{1}}, este es el template demo ${names[index]}.`,
        },
      ],
      metaTemplateId: `meta-demo-${index + 1}`,
      syncedAt: now,
      createdAt: daysAgo(20 - index),
    };
    await upsertCachedTemplate(DEMO_TENANT_ID, DEMO_BOT_WA_ID, template);
  }
}

export async function seedMacros(now: string): Promise<void> {
  for (let index = 0; index < DEMO_SEED_COUNTS.macros; index += 1) {
    const macro = {
      macroId: demoMacroId(index),
      tenantId: DEMO_TENANT_ID,
      botId: DEMO_BOT_WA_ID,
      title: demoMacroTitle(index),
      content: `Respuesta rápida demo: ${demoMacroTitle(index)}.`,
      shortcut: `/demo${index + 1}`,
      sortOrder: index,
      createdAt: daysAgo(10),
      updatedAt: now,
    };
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `TENANT#${DEMO_TENANT_ID}#BOT#${DEMO_BOT_WA_ID}`,
          SK: `MACRO#${macro.macroId}`,
          ...macro,
        },
      })
    );
  }
}

export async function seedUsage(now: string): Promise<void> {
  const period = currentUsagePeriod();
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `TENANT#${DEMO_TENANT_ID}`,
        SK: `USAGE#${period}`,
        tenantId: DEMO_TENANT_ID,
        period,
        messagesCount: 4820,
        bulkRecipientsCount: 3180,
        campaignsStarted: 14,
        voicebotMinutesCount: 286,
        updatedAt: now,
      },
    })
  );
}

export async function seedMember(userId: string, email: string, now: string): Promise<void> {
  const member: TenantMember = {
    userId,
    username: email,
    email,
    name: "Demo Presenter",
    role: "member",
    enabled: true,
    createdAt: now,
  };
  await putMember(member, DEMO_TENANT_ID);
}
