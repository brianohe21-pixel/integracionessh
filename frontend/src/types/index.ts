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
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
  whatsappPhone?: WhatsAppPhoneInfo | null;
}

export interface Conversation {
  conversationId: string;
  tenantId: string;
  botId: string;
  phoneNumber: string;
  contactName?: string;
  status: "active" | "closed";
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
}

export interface Message {
  messageId: string;
  conversationId: string;
  tenantId: string;
  role: "user" | "assistant";
  content: string;
  whatsappMessageId?: string;
  timestamp: string;
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
