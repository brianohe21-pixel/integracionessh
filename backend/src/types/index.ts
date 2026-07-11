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
}

export type HandoffMode = "bot" | "human";

export type HandoffReason = "manual" | "ai" | "webhook";

export type WorkflowStatus = "new" | "open" | "pending" | "resolved";

export interface Conversation {
  conversationId: string;
  tenantId: string;
  botId: string;
  channel: Channel;
  participantId: string;
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
  welcomeSentAt?: string;
  activeFlowRunId?: string;
  pendingMetaFlowId?: string;
  metaFlowToken?: string;
  createdAt: string;
}

export type MessageRole = "user" | "assistant" | "advisor" | "system";

export type MessageSource =
  | "panel"
  | "whatsapp_inbound"
  | "instagram_inbound"
  | "webchat_inbound";

export type MessageType =
  | "text"
  | "interactive"
  | "flow_response"
  | "order"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "location"
  | "call_invite"
  | "call_ended";

export type LiveKitCallStatus = "ringing" | "active" | "ended" | "missed" | "declined";

export interface LiveKitCall {
  callId: string;
  tenantId: string;
  botId: string;
  conversationId: string;
  channel: "webchat";
  roomName: string;
  status: LiveKitCallStatus;
  initiatedBy: "advisor" | "visitor" | "member";
  initiatedById: string;
  videoEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  endedAt?: string;
}

export interface Message {
  messageId: string;
  conversationId: string;
  tenantId: string;
  role: MessageRole;
  content: string;
  channel?: Channel;
  messageType?: MessageType;
  metadata?: Record<string, unknown>;
  source?: MessageSource;
  sentByAdvisorId?: string;
  whatsappMessageId?: string;
  externalMessageId?: string | undefined;
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

export type ContactSource = "sync" | "manual" | "import" | "lead_capture";

export interface Contact {
  phoneNumber: string;
  tenantId: string;
  displayName?: string;
  email?: string;
  tags: string[];
  marketingConsent: MarketingConsent;
  consentAt?: string;
  consentSource?: ConsentSource;
  suppressed: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  lastBotId?: string;
  messageCount?: number;
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
  statuses?: Array<WhatsAppStatus | WhatsAppCallStatusItem>;
  calls?: WhatsAppCallWebhookItem[];
}

export type WhatsAppCallAction =
  | "connect"
  | "pre_accept"
  | "accept"
  | "reject"
  | "terminate";

export type WhatsAppCallDirection = "USER_INITIATED" | "BUSINESS_INITIATED";

export type WhatsAppCallLifecycleStatus =
  | "RINGING"
  | "ACCEPTED"
  | "REJECTED"
  | "COMPLETED"
  | "FAILED";

export interface WhatsAppCallSession {
  sdp_type: "offer" | "answer";
  sdp: string;
}

export interface WhatsAppCallWebhookItem {
  id: string;
  from?: string;
  to?: string;
  event: "connect" | "terminate";
  timestamp: string;
  direction?: WhatsAppCallDirection;
  session?: WhatsAppCallSession;
  connection?: { webrtc?: { sdp?: string } };
  biz_opaque_callback_data?: string;
  status?: string | string[];
  start_time?: string;
  end_time?: string;
  duration?: number;
}

export interface WhatsAppCallStatusItem {
  id: string;
  type: "call";
  status: "RINGING" | "ACCEPTED" | "REJECTED";
  timestamp: string;
  recipient_id: string;
}

export type CallRecordStatus =
  | "initiated"
  | "ringing"
  | "accepted"
  | "rejected"
  | "completed"
  | "failed"
  | "terminated";

export interface CallRecord {
  callId: string;
  tenantId: string;
  botId: string;
  phoneNumber: string;
  businessPhoneNumber?: string;
  direction: WhatsAppCallDirection;
  status: CallRecordStatus;
  duration?: number;
  bizOpaqueCallbackData?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type CallQueueEventType = "connect" | "status" | "terminate";

export interface CallQueueMessage {
  tenantId: string;
  botId: string;
  phoneNumberId: string;
  eventType: CallQueueEventType;
  callId: string;
  phoneNumber?: string;
  direction?: WhatsAppCallDirection;
  from?: string;
  to?: string;
  session?: WhatsAppCallSession;
  status?: WhatsAppCallLifecycleStatus;
  duration?: number;
  bizOpaqueCallbackData?: string;
  timestamp: string;
  startTime?: string;
  endTime?: string;
}

export interface WhatsAppContact {
  profile?: { name: string };
  wa_id: string;
  user_id?: string;
}

export interface WhatsAppInteractiveReply {
  type: "button_reply" | "list_reply" | "nfm_reply";
  button_reply?: { id: string; title: string };
  list_reply?: { id: string; title: string; description?: string };
  nfm_reply?: { response_json: string; body?: string; name?: string };
}

export interface WhatsAppOrderProductItem {
  product_retailer_id: string;
  quantity: number | string;
  item_price: number | string;
  currency: string;
}

export interface WhatsAppOrderPayload {
  catalog_id: string;
  text?: string;
  product_items: WhatsAppOrderProductItem[];
}

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type:
    | "text"
    | "image"
    | "audio"
    | "video"
    | "document"
    | "location"
    | "interactive"
    | "order";
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string };
  interactive?: WhatsAppInteractiveReply;
  order?: WhatsAppOrderPayload;
}

export interface InboundNormalized {
  text: string;
  messageType: MessageType;
  interactive?: {
    kind: "button" | "list" | "nfm";
    id?: string;
    payload?: string;
    responseJson?: string;
  };
  order?: WhatsAppOrderPayload;
  raw?: unknown;
}

export interface InstagramMessage {
  mid: string;
  text?: string;
  attachments?: Array<{
    type: string;
    payload?: { url?: string };
  }>;
}

export interface InstagramWebhookEvent {
  object: string;
  entry: Array<{
    id: string;
    messaging?: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: InstagramMessage;
    }>;
  }>;
}

export interface WebChatInboundPayload {
  messageId: string;
  text: string;
  sessionId: string;
}

export interface WhatsAppInboundPayload {
  phoneNumberId: string;
  message: WhatsAppMessage;
  contact: WhatsAppContact;
}

export interface InstagramInboundPayload {
  pageId: string;
  senderId: string;
  message: InstagramMessage;
}

export interface InboundQueueMessage {
  channel: Channel;
  tenantId: string;
  botId: string;
  participantId: string;
  conversationKey: string;
  displayName?: string | undefined;
  replyToExternalId?: string | undefined;
  payload: WhatsAppInboundPayload | InstagramInboundPayload | WebChatInboundPayload;
}

export interface WebChatSession {
  sessionId: string;
  tenantId: string;
  botId: string;
  conversationId: string;
  visitorName?: string;
  createdAt: string;
  lastActivityAt: string;
  ttl: number;
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
  requireOptIn?: boolean;
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
  callId?: string;
  maskedPhone?: string;
  errorMessage?: string;
  errorStack?: string;
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

export type IntegrationEvent =
  | "message.received"
  | "conversation.handoff"
  | "message.sent"
  | "flow.completed"
  | "lead.created"
  | "lead.converted"
  | "call.connect"
  | "call.status"
  | "call.terminated"
  | "booking.created"
  | "booking.cancelled"
  | "payment.completed"
  | "payment.failed"
  | "order.created"
  | "order.status_changed";

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

export type CalendarProviderType = "native";

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
  provider: CalendarProviderType;
  calendarPublicKey?: string;
  publicLinkEnabled?: boolean;
  reminderEnabled?: boolean;
  reminderMinutesBefore?: number;
  reminderChannel?: CalendarReminderChannel;
  reminderMessage?: string;
  reminderTemplateName?: string;
  reminderTemplateLanguage?: string;
  autoCollectPayment?: boolean;
  bookingPriceInCents?: number;
  createdAt: string;
  updatedAt: string;
}

export type BookingStatus = "confirmed" | "cancelled" | "completed" | "no_show";
export type BookingSource = "flow" | "openai" | "manual" | "public_link";

export type BookingPaymentStatus = "pending" | "paid" | "not_required";

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
  source: BookingSource;
  notes?: string;
  externalEventId?: string;
  paymentId?: string;
  amountInCents?: number;
  paymentStatus?: BookingPaymentStatus;
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

export type PaymentRequestStatus = "pending" | "paid" | "declined" | "expired";
export type PaymentRequestSource = "manual" | "flow" | "catalog_order" | "calendar_booking";

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
  bookingId?: string;
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

export interface AppCatalogItem {
  id: string;
  name: string;
  description: string;
  installedBots: Array<{ botId: string; botName: string; enabled: boolean }>;
}

export const WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  monday: [{ start: "09:00", end: "17:00" }],
  tuesday: [{ start: "09:00", end: "17:00" }],
  wednesday: [{ start: "09:00", end: "17:00" }],
  thursday: [{ start: "09:00", end: "17:00" }],
  friday: [{ start: "09:00", end: "17:00" }],
  saturday: [],
  sunday: [],
};

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
  matchMode?: AutomationMatchMode;
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

export type FlowRunStatus = "active" | "waiting" | "completed" | "failed";

export interface FlowRunStep {
  nodeId: string;
  at: string;
  output?: string;
}

export interface FlowRun {
  runId: string;
  flowId: string;
  tenantId: string;
  botId: string;
  conversationId: string;
  customerPhone: string;
  status: FlowRunStatus;
  currentNodeId: string;
  variables: Record<string, string>;
  stepHistory: FlowRunStep[];
  waitingUntil?: string;
  stepCount: number;
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

export type IntegrationDeliveryStatus = "pending" | "delivered" | "failed";

export interface IntegrationDelivery {
  deliveryId: string;
  tenantId: string;
  event: IntegrationEvent;
  status: IntegrationDeliveryStatus;
  attempts: number;
  lastError?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type AutomationTrigger = "keyword" | "first_message" | "schedule" | "flow_completed";
export type AutomationAction = "send_text" | "send_template" | "tag_contact" | "handoff";
export type AutomationMatchMode = "contains" | "exact";

export interface AutomationRule {
  ruleId: string;
  tenantId: string;
  botId: string;
  name: string;
  enabled: boolean;
  priority: number;
  trigger: AutomationTrigger;
  keywords?: string[];
  matchMode?: AutomationMatchMode;
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

export interface KnowledgeChunk {
  docId: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
}

export interface IntegrationEventPayload {
  event: IntegrationEvent;
  timestamp: string;
  tenantId: string;
  data: Record<string, unknown>;
}

export interface IntegrationQueueMessage {
  tenantId: string;
  deliveryId: string;
  event: IntegrationEvent;
  payload: IntegrationEventPayload;
  attempt: number;
}
