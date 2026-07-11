export type TenantPlan = "free" | "pro" | "enterprise";

export type SubscriptionStatus =
  | "none"
  | "active"
  | "past_due"
  | "canceled"
  | "trialing";

export interface TenantBranding {
  brandName?: string;
  primaryColor?: string;
  logoS3Key?: string;
}

export interface ResolvedTenantBranding {
  brandName: string;
  primaryColor: string;
  logoUrl?: string;
}

export interface Tenant {
  tenantId: string;
  name: string;
  email: string;
  plan: TenantPlan;
  status: "active" | "suspended" | "pending";
  branding?: TenantBranding;
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

export type Channel = "whatsapp" | "instagram" | "webchat";

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
  instagramPageId?: string;
  instagramAccountId?: string;
  webchatEnabled?: boolean;
  webchatWidgetKey?: string;
  webchatVoiceEnabled?: boolean;
  webchatVideoEnabled?: boolean;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
  whatsappPhone?: WhatsAppPhoneInfo | null;
}

export type HandoffMode = "bot" | "human";

export type HandoffReason = "manual" | "ai" | "webhook";

export type WorkflowStatus = "new" | "open" | "pending" | "resolved";

export type MarketingConsent = "unknown" | "opt_in" | "opt_out";

export type ContactSource = "sync" | "manual" | "import" | "lead_capture";

export interface Contact {
  phoneNumber: string;
  tenantId: string;
  displayName?: string;
  email?: string;
  tags: string[];
  marketingConsent: MarketingConsent;
  consentAt?: string;
  consentSource?: string;
  suppressed: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  lastBotId?: string;
  leadId?: string;
  source: ContactSource;
  createdAt: string;
  updatedAt: string;
}

export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";

export interface Lead {
  leadId: string;
  tenantId: string;
  botId: string;
  phone: string;
  conversationId: string;
  metaFlowId: string;
  flowResponseId: string;
  name?: string;
  email?: string;
  status: LeadStatus;
  tags: string[];
  notes?: string;
  assignedAdvisorId?: string;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadsListResponse {
  items: Lead[];
  nextCursor?: string;
}

export interface LeadMetrics {
  total: number;
  byStatus: Record<LeadStatus, number>;
  capturedToday: number;
  capturedThisWeek: number;
  conversionRate: number;
  averageConversionHours: number;
  topBots: Array<{ botId: string; count: number }>;
  topFlows: Array<{ metaFlowId: string; count: number }>;
  funnel: {
    new: number;
    contacted: number;
    qualified: number;
    converted: number;
    lost: number;
  };
}

export interface ContactsListResponse {
  items: Contact[];
  nextCursor?: string;
}

export interface ConversationsListResponse {
  items: Conversation[];
  nextCursor?: string;
}

export interface Conversation {
  conversationId: string;
  tenantId: string;
  botId: string;
  channel?: Channel;
  participantId?: string;
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

export type CallingMetricsHealth = "healthy" | "at_risk" | "insufficient_data";

export interface CallingMetricsSummary {
  totalCalls: number;
  outboundAttempts: number;
  outboundPickedUp: number;
  outboundMissed: number;
  inboundCalls: number;
  inboundAnswered: number;
  pickupRate: number;
  inboundAnswerRate: number;
  averageDurationSeconds: number;
  health: CallingMetricsHealth;
}

export interface CallingMetricsBotRow extends CallingMetricsSummary {
  botId: string;
  botName: string;
}

export interface CallingMetrics {
  from: string;
  to: string;
  windowDays: number;
  metaPickupThreshold: number;
  summary: CallingMetricsSummary;
  byBot: CallingMetricsBotRow[];
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
  requireOptIn?: boolean;
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
  callId?: string;
  maskedPhone?: string;
  errorMessage?: string;
  errorStack?: string;
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

export type IntegrationEvent =
  | "message.received"
  | "conversation.handoff"
  | "message.sent"
  | "flow.completed"
  | "lead.created"
  | "lead.converted"
  | "call.connect"
  | "call.status"
  | "call.terminated";

export type MetaFlowStatus = "DRAFT" | "PUBLISHED" | "DEPRECATED";

export interface MetaFlow {
  metaFlowId: string;
  tenantId: string;
  botId: string;
  name: string;
  status: MetaFlowStatus;
  categories: string[];
  jsonDefinition: Record<string, unknown>;
  metaStatus?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface FlowResponse {
  responseId: string;
  tenantId: string;
  botId: string;
  conversationId: string;
  phone: string;
  metaFlowId: string;
  responseJson: Record<string, unknown>;
  leadId?: string;
  createdAt: string;
}

export type FlowNodeType =
  | "trigger"
  | "message"
  | "template"
  | "condition"
  | "buttons"
  | "meta_flow"
  | "handoff"
  | "delay"
  | "set_variable"
  | "http_request"
  | "book_appointment"
  | "request_payment"
  | "send_catalog"
  | "send_products"
  | "await_order"
  | "end";

export type FlowTriggerType = "keyword" | "first_message" | "any_message";

export interface FlowNodeData {
  label?: string;
  triggerType?: FlowTriggerType;
  keywords?: string[];
  matchMode?: "contains" | "exact";
  messageText?: string;
  templateName?: string;
  templateLanguage?: string;
  templateVariables?: Record<string, string>;
  conditionVariable?: string;
  conditionOperator?: "contains" | "equals" | "not_equals";
  conditionValue?: string;
  buttons?: Array<{ id: string; title: string }>;
  metaFlowId?: string;
  metaFlowCta?: string;
  delaySeconds?: number;
  variableName?: string;
  variableValue?: string;
  httpUrl?: string;
  httpMethod?: "GET" | "POST";
  httpBody?: string;
  haltPipeline?: boolean;
  confirmationMessage?: string;
  maxDaysToShow?: number;
  amountInCents?: number;
  paymentDescription?: string;
  paymentMessageTemplate?: string;
  waitForPayment?: boolean;
  catalogMessageText?: string;
  productRetailerIds?: string[];
  multiProductHeader?: string;
  multiProductBody?: string;
  orderConfirmationMessage?: string;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface FlowDefinition {
  flowId: string;
  tenantId: string;
  botId: string;
  name: string;
  enabled: boolean;
  version: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  entryNodeId: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

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

export type AutomationTrigger = "keyword" | "first_message" | "schedule" | "flow_completed";
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
  metaFlowId?: string;
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

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface TimeRange {
  start: string;
  end: string;
}

export type WeeklySchedule = Record<Weekday, TimeRange[]>;

export type CalendarReminderChannel = "whatsapp_text" | "whatsapp_template";
export type BookingReminderStatus = "scheduled" | "sent" | "skipped" | "cancelled";

export interface CalendarConfig {
  tenantId: string;
  botId: string;
  enabled: boolean;
  timezone: string;
  slotDurationMinutes: number;
  bufferMinutes: number;
  maxAdvanceDays: number;
  minNoticeHours: number;
  weeklySchedule: WeeklySchedule;
  provider: "native";
  calendarPublicKey?: string;
  publicLinkEnabled?: boolean;
  reminderEnabled?: boolean;
  reminderMinutesBefore?: number;
  reminderChannel?: CalendarReminderChannel;
  reminderMessage?: string;
  reminderTemplateName?: string;
  reminderTemplateLanguage?: string;
  createdAt: string;
  updatedAt: string;
}

export type BookingStatus = "confirmed" | "cancelled" | "completed" | "no_show";

export interface Booking {
  bookingId: string;
  tenantId: string;
  botId: string;
  contactPhone: string;
  contactName?: string;
  conversationId?: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  source: "flow" | "openai" | "manual" | "public_link";
  notes?: string;
  reminderScheduleName?: string;
  reminderSentAt?: string;
  reminderStatus?: BookingReminderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableSlot {
  startAt: string;
  endAt: string;
  label: string;
}

export interface AppCatalogItem {
  id: string;
  name: string;
  description: string;
  installedBots: Array<{ botId: string; botName: string; enabled: boolean }>;
}

export type PaymentRequestStatus = "pending" | "paid" | "declined" | "expired";
export type PaymentRequestSource = "manual" | "flow" | "catalog_order";

export type CatalogSyncStatus = "linked" | "syncing" | "error" | "not_linked";
export type ProductAvailability = "in_stock" | "out_of_stock";
export type ProductSyncStatus = "synced" | "pending" | "error";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled";
export type OrderSource = "whatsapp_cart" | "manual" | "flow";

export interface CatalogConfig {
  tenantId: string;
  botId: string;
  enabled: boolean;
  metaCatalogId?: string;
  currency: "COP";
  autoCollectPayment: boolean;
  orderConfirmationMessage?: string;
  orderStatusMessageTemplate?: string;
  catalogMessageText?: string;
  syncStatus: CatalogSyncStatus;
  lastSyncAt?: string;
  lastSyncError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogProduct {
  productId: string;
  tenantId: string;
  botId: string;
  retailerId: string;
  name: string;
  description: string;
  priceInCents: number;
  currency: "COP";
  imageS3Key?: string;
  imageUrl?: string;
  availability: ProductAvailability;
  metaProductId?: string;
  syncStatus: ProductSyncStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  retailerId: string;
  productId?: string;
  name: string;
  quantity: number;
  unitPriceInCents: number;
  currency: "COP";
}

export interface CatalogOrder {
  orderId: string;
  tenantId: string;
  botId: string;
  conversationId?: string;
  contactPhone: string;
  contactName?: string;
  status: OrderStatus;
  catalogId: string;
  customerNote?: string;
  items: OrderItem[];
  subtotalInCents: number;
  currency: "COP";
  paymentId?: string;
  source: OrderSource;
  whatsappMessageId?: string;
  unresolvedItems?: boolean;
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetaCatalogSummary {
  id: string;
  name: string;
}

export interface PaymentsConfig {
  tenantId: string;
  botId: string;
  enabled: boolean;
  currency: "COP";
  defaultAmountInCents?: number;
  paymentMessageTemplate?: string;
  successRedirectUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRequest {
  paymentId: string;
  tenantId: string;
  botId: string;
  contactPhone: string;
  contactName?: string;
  conversationId?: string;
  flowRunId?: string;
  amountInCents: number;
  currency: "COP";
  description: string;
  status: PaymentRequestStatus;
  source: PaymentRequestSource;
  reference: string;
  checkoutUrl: string;
  wompiTransactionId?: string;
  paidAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaskedWompiCredentials {
  configured: boolean;
  publicKey?: string;
  privateKey?: string;
  integritySecret?: string;
  eventsSecret?: string;
  tenantId?: string;
}

export interface TenantWompiSecretPayload {
  publicKey: string;
  privateKey: string;
  integritySecret: string;
  eventsSecret: string;
}
