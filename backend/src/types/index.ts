export type TenantPlan = "free" | "pro" | "enterprise" | "reseller";

export type TenantKind = "standard" | "reseller" | "subaccount";

export type CustomDomainStatus = "none" | "pending_dns" | "active" | "error";

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

export interface ResellerLimitsOverride {
  maxActiveBots?: number;
  maxMessagesPerMonth?: number;
  maxBulkRecipientsPerJob?: number;
  maxActiveCampaigns?: number;
  maxContacts?: number;
  maxAutomationsPerBot?: number;
  maxScheduledAutomations?: number;
  maxDocumentsPerBot?: number;
  maxKnowledgeStorageMb?: number;
  maxMetaFlowsPerBot?: number;
  maxVisualFlowsPerBot?: number;
  maxFlowNodes?: number;
  maxActiveFlowRuns?: number;
  maxChannelsPerBot?: number;
  maxActiveWebChatSessions?: number;
  maxConcurrentLiveKitCalls?: number;
  maxVoicebotMinutesPerMonth?: number;
  maxCalendarAppsPerTenant?: number;
  maxPaymentsAppsPerTenant?: number;
  maxCatalogAppsPerTenant?: number;
  maxProductsPerBot?: number;
  maxOrdersPerMonth?: number;
  canCustomizeBranding?: boolean;
  apiRateLimitPerMinute?: number;
  apiRateLimitPerDay?: number;
}

export interface ResellerConfig {
  maxSubaccounts: number;
  defaultSubaccountPlan: "free" | "pro" | "enterprise";
  customDomain?: string;
  customDomainStatus?: CustomDomainStatus;
  allowSubaccountBranding: boolean;
  limitsOverride?: ResellerLimitsOverride;
}

export interface ResellerPlanDefaults {
  maxSubaccounts: number;
  defaultSubaccountPlan: "free" | "pro" | "enterprise";
  allowSubaccountBranding: boolean;
  limitsOverride?: ResellerLimitsOverride;
}

export interface InboxSlaSettings {
  enabled: boolean;
  firstResponseMinutes: number;
}

export type ReportScheduleFrequency = "daily" | "weekly";

export interface MetricsReportSchedule {
  enabled: boolean;
  frequency: ReportScheduleFrequency;
  recipients: string[];
  hour: number;
  dayOfWeek?: number;
  timezone: string;
  lastSentAt?: string;
}

export type InboxSlaStatus = "disabled" | "ok" | "at_risk" | "breached" | "met" | "missed";

export interface InboxSlaAdvisorMetric {
  advisorId: string;
  metCount: number;
  missedCount: number;
  complianceRate: number;
}

export interface InboxSlaMetrics {
  enabled: boolean;
  firstResponseMinutes?: number;
  openBreached: number;
  openAtRisk: number;
  metCount: number;
  missedCount: number;
  complianceRate: number;
  averageResponseSeconds: number;
  byAdvisor: InboxSlaAdvisorMetric[];
}

export interface AdvisorWorkloadMetric {
  advisorId: string;
  name: string;
  open: number;
  new: number;
  pending: number;
  totalActive: number;
  slaBreached: number;
  slaAtRisk: number;
}

export interface AdvisorWorkloadUnassigned {
  count: number;
  open: number;
  new: number;
  pending: number;
  totalActive: number;
  slaBreached: number;
  slaAtRisk: number;
}

export interface AdvisorWorkloadMetrics {
  advisors: AdvisorWorkloadMetric[];
  unassigned: AdvisorWorkloadUnassigned;
}

export interface BulkHandoffItem {
  conversationId: string;
  botId: string;
}

export interface BulkHandoffResult {
  succeeded: string[];
  failed: { conversationId: string; error: string }[];
}

export interface Tenant {
  tenantId: string;
  name: string;
  email: string;
  plan: TenantPlan;
  status: "active" | "suspended" | "pending";
  tenantKind?: TenantKind;
  parentTenantId?: string;
  resellerConfig?: ResellerConfig;
  branding?: TenantBranding;
  inboxSla?: InboxSlaSettings;
  metricsReportSchedule?: MetricsReportSchedule;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  currentPeriodEnd?: string;
  paymentProvider?: "stripe" | "wompi";
  onboardingCompletedAt?: string;
  onboardingSkippedAt?: string;
  onboardingTestConfirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyUsage {
  tenantId: string;
  period: string;
  messagesCount: number;
  bulkRecipientsCount: number;
  campaignsStarted: number;
  voicebotMinutesCount?: number;
}

export type Channel =
  | "whatsapp"
  | "instagram"
  | "webchat"
  | "telegram"
  | "messenger"
  | "sms"
  | "email"
  | "voicebot"
  | "phone";

export type TelephonyProvider = "telnyx";

export type TelephonyStructuredOutputType = "string" | "number" | "integer" | "boolean";

export interface TelephonyStructuredOutputField {
  name: string;
  type: TelephonyStructuredOutputType;
  description: string;
  required?: boolean;
}

export interface TelephonyStructuredOutputPayload {
  name: string;
  result: Record<string, unknown>;
}

export interface TelephonyStructuredOutputDefinition {
  name: string;
  type?: "ai" | "regex";
  description?: string;
  schema?: Record<string, unknown>;
  patterns?: Record<string, string>;
}

export type TelephonyCallDirection = "inbound" | "outbound";

export type BotLocale = "es" | "en";

export type AiProvider = "openai" | "anthropic";

export type LocalizedText = string | Record<BotLocale, string>;

export interface Bot {
  botId: string;
  tenantId: string;
  name: string;
  defaultLocale?: BotLocale;
  responseMode: "none" | "openai" | "webhook";
  systemPrompt?: string;
  aiProvider?: AiProvider;
  model?: string;
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
  telegramEnabled?: boolean;
  telegramBotUsername?: string;
  messengerPageId?: string;
  smsEnabled?: boolean;
  smsOriginationNumber?: string;
  emailEnabled?: boolean;
  emailAddress?: string;
  emailInboundProvider?: "ses" | "imap";
  emailImapHost?: string;
  emailImapPort?: number;
  emailImapMailbox?: string;
  emailImapUseTls?: boolean;
  emailImapUsername?: string;
  emailImapConnectedAt?: string;
  emailImapLastSyncAt?: string;
  emailImapLastError?: string;
  emailImapPollingEnabled?: boolean;
  voicebotEnabled?: boolean;
  voicebotWidgetKey?: string;
  voicebotVoice?: string;
  voicebotModel?: string;
  voicebotGreeting?: string;
  voicebotSystemPrompt?: string;
  telephonyEnabled?: boolean;
  telephonyPhoneNumber?: string;
  telephonyVoiceId?: string;
  telephonyModel?: string;
  telephonyGreeting?: string;
  telephonySystemPrompt?: string;
  telephonyRecordingEnabled?: boolean;
  telephonyRecordingNotice?: string;
  telephonyHandoffEnabled?: boolean;
  telephonyVoiceFlowId?: string;
  telephonyWebhookUrl?: string;
  telephonyWebhookSecret?: string;
  telephonyWebhookEnabled?: boolean;
  telephonyWebhookEvents?: IntegrationEvent[];
  telephonyStructuredOutputs?: TelephonyStructuredOutputField[];
  telephonyStructuredOutputSchemaName?: string;
  telephonyStructuredOutput?: TelephonyStructuredOutputDefinition;
  whatsappOnboardingMode?: "cloud_api" | "coexistence";
  isOnBizApp?: boolean;
  platformType?: string;
  whatsappSyncStatus?: WhatsAppSyncStatus;
  whatsappDisconnectedAt?: string;
  whatsappDisconnectionReason?: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export type WhatsAppSyncPhaseStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "declined";

export interface WhatsAppSyncStatus {
  contacts?: WhatsAppSyncPhaseStatus;
  history?: WhatsAppSyncPhaseStatus;
  contactsRequestId?: string;
  historyRequestId?: string;
  historyProgress?: number;
  historyPhase?: number;
  startedAt?: string;
  completedAt?: string;
  lastError?: string;
}

export type HandoffMode = "bot" | "human";

export type HandoffReason = "manual" | "ai" | "webhook" | "no_ai";

export interface AiAssistantConfig {
  enabled: boolean;
  systemPrompt?: string;
  aiProvider?: AiProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  knowledgeEnabled?: boolean;
}

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
  copilotSummary?: string;
  detectedIntent?: string;
  copilotGeneratedAt?: string;
  messageCount: number;
  lastMessageAt: string;
  welcomeSentAt?: string;
  activeFlowRunId?: string;
  pendingMetaFlowId?: string;
  metaFlowToken?: string;
  emailSubject?: string;
  emailThreadMessageId?: string;
  locale?: BotLocale;
  createdAt: string;
}

export type MessageRole = "user" | "assistant" | "advisor" | "system";

export type MessageSource =
  | "panel"
  | "whatsapp_inbound"
  | "whatsapp_history"
  | "whatsapp_app_echo"
  | "instagram_inbound"
  | "webchat_inbound"
  | "telegram_inbound"
  | "messenger_inbound"
  | "sms_inbound"
  | "email_inbound"
  | "voicebot_inbound"
  | "phone_inbound";

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

export interface Macro {
  macroId: string;
  tenantId: string;
  botId: string;
  title: string;
  content: string;
  shortcut?: string;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export type MarketingConsent = "unknown" | "opt_in" | "opt_out";

export type ConsentSource = "manual" | "import" | "whatsapp_keyword" | "panel" | "mailrelay";

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
  csatAverage?: number;
  csatRatingCount?: number;
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
  history?: WhatsAppHistoryChunk[];
  state_sync?: WhatsAppStateSyncItem[];
  message_echoes?: WhatsAppMessageEcho[];
  errors?: Array<{ code: number; title?: string; message?: string }>;
}

export interface WhatsAppHistoryMetadata {
  phase: number;
  chunk_order: number;
  progress: number;
}

export interface WhatsAppHistoryThread {
  id: string;
  messages: WhatsAppHistoryMessage[];
}

export interface WhatsAppHistoryChunk {
  metadata?: WhatsAppHistoryMetadata;
  threads?: WhatsAppHistoryThread[];
  errors?: Array<{ code: number; title?: string; message?: string }>;
}

export interface WhatsAppHistoryContext {
  status?: string;
}

export interface WhatsAppHistoryMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  to?: string;
  text?: { body: string };
  image?: { id: string; mime_type?: string; caption?: string };
  audio?: { id: string; mime_type?: string };
  video?: { id: string; mime_type?: string; caption?: string };
  document?: { id: string; mime_type?: string; caption?: string };
  history_context?: WhatsAppHistoryContext;
}

export interface WhatsAppStateSyncItem {
  type: string;
  contact?: {
    full_name?: string;
    first_name?: string;
    phone_number: string;
  };
  action?: "add" | "remove";
  metadata?: { timestamp?: string };
}

export interface WhatsAppMessageEcho {
  from: string;
  to: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type?: string; caption?: string };
  audio?: { id: string; mime_type?: string };
  video?: { id: string; mime_type?: string; caption?: string };
  document?: { id: string; mime_type?: string; caption?: string };
}

export interface WhatsAppAccountUpdateValue {
  phone_number?: string;
  event?: string;
  waba_info?: { waba_id?: string; owner_business_id?: string };
  disconnection_info?: { reason?: string; initiated_by?: string };
}

export type WhatsAppSyncQueueJobType =
  | "start_sync"
  | "history_chunk"
  | "echo_batch"
  | "contact_batch"
  | "account_update";

export interface WhatsAppSyncQueueMessage {
  jobType: WhatsAppSyncQueueJobType;
  tenantId?: string;
  botId?: string;
  phoneNumberId?: string;
  s3Key?: string;
  payload?: Record<string, unknown>;
  dedupeKey?: string;
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
  | "terminated"
  | "voicemail";

export type CallRecordingStatus = "disabled" | "pending" | "processing" | "ready" | "failed";

export type CallCostStatus = "pending" | "partial" | "final";

export interface CallCostBreakdown {
  telnyxUsd?: number;
  platformUsd?: number;
  openaiUsd?: number;
  elevenlabsUsd?: number;
  recordingUsd?: number;
  totalUsd: number;
  currency: "USD";
  pricingVersion: string;
}

export interface CallUsageMetrics {
  openaiInputTokens?: number;
  openaiOutputTokens?: number;
  elevenlabsCharacters?: number;
}

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
  provider?: TelephonyProvider | "meta";
  channel?: "phone" | "whatsapp";
  callControlId?: string;
  conversationId?: string;
  startedAt?: string;
  endedAt?: string;
  recordingStatus?: CallRecordingStatus;
  recordingS3Key?: string;
  recordingDurationSeconds?: number;
  telnyxRecordingId?: string;
  extractedFields?: TelephonyStructuredOutputPayload;
  costStatus?: CallCostStatus;
  costBreakdown?: CallCostBreakdown;
  usageMetrics?: CallUsageMetrics;
  createdAt: string;
  updatedAt: string;
}

export type CallEventType =
  | "initiated"
  | "ringing"
  | "answered"
  | "voicemail_detected"
  | "recording_started"
  | "recording_saved"
  | "recording_failed"
  | "hangup"
  | "cost_pending"
  | "cost_partial"
  | "cost_finalized"
  | "tool_executed"
  | "error";

export interface CallEvent {
  eventId: string;
  tenantId: string;
  botId: string;
  callId: string;
  type: CallEventType;
  message?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type TelephonySessionStatus = "pending" | "ringing" | "active" | "ended" | "failed";

export interface TelephonySession {
  sessionId: string;
  callControlId: string;
  callId: string;
  tenantId: string;
  botId: string;
  conversationId: string;
  participantId: string;
  direction: TelephonyCallDirection;
  fromNumber: string;
  toNumber: string;
  status: TelephonySessionStatus;
  streamToken: string;
  locale: BotLocale;
  contactName?: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  ttl: number;
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
  is_echo?: boolean;
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

export interface TelegramInboundPayload {
  updateId: number;
  chatId: string;
  messageId: number;
  text: string;
  fromUsername?: string;
  fromFirstName?: string;
}

export interface MessengerInboundPayload {
  pageId: string;
  senderId: string;
  message: InstagramMessage;
}

export interface SmsInboundPayload {
  originationNumber: string;
  destinationNumber: string;
  messageBody: string;
  inboundMessageId: string;
}

export interface EmailAttachmentRef {
  attachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  s3Key: string;
  contentId?: string;
  disposition: "attachment" | "inline";
}

export interface EmailInboundPayload {
  from: string;
  fromName?: string;
  to: string;
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: EmailAttachmentRef[];
  rawMimeS3Key?: string;
  htmlS3Key?: string;
}

export interface EmailMessageMetadata {
  kind: "email";
  subject: string;
  from: string;
  fromName?: string;
  to: string;
  cc?: string[];
  textBody: string;
  htmlBody?: string;
  htmlS3Key?: string;
  hasAttachments: boolean;
  attachmentCount: number;
  attachments?: Array<{
    attachmentId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    disposition: "attachment" | "inline";
    contentId?: string;
  }>;
  inReplyTo?: string;
  messageId: string;
}

export interface InboundQueueMessage {
  channel: Channel;
  tenantId: string;
  botId: string;
  participantId: string;
  conversationKey: string;
  displayName?: string | undefined;
  replyToExternalId?: string | undefined;
  payload:
    | WhatsAppInboundPayload
    | InstagramInboundPayload
    | WebChatInboundPayload
    | TelegramInboundPayload
    | MessengerInboundPayload
    | SmsInboundPayload
    | EmailInboundPayload;
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

export type VoicebotSessionStatus = "active" | "ended";

export interface VoicebotSession {
  sessionId: string;
  callId: string;
  tenantId: string;
  botId: string;
  conversationId: string;
  participantId: string;
  status: VoicebotSessionStatus;
  ephemeralKey?: string;
  visitorName?: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
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
  attemptId?: string;
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
  homeTenantId?: string;
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

export type OutreachChannel = "whatsapp" | "sms";

export interface WhatsAppTemplate {
  templateId: string;
  tenantId: string;
  botId: string;
  channel?: "whatsapp";
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "APPROVED" | "PENDING" | "REJECTED";
  components: TemplateComponent[];
  metaTemplateId?: string;
  syncedAt: string;
  createdAt: string;
}

export interface SmsTemplate {
  templateId: string;
  tenantId: string;
  botId: string;
  channel: "sms";
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "APPROVED";
  body: string;
  createdAt: string;
  updatedAt: string;
}

export type MessageTemplate = WhatsAppTemplate | SmsTemplate;

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface CampaignBatchConfig {
  size: number;
  delaySeconds: number;
}

export interface Campaign {
  campaignId: string;
  tenantId: string;
  botId: string;
  name: string;
  channel?: OutreachChannel;
  templateName: string;
  language: string;
  status: CampaignStatus;
  segments: string[];
  scheduledAt?: string;
  batchConfig?: CampaignBatchConfig;
  batchVersion?: number;
  currentBatch?: number;
  nextBatchAt?: string;
  batchesDispatched?: number;
  total: number;
  sent: number;
  failed: number;
  deliveredCount: number;
  readCount: number;
  deliveryFailed: number;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  archivedAt?: string;
  requireOptIn?: boolean;
  requestDlr?: boolean;
}

export type SmsDlrSource = "campaign" | "template" | "api";

export interface SmsDlrReceipt {
  receiptId: string;
  tenantId: string;
  botId: string;
  source: SmsDlrSource;
  to: string;
  campaignId?: string;
  attemptId?: string;
  recipientKey?: string;
  templateName?: string;
  language?: string;
  telcoredMessageId?: string;
  finalDeliveryCode?: number;
  lastDeliveryCode?: number;
  lastIntermediateCode?: number;
  deliveryStatus?: string;
  sentAt?: string;
  dlrAt?: string;
  cost?: string;
  part?: string;
  errorCode?: string;
  sender?: string;
  sendError?: string;
  metricsApplied?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CampaignRecipientStatus = "pending" | "sent" | "replied" | "failed";

export type CampaignSendAttemptStatus =
  | "queued"
  | "compliance_blocked"
  | "send_failed"
  | "sent"
  | "delivered"
  | "read"
  | "delivery_failed";

export type CampaignSendFailureKind = "send" | "delivery" | "compliance";

export interface CampaignSendAttempt {
  attemptId: string;
  tenantId: string;
  campaignId: string;
  recipientKey?: string;
  to: string;
  channel: OutreachChannel;
  status: CampaignSendAttemptStatus;
  failureKind?: CampaignSendFailureKind;
  templateName: string;
  language: string;
  batchVersion?: number;
  batchIndex?: number;
  queuedAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  externalMessageId?: string;
  sendErrorCode?: number;
  sendErrorTitle?: string;
  sendErrorMessage?: string;
  deliveryErrorCode?: number;
  deliveryErrorTitle?: string;
  deliveryErrorMessage?: string;
  waMessageId?: string;
  waRecipientId?: string;
  smsReceiptId?: string;
  telcoredMessageId?: string;
  finalDeliveryCode?: number;
  lastDeliveryCode?: number;
  lastIntermediateCode?: number;
  deliveryStatus?: string;
  cost?: string;
  dlrAt?: string;
  part?: string;
  smsErrorCode?: string;
  sender?: string;
  repliedAt?: string;
  conversationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignMetrics {
  campaignId: string;
  updatedAt: string;
  replyRate: number;
  advisorResponseRate: number;
  averageWaitTimeSeconds: number;
  pendingWaitCount: number;
  conversionsByChannel: Record<Channel, number>;
  funnel: {
    sent: number;
    replied: number;
    handoff: number;
    advisorResponded: number;
    converted: number;
  };
}

export interface CampaignRecipient {
  to: string;
  components?: Array<{
    type: string;
    parameters?: Array<{ type: string; text?: string; image?: { link: string } }>;
  }>;
}

export type CampaignSQSMessageKind = "recipient" | "batch-complete";

export interface CampaignSQSBody {
  kind?: CampaignSQSMessageKind;
  campaignId: string;
  tenantId: string;
  botId: string;
  channel?: OutreachChannel;
  templateName: string;
  language: string;
  to?: string;
  recipientKey?: string;
  components?: CampaignRecipient["components"];
  batchVersion?: number;
  batchIndex?: number;
  requestDlr?: boolean;
}

export type BulkSendJobStatus = "queued" | "processing" | "completed" | "failed";

export interface BulkSendJob {
  jobId: string;
  tenantId: string;
  botId: string;
  channel?: OutreachChannel;
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
  channel?: OutreachChannel;
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
  | "form.submitted"
  | "lead.created"
  | "lead.converted"
  | "call.connect"
  | "call.status"
  | "call.terminated"
  | "call.recording.ready"
  | "call.cost.finalized"
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
  waitlistEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WaitlistScope = "slot" | "date";
export type WaitlistStatus = "active" | "contacted" | "fulfilled" | "cancelled";

export interface WaitlistEntry {
  waitlistId: string;
  tenantId: string;
  botId: string;
  scope: WaitlistScope;
  startAt?: string;
  isoDate?: string;
  contactPhone: string;
  contactName: string;
  notes?: string;
  status: WaitlistStatus;
  source: "public_link";
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
export type PaymentRequestSource =
  | "manual"
  | "flow"
  | "catalog_order"
  | "calendar_booking"
  | "quotation";

export interface SalesMetricsBySource {
  count: number;
  revenueInCents: number;
}

export interface SalesMetricsByBot {
  botId: string;
  botName: string;
  count: number;
  revenueInCents: number;
}

export interface SalesMetricsTopProduct {
  productKey: string;
  productId?: string;
  name: string;
  orderCount: number;
  quantity: number;
  revenueInCents: number;
}

export interface CustomerCsatMetrics {
  contactPhone: string;
  contactName?: string;
  averageCsat: number;
  ratingCount: number;
}

export interface SalesMetrics {
  from: string;
  to: string;
  totalRevenueInCents: number;
  paidCount: number;
  averageTicketInCents: number;
  bySource: Record<PaymentRequestSource, SalesMetricsBySource>;
  byBot: SalesMetricsByBot[];
  topProducts: SalesMetricsTopProduct[];
  topCustomersByCsat: CustomerCsatMetrics[];
}

export type QuotationStatus = "sent" | "paid" | "expired" | "cancelled";

export interface QuotationLineItem {
  description: string;
  quantity: number;
  unitPriceInCents: number;
  totalInCents: number;
}

export interface Quotation {
  quotationId: string;
  tenantId: string;
  botId: string;
  conversationId: string;
  contactPhone: string;
  contactName?: string;
  number: string;
  items: QuotationLineItem[];
  subtotalInCents: number;
  totalInCents: number;
  currency: "COP";
  notes?: string;
  validUntil?: string;
  status: QuotationStatus;
  paymentId?: string;
  pdfS3Key?: string;
  pdfDownloadUrl?: string;
  createdByAdvisorId?: string;
  sentAt: string;
  createdAt: string;
  updatedAt: string;
}

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
  quotationId?: string;
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
  configured?: boolean;
  enabled?: boolean;
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
  | "save_contact"
  | "create_lead"
  | "send_notification"
  | "end";

export type FlowTriggerType =
  | "keyword"
  | "first_message"
  | "any_message"
  | "web_form_submitted"
  | "voice_call";

export type FlowKind = "messaging" | "voice_ai";

export interface FlowHttpHeader {
  key: string;
  value: string;
}

export interface VoiceAgentHttpTool {
  tenantId: string;
  botId: string;
  toolId: string;
  name: string;
  description: string;
  httpUrl: string;
  httpMethod: "GET" | "POST" | "PATCH";
  httpBody?: string;
  httpHeaders?: FlowHttpHeader[];
  httpResponseVariable?: string;
  parametersJson: string;
  instruction?: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FlowNodeData {
  label?: string;
  triggerType?: FlowTriggerType;
  keywords?: string[];
  matchMode?: AutomationMatchMode;
  messageText?: LocalizedText;
  templateName?: string;
  templateLanguage?: string;
  templateVariables?: Record<string, string>;
  conditionVariable?: string;
  conditionOperator?: "contains" | "equals" | "not_equals";
  conditionValue?: string;
  buttons?: Array<{ id: string; title: LocalizedText }>;
  metaFlowId?: string;
  metaFlowCta?: LocalizedText;
  delaySeconds?: number;
  variableName?: string;
  variableValue?: string;
  httpUrl?: string;
  httpMethod?: "GET" | "POST" | "PATCH";
  httpBody?: string;
  httpHeaders?: FlowHttpHeader[];
  httpResponseVariable?: string;
  voiceToolName?: string;
  voiceToolDescription?: string;
  voiceToolParameters?: string;
  voiceInstruction?: string;
  flowVariables?: Record<string, string>;
  haltPipeline?: boolean;
  confirmationMessage?: LocalizedText;
  maxDaysToShow?: number;
  amountInCents?: number;
  paymentDescription?: LocalizedText;
  paymentMessageTemplate?: LocalizedText;
  waitForPayment?: boolean;
  catalogMessageText?: LocalizedText;
  productRetailerIds?: string[];
  multiProductHeader?: LocalizedText;
  multiProductBody?: LocalizedText;
  orderConfirmationMessage?: LocalizedText;
  formSamplePayload?: Record<string, unknown>;
  contactPhoneBinding?: string;
  contactNameBinding?: string;
  contactEmailBinding?: string;
  contactTags?: string[];
  leadPhoneBinding?: string;
  leadNameBinding?: string;
  leadEmailBinding?: string;
  leadTags?: string[];
  notificationChannel?: Channel;
  notificationRecipientBinding?: string;
  notificationMessageBinding?: string;
  notificationMessageText?: LocalizedText;
  notificationTemplateName?: string;
  notificationTemplateLanguage?: string;
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
  flowKind?: FlowKind;
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
export type FlowRunSource = "conversation" | "event";
export type FlowEventStatus = "accepted" | "processing" | "completed" | "failed";

export interface FlowRunStep {
  nodeId: string;
  at: string;
  output?: string;
  error?: string;
}

export interface FlowRun {
  runId: string;
  flowId: string;
  tenantId: string;
  botId: string;
  source?: FlowRunSource;
  conversationId?: string;
  customerPhone?: string;
  eventSubmissionId?: string;
  flowVersion?: number;
  formPayload?: Record<string, unknown>;
  errorMessage?: string;
  status: FlowRunStatus;
  currentNodeId: string;
  variables: Record<string, string>;
  stepHistory: FlowRunStep[];
  waitingUntil?: string;
  stepCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FlowHookConfig {
  hookKey: string;
  tenantId: string;
  flowId: string;
  botId: string;
  secretHash: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FlowHookCredentials {
  hookKey: string;
  secret: string;
  webhookUrl: string;
}

export interface FlowEventSubmission {
  submissionId: string;
  tenantId: string;
  flowId: string;
  hookKey: string;
  idempotencyKey?: string;
  payload: Record<string, unknown>;
  status: FlowEventStatus;
  runId?: string;
  errorMessage?: string;
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
  messageText?: LocalizedText;
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

export interface MailrelayCredentials {
  apiKey: string;
  webhookToken: string;
  baseUrl: string;
}

export interface MaskedMailrelayCredentials {
  configured: boolean;
  apiKey?: string;
  webhookToken?: string;
  baseUrl?: string;
  secretId?: string;
}

export interface MailrelayTagGroupMapping {
  tag: string;
  groupIds: number[];
}

export interface MailrelayConfig {
  tenantId: string;
  enabled: boolean;
  defaultSenderId?: number;
  tagGroupMappings: MailrelayTagGroupMapping[];
  defaultGroupIds: number[];
  eventTypes: string[];
  eventSubscriptionId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MailrelayGroup {
  id: number;
  name: string;
  [key: string]: unknown;
}

export interface MailrelaySender {
  id: number;
  name?: string;
  email?: string;
  [key: string]: unknown;
}

export interface MailrelaySubscriberLink {
  tenantId: string;
  subscriberId: number;
  email: string;
  phoneNumber?: string;
  syncedAt: string;
  updatedAt: string;
}

export type MailrelaySyncJobStatus = "queued" | "running" | "completed" | "completed_with_errors" | "failed";

export interface MailrelaySyncError {
  email?: string;
  message: string;
}

export interface MailrelaySyncJob {
  jobId: string;
  tenantId: string;
  status: MailrelaySyncJobStatus;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: MailrelaySyncError[];
  requestedBy?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface MailrelaySyncQueueMessage {
  tenantId: string;
  jobId: string;
  cursor?: string;
}

export interface MailrelayCampaignRecord {
  tenantId: string;
  campaignId: number;
  subject?: string;
  status?: string;
  remote: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MailrelayCampaignMetrics {
  tenantId: string;
  campaignId: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  complained: number;
  updatedAt: string;
}

export interface MailrelayEvent {
  eventId: string;
  tenantId: string;
  type: string;
  campaignId?: number;
  subscriberId?: number;
  email?: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}
