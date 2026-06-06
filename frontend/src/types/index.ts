export type TenantPlan = "free" | "pro" | "enterprise";

export type SubscriptionStatus =
  | "none"
  | "active"
  | "past_due"
  | "canceled"
  | "trialing";

export interface Tenant {
  tenantId: string;
  name: string;
  email: string;
  plan: TenantPlan;
  status: "active" | "suspended" | "pending";
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  currentPeriodEnd?: string;
  paymentProvider?: "stripe" | "wompi";
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyUsage {
  tenantId: string;
  period: string;
  messagesCount: number;
  bulkRecipientsCount: number;
  campaignsStarted: number;
}

export interface PlanLimits {
  maxActiveBots: number;
  maxMessagesPerMonth: number;
  maxBulkRecipientsPerJob: number;
  maxActiveCampaigns: number;
  maxContacts: number;
}

export interface BillingUsageResponse {
  usage: MonthlyUsage;
  limits: PlanLimits;
  plan: TenantPlan;
  subscription?: SubscriptionStatus;
}

export type WhatsAppQualityRating = "GREEN" | "YELLOW" | "RED" | "NA";

export interface WhatsAppPhoneInfo {
  qualityRating: WhatsAppQualityRating;
  status: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  messagingLimit?: string;
}

export interface Bot {
  botId: string;
  tenantId: string;
  name: string;
  responseMode: "openai" | "webhook";
  systemPrompt?: string;
  model?: "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo";
  temperature?: number;
  maxTokens?: number;
  webhookUrl?: string;
  webhookSecret?: string;
  knowledgeEnabled?: boolean;
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
  whatsappPhone?: WhatsAppPhoneInfo | null;
}

export type HandoffMode = "bot" | "human";

export type HandoffReason = "manual" | "ai" | "webhook";

export type WorkflowStatus = "new" | "open" | "pending" | "resolved";

export type MarketingConsent = "unknown" | "opt_in" | "opt_out";

export type ContactSource = "sync" | "manual" | "import";

export interface Contact {
  phoneNumber: string;
  tenantId: string;
  displayName?: string;
  tags: string[];
  marketingConsent: MarketingConsent;
  consentAt?: string;
  consentSource?: string;
  suppressed: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  lastBotId?: string;
  source: ContactSource;
  createdAt: string;
  updatedAt: string;
}

export interface ContactsListResponse {
  items: Contact[];
  nextCursor?: string;
}

export interface Conversation {
  conversationId: string;
  tenantId: string;
  botId: string;
  phoneNumber: string;
  contactName?: string;
  status: "active" | "closed";
  handoffMode?: HandoffMode;
  assignedAdvisorId?: string;
  handoffAt?: string;
  handoffReason?: HandoffReason;
  workflowStatus?: WorkflowStatus;
  resolvedAt?: string;
  firstHumanResponseAt?: string;
  csatScore?: number;
  csatSubmittedAt?: string;
  internalNote?: string;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
}

export interface MarketingMetrics {
  campaigns: {
    total: number;
    active: number;
    completed: number;
    aggregates: {
      totalRecipients: number;
      sent: number;
      delivered: number;
      read: number;
      deliveryFailed: number;
    };
    rates: {
      deliveryRate: number;
      readRate: number;
      failureRate: number;
      successRate: number;
    };
  };
  bulk: {
    jobsCount: number;
    sent: number;
    failed: number;
    rates: { successRate: number };
  };
  topCampaigns: Array<{
    campaignId: string;
    name: string;
    sent: number;
    deliveredCount: number;
    readCount: number;
    deliveryRate: number;
    readRate: number;
  }>;
  inbox: {
    open: number;
    pending: number;
    resolvedToday: number;
  };
}

export type MessageRole = "user" | "assistant" | "advisor" | "system";

export interface Message {
  messageId: string;
  conversationId: string;
  tenantId: string;
  role: MessageRole;
  content: string;
  source?: "panel" | "whatsapp_inbound";
  sentByAdvisorId?: string;
  whatsappMessageId?: string;
  timestamp: string;
}

export interface Advisor {
  advisorId: string;
  tenantId: string;
  name: string;
  phoneNumber: string;
  cognitoUserId?: string;
  status: "active" | "inactive";
  botIds?: string[];
  lastAssignedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdvisorInviteResponse {
  advisor: Advisor;
  invite?: {
    username: string;
    temporaryPassword: string;
  };
}

export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  example?: { header_text?: string[]; body_text?: string[][] };
  buttons?: TemplateButton[];
}

export interface TemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
}

export interface WhatsAppTemplate {
  templateId: string;
  tenantId: string;
  botId: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "APPROVED" | "PENDING" | "REJECTED";
  components: TemplateComponent[];
  metaTemplateId?: string;
  syncedAt: string;
  createdAt: string;
}

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface Campaign {
  campaignId: string;
  tenantId: string;
  botId: string;
  name: string;
  templateName: string;
  language: string;
  status: CampaignStatus;
  segments: string[];
  scheduledAt?: string;
  total: number;
  sent: number;
  failed: number;
  deliveredCount: number;
  readCount: number;
  deliveryFailed: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export type BulkSendJobStatus = "queued" | "processing" | "completed" | "failed";

export interface BulkSendJob {
  jobId: string;
  tenantId: string;
  botId: string;
  templateName: string;
  language: string;
  status: BulkSendJobStatus;
  total: number;
  sent: number;
  failed: number;
  createdAt: string;
  updatedAt: string;
}

export interface BotUsageMetrics {
  botId: string;
  botName: string;
  status: Bot["status"];
  conversations: number;
  activeConversations: number;
  messages: number;
  templates: number;
  lastActivityAt: string | null;
}

export interface UsageMetricsSummary {
  totalBots: number;
  activeBots: number;
  totalConversations: number;
  activeConversations: number;
  totalMessages: number;
  totalTemplates: number;
  bulkJobsCount: number;
  bulkMessagesSent: number;
  bulkMessagesFailed: number;
  lastActivityAt: string | null;
}

export interface UsageMetrics {
  summary: UsageMetricsSummary;
  byBot: BotUsageMetrics[];
  recentBulkJobs: BulkSendJob[];
}

export interface ApiKey {
  keyId: string;
  tenantId: string;
  botId: string;
  name: string;
  prefix: string;
  scopes: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string;
}

export interface ApiKeyUsageLog {
  logId: string;
  tenantId: string;
  keyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  messageId?: string;
  maskedPhone?: string;
  createdAt: string;
}

export interface ApiKeyUsageSummary {
  keyId: string;
  keyName: string;
  prefix: string;
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  messagesThisMonth: number;
  lastUsedAt?: string;
}

export type SupportTicketCategory = "general" | "technical" | "billing" | "whatsapp";

export type SupportTicketStatus = "open" | "closed";

export type PaymentStatus = "pending" | "approved" | "declined";

export interface PaymentIntent {
  reference: string;
  tenantId: string;
  plan: TenantPlan;
  amountInCents: number;
  status: PaymentStatus;
  wompiTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CognitoUserSummary {
  username: string;
  sub: string;
  email: string;
  tenantId: string;
  role: string;
  enabled: boolean;
  createdAt: string;
}

export interface CognitoUsersPage {
  users: CognitoUserSummary[];
  paginationToken?: string;
}

export interface SupportTicket {
  ticketId: string;
  tenantId: string;
  createdBy: string;
  email: string;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  adminReply?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type IntegrationEvent = "message.received" | "conversation.handoff" | "message.sent";

export interface TenantIntegration {
  integrationId: string;
  tenantId: string;
  webhookUrl: string;
  webhookSecret?: string;
  subscribedEvents: IntegrationEvent[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationDelivery {
  deliveryId: string;
  tenantId: string;
  event: IntegrationEvent;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  lastError?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type AutomationTrigger = "keyword" | "first_message" | "schedule";
export type AutomationAction = "send_text" | "send_template" | "tag_contact" | "handoff";

export interface AutomationRule {
  ruleId: string;
  tenantId: string;
  botId: string;
  name: string;
  enabled: boolean;
  priority: number;
  trigger: AutomationTrigger;
  keywords?: string[];
  matchMode?: "contains" | "exact";
  scheduledAt?: string;
  targetPhones?: string[];
  targetTags?: string[];
  action: AutomationAction;
  messageText?: string;
  templateName?: string;
  templateLanguage?: string;
  templateVariables?: Record<string, string>;
  tags?: string[];
  stopProcessing?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type KnowledgeDocumentStatus = "pending" | "indexing" | "ready" | "failed";

export interface KnowledgeDocument {
  docId: string;
  tenantId: string;
  botId: string;
  filename: string;
  mimeType: string;
  s3Key: string;
  status: KnowledgeDocumentStatus;
  chunkCount: number;
  sizeBytes: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
