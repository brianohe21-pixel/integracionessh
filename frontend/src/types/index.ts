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

export interface TenantEmailSettingsResponse {
  settings: TenantEmailSettings;
  dnsRecords?: TenantEmailDnsRecord[];
  canSend: boolean;
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
  defaultSubaccountPlan: "free" | "starter" | "pro";
  customDomain?: string;
  customDomainStatus?: CustomDomainStatus;
  allowSubaccountBranding: boolean;
  limitsOverride?: ResellerLimitsOverride;
}

export interface ResellerPlanDefaults {
  maxSubaccounts: number;
  defaultSubaccountPlan: "free" | "starter" | "pro";
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
  planLimitsOverride?: ResellerLimitsOverride;
  resellerConfig?: ResellerConfig;
  branding?: TenantBranding;
  inboxSla?: InboxSlaSettings;
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
  onboardingBannerDismissedAt?: string;
  onboardingTestConfirmedAt?: string;
  createdAt: string;
  updatedAt: string;
  resolvedBranding?: ResolvedTenantBranding & { canCustomize?: boolean };
  whatsappRisk?: TenantWhatsAppRiskSummary;
  usage?: MonthlyUsage;
}

export interface MonthlyUsage {
  tenantId: string;
  period: string;
  messagesCount: number;
  bulkRecipientsCount: number;
  campaignsStarted: number;
  voicebotMinutesCount?: number;
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
  from?: string;
  to?: string;
  periods?: MonthlyUsage[];
  paymentProvider?: string;
}

export type WhatsAppChannelStatus = "active" | "pending_registration" | "disconnected";

export type WhatsAppEnforcementSource = "meta_auto" | "platform_admin" | "reseller";

export interface WhatsAppQualitySnapshot {
  qualityRating: WhatsAppQualityRating;
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

export type WhatsAppQualityRating = "GREEN" | "YELLOW" | "RED" | "NA";

export interface WhatsAppPhoneInfo {
  qualityRating: WhatsAppQualityRating;
  status: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  messagingLimit?: string;
}

export type TenantWhatsAppRiskLevel = "ok" | "warn" | "block" | "none";

export interface TenantWhatsAppRiskSummary {
  risk: TenantWhatsAppRiskLevel;
  score: number | null;
  connectedNumbers: number;
  qualityRating: WhatsAppQualityRating | null;
  phoneStatus: string | null;
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

export type BotLocale = "es" | "en";

export type AiProvider = "openai" | "anthropic";

export type LocalizedText = string | Record<BotLocale, string>;

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
  telephonyStructuredOutput?: TelephonyStructuredOutputDefinition | null;
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
  whatsappPhone?: WhatsAppPhoneInfo | null;
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

export type MarketingConsent = "unknown" | "opt_in" | "opt_out";

export type ContactSource = "sync" | "manual" | "import" | "lead_capture";

export type ContactSortField = "updated" | "lastSeen" | "created" | "name" | "csat";

export type ContactDateField = "firstSeen" | "lastSeen" | "created";

export interface Contact {
  phoneNumber: string;
  tenantId: string;
  displayName?: string;
  email?: string;
  country?: string;
  company?: string;
  tags: string[];
  notes?: string;
  marketingConsent: MarketingConsent;
  consentAt?: string;
  consentSource?: string;
  suppressed: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  lastBotId?: string;
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

export interface CompaniesListResponse {
  items: Company[];
  nextCursor?: string;
}

export interface OpportunityTimelineResponse {
  items: OpportunityActivityEvent[];
  nextCursor?: string;
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
export type SalesTaskReminderTarget = "advisor" | "contact";
export type SalesTaskReminderChannel = "email" | "whatsapp" | "platform";
export type SalesTaskReminderStatus =
  | "scheduled"
  | "sent"
  | "skipped"
  | "failed"
  | "cancelled";

export interface SalesTask {
  taskId: string;
  tenantId: string;
  opportunityId?: string;
  enrollmentId?: string;
  advisorId?: string;
  leadId?: string;
  conversationId?: string;
  botId?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactName?: string;
  title: string;
  description?: string;
  dueAt?: string;
  status: SalesTaskStatus;
  reminderTargets?: SalesTaskReminderTarget[];
  reminderChannels?: SalesTaskReminderChannel[];
  reminderMinutesBefore?: number;
  reminderStatus?: SalesTaskReminderStatus;
  reminderScheduleName?: string;
  reminderSentAt?: string;
  commentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalesTaskComment {
  commentId: string;
  taskId: string;
  tenantId: string;
  body: string;
  authorId: string;
  authorName?: string;
  createdAt: string;
}

export interface SalesTaskCommentsListResponse {
  items: SalesTaskComment[];
  nextCursor?: string;
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
  items: OpportunityEnriched[];
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

export interface ContactMetrics {
  total: number;
  optIn: number;
  optOut: number;
  unknown: number;
  suppressed: number;
  addedToday: number;
  addedThisWeek: number;
  withLead: number;
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
  whatsappChannelId?: string;
  businessPhoneNumberId?: string;
  whatsappDisplayNumber?: string;
  participantId?: string;
  phoneNumber: string;
  contactId?: string;
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
  copilotSummary?: string;
  detectedIntent?: string;
  copilotGeneratedAt?: string;
  interactionCategory?: InteractionCategory;
  interactionCategoryAt?: string;
  attribution?: AdsAttribution;
  messageCount: number;
  lastMessageAt: string;
  emailSubject?: string;
  emailThreadMessageId?: string;
  locale?: BotLocale;
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

export interface WhatsAppUsageDayCounts {
  apiOutbound: number;
  appEcho: number;
  inbound: number;
}

export interface WhatsAppUsageDailyPoint extends WhatsAppUsageDayCounts {
  date: string;
  total: number;
}

export interface WhatsAppUsageReport {
  from: string;
  to: string;
  botId?: string;
  totals: WhatsAppUsageDayCounts & { total: number };
  daily: WhatsAppUsageDailyPoint[];
}

export type MessageRole = "user" | "assistant" | "advisor" | "system";

export interface EmailMessageAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  disposition: "attachment" | "inline";
  contentId?: string;
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
  attachments?: EmailMessageAttachment[];
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
  messageType?: string;
  metadata?: EmailMessageMetadata | DocumentMessageMetadata | Record<string, unknown>;
  source?: string;
  sentByAdvisorId?: string;
  whatsappMessageId?: string;
  externalMessageId?: string;
  callId?: string;
  reactions?: MessageReaction[];
  timestamp: string;
}

export interface CrossChannelMessage extends Message {
  originConversationId: string;
  originChannel: Channel;
  isCurrentConversation: boolean;
}

export interface CrossChannelHistoryResponse {
  contactId?: string;
  messages: CrossChannelMessage[];
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

export interface AdvisorInviteResponse {
  advisor: Advisor;
  invite?: {
    username: string;
    email: string;
    emailSent?: boolean;
    emailFailureReason?: "not_configured" | "recipient_not_verified" | "send_failed";
  };
}

export interface TenantMember {
  userId: string;
  username: string;
  email: string;
  name: string;
  role: "member" | "supervisor" | "advisor";
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
  role: "member" | "supervisor" | "advisor";
  profilePhotoUrl?: string;
}

export interface TenantMembersResponse {
  members: TenantMember[];
  currentUserId: string;
}

export interface TenantMemberInviteResponse {
  member: TenantMember;
  advisor?: Advisor;
  invite?: {
    email: string;
    emailSent: boolean;
    emailFailureReason?: "not_configured" | "recipient_not_verified" | "send_failed";
    temporaryPassword?: string;
  };
}

export interface OrganizationTeam {
  teamId: string;
  tenantId: string;
  name: string;
  description?: string;
  status: "active" | "inactive";
  supervisorUserIds: string[];
  memberUserIds: string[];
  memberCount?: number;
  supervisorCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationTeamsResponse {
  teams: OrganizationTeam[];
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

export function isSmsTemplate(template: MessageTemplate): template is SmsTemplate {
  return template.channel === "sms";
}

export function isWhatsAppTemplate(template: MessageTemplate): template is WhatsAppTemplate {
  return template.channel !== "sms";
}

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

export interface CampaignPerformanceTotals {
  campaigns: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deliveryFailed: number;
  replies: number;
  deliveryRate: number;
  readRate: number;
  replyRate: number;
}

export interface CampaignPerformanceRow {
  campaignId: string;
  name: string;
  botId: string;
  channel: string;
  templateName: string;
  language: string;
  status: CampaignStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deliveryFailed: number;
  replies: number;
  deliveryRate: number;
  readRate: number;
  replyRate: number;
}

export interface CampaignTemplateAggregate {
  templateName: string;
  language: string;
  campaigns: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deliveryFailed: number;
  replies: number;
  deliveryRate: number;
  readRate: number;
  replyRate: number;
}

export interface CampaignPerformanceReport {
  from: string;
  to: string;
  botId?: string;
  totals: CampaignPerformanceTotals;
  campaigns: CampaignPerformanceRow[];
  byTemplate: CampaignTemplateAggregate[];
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
  createdAt: string;
  updatedAt: string;
}

export type SmsHistoryStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "delivery_failed"
  | "send_failed";

export type SmsDlrSource = "campaign" | "template" | "api";

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

export interface SmsOverviewDailyPoint {
  date: string;
  total: number;
  delivered: number;
  failed: number;
}

export interface SmsOverviewStatusPoint {
  status: SmsHistoryStatus;
  count: number;
}

export interface SmsOverviewSourcePoint {
  source: SmsDlrSource;
  count: number;
}

export interface SmsOverviewChannelPoint {
  channel: "campaign" | "bulk";
  sent: number;
  failed: number;
}

export interface SmsOverviewCharts {
  dailyTrend: SmsOverviewDailyPoint[];
  byStatus: SmsOverviewStatusPoint[];
  bySource: SmsOverviewSourcePoint[];
  byChannel: SmsOverviewChannelPoint[];
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
  charts: SmsOverviewCharts;
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
  | "opportunity.created"
  | "call.connect"
  | "call.status"
  | "call.terminated"
  | "call.recording.ready"
  | "call.cost.finalized";

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
  direction: "USER_INITIATED" | "BUSINESS_INITIATED";
  status: CallRecordStatus;
  duration?: number;
  provider?: "telnyx" | "meta";
  channel?: "phone" | "whatsapp";
  conversationId?: string;
  startedAt?: string;
  endedAt?: string;
  recordingStatus?: CallRecordingStatus;
  recordingS3Key?: string;
  recordingDurationSeconds?: number;
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

export interface VoiceAgentWebhookDelivery {
  deliveryId: string;
  tenantId: string;
  botId: string;
  event: IntegrationEvent;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  lastError?: string;
  createdAt: string;
}

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
  | "send_otp"
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

export interface VoiceAgentHttpToolTestResult {
  ok: boolean;
  status?: number;
  durationMs: number;
  resolvedUrl?: string;
  headers?: Record<string, string>;
  body?: unknown;
  variables?: Record<string, string>;
  error?: string;
}

export interface FlowNodeData {
  label?: string;
  triggerType?: FlowTriggerType;
  keywords?: string[];
  matchMode?: "contains" | "exact";
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
  notificationChannel?: "whatsapp" | "sms" | "email";
  notificationMessageType?: "text" | "template";
  notificationRecipientBinding?: string;
  notificationRecipientBindings?: string[];
  notificationEmailSubject?: string;
  notificationMessageBinding?: string;
  notificationMessageText?: LocalizedText;
  notificationMessageHtml?: LocalizedText;
  notificationTemplateName?: string;
  notificationTemplateLanguage?: string;
  notificationTemplateVariables?: Record<string, string>;
  notificationBotId?: string;
  botId?: string;
  webhookUrl?: string;
  webhookBody?: string;
  webhookHeaders?: FlowHttpHeader[];
  webhookResponseVariable?: string;
  otpMessageText?: LocalizedText;
  otpWhatsAppTemplateName?: string;
  otpWhatsAppTemplateLanguage?: string;
  otpMaxAttempts?: number;
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

export interface FlowVersionSnapshot {
  flowId: string;
  tenantId: string;
  version: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  entryNodeId: string;
  publishedAt: string;
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

export interface FlowEventSubmissionDetail extends FlowEventSubmission {
  webhookUrl?: string;
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

export interface FlowActivityPage {
  items: FlowActivitySummary[];
  nextCursor?: string;
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
  publicUrl?: string;
  embedSnippet?: string;
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
  shortUrl?: string;
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

export interface PublicHostedForm {
  name: string;
  description?: string;
  fields: HostedFormField[];
  submitLabel: string;
  successTitle: string;
  successMessage: string;
  branding?: {
    brandName?: string;
    primaryColor?: string;
    logoUrl?: string;
  };
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
export type AutomationAction =
  | "send_text"
  | "send_template"
  | "tag_contact"
  | "handoff"
  | "set_consent";

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

export type CalendarProviderType = "native" | "google";
export type GoogleCalendarStatus = "pending" | "active" | "error";
export type ExternalSyncStatus = "pending" | "synced" | "failed";

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
  source: "flow" | "openai" | "manual" | "public_link";
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

export interface AppCatalogItem {
  id: string;
  name: string;
  description: string;
  installedBots: Array<{ botId: string; botName: string; enabled: boolean }>;
  configured?: boolean;
  enabled?: boolean;
}

export interface MailrelayCredentials {
  configured: boolean;
  apiKey?: string;
  updatedAt?: string;
}

export interface MailrelayCredentialsInput {
  apiKey?: string;
}

export interface MailrelayTagGroupMapping {
  tag: string;
  groupId: string;
}

export interface MailrelayConfig {
  senderId: string;
  defaultGroupId: string;
  tagGroupMappings: MailrelayTagGroupMapping[];
  enabled?: boolean;
  eventTypes?: string[];
}

export interface MailrelayGroup {
  id: string;
  name: string;
  subscriberCount?: number;
}

export interface MailrelaySender {
  id: string;
  name: string;
  email: string;
}

export interface MailrelaySegment {
  id: string;
  name: string;
}

export interface MailrelayCampaignFolder {
  id: string;
  name: string;
}

export type MailrelayCampaignTarget = "groups" | "segment";

export type MailrelaySyncStatus = "pending" | "running" | "completed" | "failed";

export interface MailrelaySync {
  id: string;
  status: MailrelaySyncStatus;
  progress: number;
  processed: number;
  total: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface MailrelayCampaignInput {
  name: string;
  subject: string;
  previewText: string;
  html: string;
  senderId: string;
  target: MailrelayCampaignTarget;
  groupIds: string[];
  segmentId: string;
  campaignFolderId: string;
  replyTo: string;
  analyticsUtmCampaign: string;
  usePremailer: boolean;
  trackOpens: boolean;
  trackClicks: boolean;
}

export interface MailrelayCampaign extends MailrelayCampaignInput {
  id: string;
  status: "draft" | "sending" | "sent";
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
}

export interface MailrelayCampaignMetrics {
  campaignId: string;
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  bounces: number;
  unsubscribes: number;
  complaints: number;
}

export interface MailrelayPagination {
  page: number;
  perPage: number;
  hasMore: boolean;
  totalPages?: number;
}

export interface MailrelayEmailTemplate {
  templateId: string;
  name: string;
  subject: string;
  previewText?: string;
  html: string;
  createdAt: string;
  updatedAt: string;
}

export interface MailrelayEvent {
  eventId: string;
  type: string;
  campaignId?: number;
  subscriberId?: number;
  email?: string;
  occurredAt: string;
}

export interface MailrelayOverview {
  subscriberCount: number;
  draftCampaigns: number;
  sentCampaigns: number;
  templateCount: number;
  averageOpenRate: number;
  averageClickRate: number;
  lastSyncAt?: string;
  lastSyncStatus?: MailrelaySyncStatus;
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

export interface SoftphoneTokenResponse {
  loginToken: string;
  sipUsername: string;
  callerId?: string;
  presence: AgentPresence;
}
