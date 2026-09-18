export type TenantPlan = "free" | "starter" | "pro" | "scale" | "reseller";

export type TenantKind = "standard" | "reseller" | "subaccount";

export const SUBACCOUNT_SERVICES = [
  "bots",
  "voiceAgents",
  "contactCenter",
  "conversations",
  "supervisor",
  "contacts",
  "leads",
  "sales",
  "advisors",
  "automations",
  "flows",
  "templates",
  "bulkSend",
  "campaigns",
  "emailMarketing",
  "metrics",
  "apps",
  "developer",
  "integrations",
] as const;

export type SubaccountServiceId = (typeof SUBACCOUNT_SERVICES)[number];

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
  maxWhatsAppChannelsPerBot?: number;
  maxActiveWebChatSessions?: number;
  maxConcurrentLiveKitCalls?: number;
  maxVoicebotMinutesPerMonth?: number;
  maxCalendarAppsPerTenant?: number;
  maxPaymentsAppsPerTenant?: number;
  maxCatalogAppsPerTenant?: number;
  maxHostedFormsPerTenant?: number;
  maxProductsPerBot?: number;
  maxOrdersPerMonth?: number;
  canCustomizeBranding?: boolean;
  apiRateLimitPerMinute?: number;
  apiRateLimitPerDay?: number;
}

export interface ResellerConfig {
  maxSubaccounts: number;
  defaultSubaccountPlan: "free" | "starter" | "pro" | "scale";
  customDomain?: string;
  customDomainStatus?: CustomDomainStatus;
  allowSubaccountBranding: boolean;
  limitsOverride?: ResellerLimitsOverride;
}

export interface ResellerPlanDefaults {
  maxSubaccounts: number;
  defaultSubaccountPlan: "free" | "starter" | "pro" | "scale";
  allowSubaccountBranding: boolean;
  limitsOverride?: ResellerLimitsOverride;
}

export interface PlatformBillingConfig {
  pricePerMessageCents: number;
  currency: "COP";
  updatedAt?: string;
}

export interface AdminBillingOverviewRow {
  tenantId: string;
  name: string;
  email: string;
  plan: TenantPlan;
  period: string;
  messagesCount: number;
  bulkRecipientsCount: number;
  pricePerMessageCents: number;
  usesPlatformPrice: boolean;
  estimatedMessageCostCents: number;
}

export interface AdminBillingOverview {
  config: PlatformBillingConfig;
  period: string;
  rows: AdminBillingOverviewRow[];
  totals: {
    messagesCount: number;
    bulkRecipientsCount: number;
    estimatedMessageCostCents: number;
  };
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

export interface WebsiteAnalyticsSettings {
  enabled: boolean;
  googleAnalyticsMeasurementId?: string;
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
  enabledServices?: SubaccountServiceId[];
  serviceLimits?: ResellerLimitsOverride;
  resellerConfig?: ResellerConfig;
  branding?: TenantBranding;
  inboxSla?: InboxSlaSettings;
  metricsReportSchedule?: MetricsReportSchedule;
  websiteAnalytics?: WebsiteAnalyticsSettings;
  law2300Exempt?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  currentPeriodEnd?: string;
  paymentProvider?: "stripe" | "wompi";
  pricePerMessageCents?: number;
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
  voicebotTranscriptionModel?: string;
  voicebotGreeting?: string;
  voicebotSystemPrompt?: string;
  telephonyEnabled?: boolean;
  telephonyPhoneNumber?: string;
  telephonyVoiceId?: string;
  telephonyBackgroundSound?: string;
  telephonyBackgroundSoundVolume?: number;
  telephonyTtsModel?: string;
  telephonyVoiceSpeed?: number;
  telephonyVoiceStability?: number;
  telephonyVoiceSimilarity?: number;
  telephonyTranscriptionVadThreshold?: number;
  telephonyTranscriptionSilenceMs?: number;
  telephonyTranscriptionBargeIn?: boolean;
  telephonyModel?: string;
  telephonyTranscriptionModel?: string;
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
  telephonyRoutingMode?: TelephonyRoutingMode;
  telephonyQueueId?: string;
  telephonyIvrFlowId?: string;
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

export type WhatsAppChannelStatus = "active" | "pending_registration" | "disconnected";

export type WhatsAppEnforcementSource = "meta_auto" | "platform_admin" | "reseller";

export type WhatsAppOutboundSendKind = "marketing" | "transactional" | "service";

export interface WhatsAppQualitySnapshot {
  qualityRating: "GREEN" | "YELLOW" | "RED" | "NA";
  phoneStatus: string;
  risk: "ok" | "warn" | "block";
  source: "webhook" | "poll" | "manual";
  updatedAt: string;
  rawEvent?: string;
}

export interface WhatsAppMessagingEnforcement {
  blocked: boolean;
  reason?: string;
  event?: string;
  source?: WhatsAppEnforcementSource;
  blockedAt?: string;
  blockedBy?: string;
  clearedAt?: string;
  clearedBy?: string;
}

export type MetaAppCredentialSource = "own" | "reseller" | "platform" | "none";

export interface MetaAppConfigStatus {
  configured: boolean;
  source: MetaAppCredentialSource;
  ownerTenantId?: string;
  appId?: string;
  embeddedSignupConfigId?: string;
  webhookUrl?: string;
  webhookVerifyToken?: string;
}

export interface WhatsAppAccount {
  accountId: string;
  tenantId: string;
  wabaId: string;
  label?: string;
  status: "active" | "inactive";
  metaAppId?: string;
  metaAppOwnerTenantId?: string;
  messagingEnforcement?: WhatsAppMessagingEnforcement;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppChannel {
  channelId: string;
  tenantId: string;
  botId: string;
  accountId: string;
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
  displayPhoneNumber?: string;
  label?: string;
  status: WhatsAppChannelStatus;
  isDefault: boolean;
  whatsappOnboardingMode?: "cloud_api" | "coexistence";
  isOnBizApp?: boolean;
  platformType?: string;
  whatsappSyncStatus?: WhatsAppSyncStatus;
  whatsappDisconnectedAt?: string;
  whatsappDisconnectionReason?: string;
  qualitySnapshot?: WhatsAppQualitySnapshot;
  messagingEnforcement?: WhatsAppMessagingEnforcement;
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

export type InteractionCategory =
  | "sale"
  | "complaint"
  | "callback"
  | "support"
  | "inquiry"
  | "billing"
  | "other";

export const INTERACTION_CATEGORIES: InteractionCategory[] = [
  "sale",
  "complaint",
  "callback",
  "support",
  "inquiry",
  "billing",
  "other",
];

export interface Conversation {
  conversationId: string;
  tenantId: string;
  botId: string;
  channel: Channel;
  participantId: string;
  phoneNumber: string;
  contactId?: string;
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
  interactionCategory?: InteractionCategory;
  interactionCategoryAt?: string;
  attribution?: AdsAttribution;
  messageCount: number;
  lastMessageAt: string;
  welcomeSentAt?: string;
  activeFlowRunId?: string;
  pendingMetaFlowId?: string;
  metaFlowToken?: string;
  emailSubject?: string;
  emailThreadMessageId?: string;
  whatsappChannelId?: string;
  businessPhoneNumberId?: string;
  whatsappDisplayNumber?: string;
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

export interface MessageReaction {
  emoji: string;
  userId: string;
  role: "user" | "advisor";
  timestamp: string;
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
  callId?: string;
  reactions?: MessageReaction[];
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
  skills?: string[];
  queueIds?: string[];
  voiceEnabled?: boolean;
  lastAssignedAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type TenantMemberRole = "member" | "supervisor" | "advisor";

export interface TenantMember {
  userId: string;
  username: string;
  email: string;
  name: string;
  role: TenantMemberRole;
  enabled: boolean;
  createdAt: string;
  advisorId?: string;
  teamIds?: string[];
  lastLoginAt?: string;
  profilePhotoS3Key?: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  role: TenantMemberRole;
  profilePhotoUrl?: string;
}

export interface OrganizationTeam {
  teamId: string;
  tenantId: string;
  name: string;
  description?: string;
  status: "active" | "inactive";
  supervisorUserIds: string[];
  memberUserIds: string[];
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
  country?: string;
  company?: string;
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
  attribution?: AdsAttribution;
  createdAt: string;
  updatedAt: string;
}

export type OpportunityStage = "new" | "quoted" | "negotiation" | "won" | "lost";

export interface PipelineStage {
  stageId: string;
  key: string;
  label: string;
  sortOrder: number;
  probability?: number;
  isClosed?: boolean;
  outcome?: "won" | "lost";
}

export interface SalesPipeline {
  pipelineId: string;
  tenantId: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
  createdAt: string;
  updatedAt: string;
}

export type OpportunityLossReason =
  | "price"
  | "competition"
  | "no_response"
  | "timing"
  | "not_qualified"
  | "other";

export type AdsAttributionSource = "meta_ctwa" | "meta_lead_ads" | "utm" | "web_form";

export interface AdsAttribution {
  source: AdsAttributionSource;
  adId?: string;
  adSourceId?: string;
  adSetId?: string;
  formId?: string;
  ctwaClid?: string;
  headline?: string;
  body?: string;
  sourceUrl?: string;
  sourceType?: string;
  mediaType?: string;
  imageUrl?: string;
  campaignId?: string;
  flowId?: string;
  submissionId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingPage?: string;
  shortLinkId?: string;
  shortLinkSlug?: string;
}

export interface OpportunityAttribution {
  source?: string;
  campaignId?: string;
  flowId?: string;
  submissionId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingPage?: string;
}

export interface Company {
  companyId: string;
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Opportunity {
  opportunityId: string;
  tenantId: string;
  pipelineId: string;
  stageId: string;
  botId?: string;
  title: string;
  amount?: number;
  currency: string;
  stage: OpportunityStage;
  phone?: string;
  name?: string;
  email?: string;
  description?: string;
  tags: string[];
  leadId?: string;
  conversationId?: string;
  sourceId?: string;
  assignedAdvisorId?: string;
  quotationId?: string;
  paymentId?: string;
  companyId?: string;
  companyName?: string;
  expectedCloseDate?: string;
  stageEnteredAt?: string;
  lastActivityAt?: string;
  lossReason?: OpportunityLossReason;
  attribution?: OpportunityAttribution;
  closedAt?: string;
  closeReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type OpportunityActivityType =
  | "created"
  | "stage_changed"
  | "assigned"
  | "note_updated"
  | "task_created"
  | "task_done"
  | "sequence_step"
  | "quotation_sent"
  | "payment_paid"
  | "message"
  | "closed";

export interface OpportunityActivityEvent {
  activityId: string;
  opportunityId: string;
  tenantId: string;
  type: OpportunityActivityType;
  message?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface OpportunityEnriched extends Opportunity {
  daysInStage: number;
  forecastAmount: number;
}

export interface OpportunityDetail {
  opportunity: OpportunityEnriched;
  pipeline?: Pick<SalesPipeline, "pipelineId" | "name" | "stages">;
  company?: Company;
  advisor?: { advisorId: string; name: string };
  lead?: Lead;
  contact?: Contact;
  conversation?: Pick<
    Conversation,
    | "conversationId"
    | "botId"
    | "channel"
    | "phoneNumber"
    | "contactName"
    | "status"
    | "lastMessageAt"
    | "workflowStatus"
    | "assignedAdvisorId"
  >;
  quotation?: Quotation;
  payment?: PaymentRequest;
  quotations?: Quotation[];
  payments?: PaymentRequest[];
  tasks: SalesTask[];
  enrollments: SequenceEnrollment[];
  stageHistory: OpportunityStageHistoryEntry[];
}

export interface OpportunityStageHistoryEntry {
  historyId: string;
  opportunityId: string;
  tenantId: string;
  fromStageId?: string;
  toStageId: string;
  fromStageKey?: string;
  toStageKey: string;
  changedBy?: string;
  changedAt: string;
}

export type SequenceStepChannel = "whatsapp" | "email" | "task";

export interface SalesSequenceStep {
  stepId: string;
  order: number;
  delayMinutes: number;
  channel: SequenceStepChannel;
  messageText?: string;
  templateName?: string;
  templateLanguage?: string;
  emailSubject?: string;
  taskTitle?: string;
  taskDescription?: string;
  taskDueMinutes?: number;
  assignToAdvisor?: boolean;
}

export type SalesSequenceTrigger = "manual" | "stage_entered" | "opportunity_created";

export interface SalesSequence {
  sequenceId: string;
  tenantId: string;
  name: string;
  enabled: boolean;
  trigger: SalesSequenceTrigger;
  triggerStageId?: string;
  pipelineId?: string;
  steps: SalesSequenceStep[];
  createdAt: string;
  updatedAt: string;
}

export type SequenceEnrollmentStatus = "active" | "paused" | "completed" | "cancelled";

export interface SequenceEnrollment {
  enrollmentId: string;
  tenantId: string;
  sequenceId: string;
  opportunityId: string;
  contactPhone?: string;
  contactEmail?: string;
  currentStepIndex: number;
  status: SequenceEnrollmentStatus;
  nextRunAt?: string;
  scheduleName?: string;
  botId?: string;
  assignedAdvisorId?: string;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type SalesTaskStatus = "open" | "done" | "cancelled";

export interface SalesTask {
  taskId: string;
  tenantId: string;
  opportunityId?: string;
  enrollmentId?: string;
  advisorId?: string;
  title: string;
  description?: string;
  dueAt?: string;
  status: SalesTaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SalesFunnelMetrics {
  pipelineId: string;
  total: number;
  totalValue: number;
  wonValue: number;
  forecastValue: number;
  conversionRate: number;
  byStage: Array<{
    stageId: string;
    key: string;
    label: string;
    count: number;
    value: number;
    probability?: number;
  }>;
  funnel: Record<string, number>;
}

export interface OpportunitiesListResponse {
  items: Opportunity[];
  nextCursor?: string;
}

export interface SalesTasksListResponse {
  items: SalesTask[];
  nextCursor?: string;
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
  violation_info?: { violation_type?: string };
  restriction_info?: Array<{ restriction_type?: string; expiration?: number }>;
  ban_info?: { waba_ban_state?: string; waba_ban_date?: string };
}

export type WhatsAppSyncQueueJobType =
  | "start_sync"
  | "history_chunk"
  | "echo_batch"
  | "contact_batch"
  | "account_update"
  | "phone_quality_update"
  | "account_alert";

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
  sttUsd?: number;
  recordingUsd?: number;
  totalUsd: number;
  currency: "USD";
  pricingVersion: string;
}

export interface CallUsageMetrics {
  openaiInputTokens?: number;
  openaiOutputTokens?: number;
  elevenlabsCharacters?: number;
  elevenlabsModelId?: string;
  sttProvider?: string;
  sttModelId?: string;
  sttAudioSeconds?: number;
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
  queueId?: string;
  advisorId?: string;
  conferenceId?: string;
  disposition?: string;
  ivrPath?: string;
  waitSeconds?: number;
  talkSeconds?: number;
  contactCenterMode?: ContactCenterCallMode;
  supervisorAdvisorId?: string;
  campaignId?: string;
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
  | "error"
  | "queued"
  | "offered"
  | "agent_answered"
  | "transferred"
  | "supervised"
  | "wrap_up"
  | "dtmf"
  | "overflow"
  | "callback";

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
  mode?: ContactCenterCallMode;
  queueId?: string;
  conferenceId?: string;
  advisorId?: string;
  agentCallControlId?: string;
  supervisorCallControlId?: string;
  supervisorRole?: SupervisorRole;
  ivrFlowId?: string;
  ivrNodeId?: string;
  campaignId?: string;
  consultCallControlId?: string;
  contactCenterPhase?: ContactCenterPhase;
}

export type ContactCenterPhase =
  | "voicemail_prompt"
  | "voicemail_recording"
  | "callback_offer"
  | "callback_queued";

export type TelephonyRoutingMode = "ai" | "ivr" | "queue";

export type ContactCenterCallMode = "ai" | "queue" | "ivr" | "agent";

export type AgentPresenceState =
  | "offline"
  | "available"
  | "ringing"
  | "on_call"
  | "wrap_up"
  | "break";

export type QueueStrategy = "longest_idle" | "round_robin" | "fewest_calls";

export type QueueFallbackAction = "ai" | "voicemail" | "hangup" | "callback";

export type AfterHoursAction = QueueFallbackAction;

export type OverflowAction = QueueFallbackAction;

export type IvrNodeType = "menu" | "queue" | "ai" | "hangup" | "voicemail";

export type VoiceCampaignMode = "preview" | "progressive";

export type VoiceCampaignStatus = "draft" | "running" | "paused" | "completed" | "cancelled";

export type SupervisorRole = "monitor" | "whisper" | "barge";

export interface QueueDayHours {
  start: string;
  end: string;
}

export interface QueueBusinessHours {
  timezone: string;
  days: Record<string, QueueDayHours | null>;
}

export interface ContactCenterQueue {
  queueId: string;
  tenantId: string;
  botId: string;
  name: string;
  strategy: QueueStrategy;
  skills: string[];
  slaSeconds: number;
  maxWaitSeconds?: number;
  holdAudioUrl?: string;
  overflowQueueId?: string;
  afterHoursAction: AfterHoursAction;
  overflowAction?: OverflowAction;
  announcePosition?: boolean;
  callbackEnabled?: boolean;
  hours?: QueueBusinessHours;
  wrapUpSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IvrMenuOption {
  digit: string;
  targetType: IvrNodeType;
  targetId?: string;
}

export interface IvrNode {
  nodeId: string;
  type: IvrNodeType;
  prompt?: string;
  options?: IvrMenuOption[];
  queueId?: string;
  timeoutSeconds?: number;
}

export interface ContactCenterIvrFlow {
  ivrFlowId: string;
  tenantId: string;
  botId: string;
  name: string;
  entryNodeId: string;
  nodes: IvrNode[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentPresence {
  advisorId: string;
  tenantId: string;
  state: AgentPresenceState;
  skills: string[];
  queueIds: string[];
  webrtcConnected: boolean;
  lastHeartbeatAt: string;
  telnyxSipUsername?: string;
  telnyxCredentialId?: string;
  lastCallAt?: string;
  callsHandled?: number;
  wrapUpUntil?: string;
  cognitoUserId?: string;
  kind?: "advisor" | "member";
  updatedAt: string;
}

export interface QueueMembership {
  membershipId: string;
  tenantId: string;
  queueId: string;
  callId: string;
  sessionId: string;
  botId: string;
  priority: number;
  queuedAt: string;
  callbackNumber?: string;
  expiresAt?: string;
}

export interface VoiceCampaign {
  campaignId: string;
  tenantId: string;
  botId: string;
  name: string;
  mode: VoiceCampaignMode;
  status: VoiceCampaignStatus;
  fromNumber: string;
  queueId: string;
  recipients: string[];
  nextIndex: number;
  amdEnabled: boolean;
  dispositions?: string[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface VoiceCampaignAttempt {
  attemptId: string;
  tenantId: string;
  campaignId: string;
  to: string;
  callId?: string;
  status: "queued" | "dialing" | "connected" | "voicemail" | "failed" | "no_answer";
  disposition?: string;
  createdAt: string;
}

export interface ContactCenterWallboard {
  agents: Array<{
    advisorId: string;
    name: string;
    state: AgentPresenceState;
    queueIds: string[];
    webrtcConnected: boolean;
    callsHandled: number;
    currentCallId?: string;
  }>;
  queues: Array<{
    queueId: string;
    name: string;
    waiting: number;
    longestWaitSeconds: number;
    slaSeconds: number;
  }>;
  liveCalls: Array<{
    callId: string;
    queueId?: string;
    advisorId?: string;
    fromNumber: string;
    conferenceId?: string;
    startedAt?: string;
    waitSeconds?: number;
  }>;
  metrics: {
    availableAgents: number;
    callsInQueue: number;
    callsLive: number;
    abandonRate: number;
    averageSpeedOfAnswerSeconds: number;
  };
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

export interface WhatsAppReferral {
  source_url?: string;
  source_type?: string;
  source_id?: string;
  headline?: string;
  body?: string;
  media_type?: string;
  image_url?: string;
  ctwa_clid?: string;
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
    | "order"
    | "reaction";
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string };
  interactive?: WhatsAppInteractiveReply;
  order?: WhatsAppOrderPayload;
  referral?: WhatsAppReferral;
  reaction?: {
    message_id: string;
    emoji: string;
  };
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

export interface MetaLeadgenWebhookChange {
  field: "leadgen";
  value: {
    ad_id?: string;
    form_id?: string;
    leadgen_id: string;
    created_time: number;
    page_id: string;
    adgroup_id?: string;
  };
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
    changes?: MetaLeadgenWebhookChange[];
  }>;
}

export interface WebChatInboundPayload {
  messageId: string;
  text: string;
  sessionId: string;
}

export interface WhatsAppInboundPayload {
  phoneNumberId: string;
  whatsappChannelId?: string;
  whatsappAccountId?: string;
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

export interface DocumentMessageMetadata {
  kind: "document" | "image" | "audio";
  filename: string;
  mimeType: string;
  s3Key: string;
  quotationId?: string;
  downloadUrl?: string;
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

export type WebChatSessionStatus = "active" | "ended";

export interface WebChatSession {
  sessionId: string;
  tenantId: string;
  botId: string;
  conversationId: string;
  visitorName?: string;
  visitorPhone?: string;
  visitorEmail?: string;
  status?: WebChatSessionStatus;
  endedAt?: string;
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
  visitorPhone?: string;
  visitorEmail?: string;
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
  role: "admin" | "member" | "supervisor" | "advisor";
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

export type SmsHistoryStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "delivery_failed"
  | "send_failed";

export interface SmsHistoryItem {
  receiptId: string;
  to: string;
  source: SmsDlrSource;
  status: SmsHistoryStatus;
  templateName: string | null;
  campaignId: string | null;
  botId: string;
  createdAt: string;
  dlrAt: string | null;
  telcoredMessageId: string | null;
  sendError: string | null;
}

export interface SmsHistoryPage {
  items: SmsHistoryItem[];
  nextCursor?: string;
}

export interface SmsOverview {
  enabledBots: number;
  activeCampaigns: number;
  campaignSent: number;
  campaignFailed: number;
  campaignDelivered: number;
  campaignDeliveryFailed: number;
  bulkJobs: number;
  bulkSent: number;
  bulkFailed: number;
  dlrDelivered: number;
  dlrFailed: number;
  dlrPending: number;
  dlrSent: number;
  deliveryRate: number;
}

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
  requireOptIn?: boolean;
  outboundKind?: WhatsAppOutboundSendKind;
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
  requireOptIn?: boolean;
  outboundKind?: WhatsAppOutboundSendKind;
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

export interface ChannelUsageMetrics {
  channel: Channel;
  conversations: number;
  messages: number;
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
  byChannel: ChannelUsageMetrics[];
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

export interface ConversationCategoryMetricRow {
  category: InteractionCategory | "uncategorized";
  count: number;
}

export interface ConversationCategoryMetrics {
  from: string;
  to: string;
  total: number;
  categorized: number;
  uncategorized: number;
  byCategory: ConversationCategoryMetricRow[];
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

export interface WebsiteMetricsSummary {
  pageviews: number;
  uniqueVisitors: number;
  sessions: number;
}

export interface WebsiteMetricsDailyRow {
  date: string;
  pageviews: number;
  uniqueVisitors: number;
  sessions: number;
}

export interface WebsiteMetricsTopRow {
  key: string;
  label: string;
  count: number;
}

export interface WebsiteMetricsBotRow {
  botId: string;
  botName: string;
  pageviews: number;
}

export interface WebsiteMetrics {
  from: string;
  to: string;
  windowDays: number;
  summary: WebsiteMetricsSummary;
  dailyTrend: WebsiteMetricsDailyRow[];
  topPages: WebsiteMetricsTopRow[];
  topReferrers: WebsiteMetricsTopRow[];
  byBot: WebsiteMetricsBotRow[];
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
  | "opportunity.created"
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

export type CalendarProviderType = "native" | "google";
export type GoogleCalendarStatus = "pending" | "active" | "error";
export type ExternalSyncStatus = "pending" | "synced" | "failed";

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
  googleAccountEmail?: string;
  googleCalendarId?: string;
  googleCalendarName?: string;
  googleStatus?: GoogleCalendarStatus;
  googleConnectedAt?: string;
  blockExternalEvents?: boolean;
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
  meetingLink?: string;
  externalSyncStatus?: ExternalSyncStatus;
  externalSyncedAt?: string;
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
  | "create_opportunity"
  | "send_notification"
  | "assign_bot"
  | "webhook"
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
  opportunityTitleBinding?: string;
  opportunityAmountBinding?: string;
  opportunityCurrency?: string;
  opportunityStage?: OpportunityStage;
  opportunityPhoneBinding?: string;
  opportunityNameBinding?: string;
  opportunityEmailBinding?: string;
  opportunityDescriptionBinding?: string;
  opportunityTags?: string[];
  notificationChannel?: Channel;
  notificationMessageType?: "text" | "template";
  notificationRecipientBinding?: string;
  notificationRecipientBindings?: string[];
  notificationMessageBinding?: string;
  notificationMessageText?: LocalizedText;
  notificationMessageHtml?: LocalizedText;
  notificationEmailSubject?: string;
  notificationTemplateName?: string;
  notificationTemplateLanguage?: string;
  notificationTemplateVariables?: Record<string, string>;
  notificationBotId?: string;
  botId?: string;
  webhookUrl?: string;
  webhookBody?: string;
  webhookHeaders?: FlowHttpHeader[];
  webhookResponseVariable?: string;
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
  botId?: string;
  name: string;
  flowKind?: FlowKind;
  enabled: boolean;
  version: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  entryNodeId: string;
  draftNodes?: FlowNode[];
  draftEdges?: FlowEdge[];
  draftEntryNodeId?: string;
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
  botId?: string;
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
  botId?: string;
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

export interface FlowEventRequestSnapshot {
  method: string;
  path: string;
  headers: Record<string, string>;
  queryString?: Record<string, string>;
  bodyRaw?: string;
  sourceIp?: string;
  userAgent?: string;
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
  request?: FlowEventRequestSnapshot;
  createdAt: string;
  updatedAt: string;
}

export type FlowActivityKind = "run" | "event";

export interface FlowActivitySummary {
  activityId: string;
  kind: FlowActivityKind;
  flowId: string;
  status: FlowRunStatus | FlowEventStatus;
  source?: FlowRunSource | "webhook";
  createdAt: string;
  updatedAt: string;
  runId?: string;
  submissionId?: string;
  conversationId?: string;
  customerPhone?: string;
  stepCount?: number;
  errorMessage?: string;
  payloadPreview?: string;
  hookKey?: string;
  idempotencyKey?: string;
}

export const HOSTED_FORM_FIELD_TYPES = [
  "text",
  "email",
  "phone",
  "textarea",
  "number",
  "select",
  "checkbox",
  "radio",
  "date",
  "hidden",
] as const;

export type HostedFormFieldType = (typeof HOSTED_FORM_FIELD_TYPES)[number];

export interface HostedFormFieldOption {
  value: string;
  label: string;
}

export interface HostedFormField {
  id: string;
  type: HostedFormFieldType;
  name: string;
  label: string;
  placeholder?: string;
  helperText?: string;
  required: boolean;
  options?: HostedFormFieldOption[];
  defaultValue?: string;
}

export interface HostedFormCrmMapping {
  name?: string;
  email?: string;
  phone?: string;
}

export interface HostedForm {
  formId: string;
  tenantId: string;
  botId?: string;
  name: string;
  description?: string;
  published: boolean;
  publicKey: string;
  fields: HostedFormField[];
  submitLabel: string;
  successTitle: string;
  successMessage: string;
  redirectUrl?: string;
  flowId?: string;
  crmMapping: HostedFormCrmMapping;
  createLeadOnSubmit: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FormAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingPage?: string;
  shortLinkId?: string;
  shortLinkSlug?: string;
}

export interface HostedFormSubmission {
  submissionId: string;
  tenantId: string;
  formId: string;
  payload: Record<string, unknown>;
  leadId?: string;
  flowSubmissionId?: string;
  attribution?: FormAttribution;
  createdAt: string;
}

export interface ShortLinkUtm {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

export interface ShortLink {
  linkId: string;
  tenantId: string;
  name: string;
  slug: string;
  destinationUrl: string;
  enabled: boolean;
  campaignId?: string;
  utm: ShortLinkUtm;
  clickCount: number;
  lastClickedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShortLinkClick {
  clickId: string;
  linkId: string;
  tenantId: string;
  slug: string;
  clickedAt: string;
  userAgent?: string;
  referer?: string;
  ip?: string;
}

export type TenantEmailDomainStatus = "none" | "pending" | "verified" | "failed";

export interface TenantEmailDnsRecord {
  type: string;
  name: string;
  value: string;
  purpose: "verification" | "dkim";
}

export interface TenantEmailSettings {
  tenantId: string;
  enabled: boolean;
  domain?: string;
  domainStatus?: TenantEmailDomainStatus;
  fromEmail?: string;
  fromName?: string;
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
export type AutomationAction =
  | "send_text"
  | "send_template"
  | "tag_contact"
  | "handoff"
  | "set_consent";
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
  marketingConsent?: MarketingConsent;
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

export interface MailrelayEmailTemplate {
  templateId: string;
  tenantId: string;
  name: string;
  subject: string;
  previewText?: string;
  html: string;
  createdAt: string;
  updatedAt: string;
}

export interface MailrelayOverview {
  subscriberCount: number;
  draftCampaigns: number;
  sentCampaigns: number;
  templateCount: number;
  averageOpenRate: number;
  averageClickRate: number;
  lastSyncAt?: string;
  lastSyncStatus?: MailrelaySyncJobStatus;
}
