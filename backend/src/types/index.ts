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
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export type HandoffMode = "bot" | "human";

export type HandoffReason = "manual" | "ai" | "webhook";

export type WorkflowStatus = "new" | "open" | "pending" | "resolved";

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
  lastAdvisorNotifiedAt?: string;
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

export type MessageRole = "user" | "assistant" | "advisor" | "system";

export type MessageSource = "panel" | "whatsapp_inbound";

export interface Message {
  messageId: string;
  conversationId: string;
  tenantId: string;
  role: MessageRole;
  content: string;
  source?: MessageSource;
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

export type MarketingConsent = "unknown" | "opt_in" | "opt_out";

export type ConsentSource = "manual" | "import" | "whatsapp_keyword" | "panel";

export type ContactSource = "sync" | "manual" | "import";

export interface Contact {
  phoneNumber: string;
  tenantId: string;
  displayName?: string;
  tags: string[];
  marketingConsent: MarketingConsent;
  consentAt?: string;
  consentSource?: ConsentSource;
  suppressed: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  lastBotId?: string;
  messageCount?: number;
  source: ContactSource;
  createdAt: string;
  updatedAt: string;
}

export interface DynamoDBItem {
  PK: string;
  SK: string;
  GSI1PK?: string;
  GSI1SK?: string;
  ttl?: number;
  [key: string]: unknown;
}

export interface WhatsAppWebhookEvent {
  object: string;
  entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppChange {
  value: WhatsAppValue;
  field: string;
}

export interface WhatsAppValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

export interface WhatsAppContact {
  profile?: { name: string };
  wa_id: string;
  user_id?: string;
}

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "image" | "audio" | "video" | "document" | "location" | "interactive";
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string };
}

export interface WhatsAppStatusError {
  code: number;
  title: string;
  message?: string;
  error_data?: { details?: string };
}

export interface WhatsAppStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: WhatsAppStatusError[];
}

export type BulkSendFailureKind = "send" | "delivery" | "compliance";

export interface BulkSendFailure {
  jobId: string;
  tenantId: string;
  kind: BulkSendFailureKind;
  to: string;
  messageId?: string;
  errorCode?: number;
  errorTitle?: string;
  errorMessage: string;
  failedAt: string;
}

export interface BulkSendFailureSummary {
  kind: BulkSendFailureKind;
  errorCode?: number;
  errorTitle: string;
  count: number;
}

export interface BulkSendFailuresResponse {
  jobId: string;
  items: BulkSendFailure[];
  summary: BulkSendFailureSummary[];
  total: number;
}

export interface SQSMessageBody {
  tenantId: string;
  botId: string;
  conversationId: string;
  phoneNumberId: string;
  message: WhatsAppMessage;
  contact: WhatsAppContact;
}

export interface ApiResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
}

export interface AuthContext {
  tenantId: string;
  userId: string;
  email: string;
  name?: string;
  role: "admin" | "member" | "advisor";
}

export interface ChatCompletionResult {
  reply: string | null;
  handoff: boolean;
  handoffReason?: string;
}

export interface WebhookCallResult {
  reply: string;
  handoff: boolean;
  handoffReason?: string;
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

export interface CampaignRecipient {
  to: string;
  components?: Array<{
    type: string;
    parameters?: Array<{ type: string; text?: string; image?: { link: string } }>;
  }>;
}

export interface CampaignSQSBody {
  campaignId: string;
  tenantId: string;
  botId: string;
  templateName: string;
  language: string;
  to: string;
  components?: CampaignRecipient["components"];
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
  deliveryFailed: number;
  createdAt: string;
  updatedAt: string;
}

export interface BulkSendSQSBody {
  jobId: string;
  tenantId: string;
  botId: string;
  templateName: string;
  language: string;
  to: string;
  components?: Array<{
    type: string;
    parameters?: Array<{ type: string; text?: string; image?: { link: string } }>;
  }>;
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

export interface MarketingMetricsRates {
  deliveryRate: number;
  readRate: number;
  failureRate: number;
  successRate: number;
}

export interface MarketingMetricsCampaignAggregate {
  totalRecipients: number;
  sent: number;
  delivered: number;
  read: number;
  deliveryFailed: number;
}

export interface TopCampaignMetric {
  campaignId: string;
  name: string;
  sent: number;
  deliveredCount: number;
  readCount: number;
  deliveryRate: number;
  readRate: number;
}

export interface MarketingMetrics {
  campaigns: {
    total: number;
    active: number;
    completed: number;
    aggregates: MarketingMetricsCampaignAggregate;
    rates: MarketingMetricsRates;
  };
  bulk: {
    jobsCount: number;
    sent: number;
    failed: number;
    rates: Pick<MarketingMetricsRates, "successRate">;
  };
  topCampaigns: TopCampaignMetric[];
  inbox: {
    open: number;
    pending: number;
    resolvedToday: number;
  };
}

export interface ApiKey {
  keyId: string;
  tenantId: string;
  botId: string;
  name: string;
  prefix: string;
  hashedKey: string;
  scopes: string[];
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
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

export interface RateLimitResult {
  allowed: boolean;
  minuteRemaining: number;
  dayRemaining: number;
  retryAfterSeconds?: number;
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
