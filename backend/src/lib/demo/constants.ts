export const DEMO_TENANT_ID = "00000000-0000-4000-8000-00000000d001";
export const DEMO_BOT_WA_ID = "00000000-0000-4000-8000-00000000d002";
export const DEMO_BOT_VOICE_ID = "00000000-0000-4000-8000-00000000d003";
export const DEMO_FLOW_ID = "00000000-0000-4000-8000-00000000d004";
export const DEMO_PIPELINE_ID = "00000000-0000-4000-8000-00000000d005";
export const DEMO_CAMPAIGN_ID = "00000000-0000-4000-8000-00000000d006";
export const DEMO_BULK_JOB_ID = "00000000-0000-4000-8000-00000000d007";
export const DEMO_BOT_SUPPORT_ID = "00000000-0000-4000-8000-00000000d008";
export const DEMO_FLOW_SUPPORT_ID = "00000000-0000-4000-8000-00000000d009";
export const DEMO_FLOW_ONBOARDING_ID = "00000000-0000-4000-8000-00000000d00a";

export const DEMO_STAGE_NEW_ID = "00000000-0000-4000-8000-00000000d010";
export const DEMO_STAGE_QUOTED_ID = "00000000-0000-4000-8000-00000000d011";
export const DEMO_STAGE_NEGOTIATION_ID = "00000000-0000-4000-8000-00000000d012";
export const DEMO_STAGE_WON_ID = "00000000-0000-4000-8000-00000000d013";
export const DEMO_STAGE_LOST_ID = "00000000-0000-4000-8000-00000000d014";

export const DEMO_SEED_COUNTS = {
  contacts: 50,
  conversations: 40,
  calls: 30,
  opportunities: 24,
  leads: 18,
  campaigns: 6,
  bulkJobs: 8,
  advisors: 4,
  automations: 6,
  salesTasks: 15,
  paymentRequests: 10,
  templates: 6,
  macros: 4,
} as const;

export const DEMO_SEQ = {
  conversation: 0x200,
  opportunity: 0x300,
  lead: 0x380,
  call: 0x400,
  campaign: 0x500,
  bulkJob: 0x600,
  advisor: 0x700,
  automation: 0x800,
  salesTask: 0x900,
  payment: 0xa00,
  macro: 0xb00,
} as const;

export const DEMO_FLOW_IDS = [
  DEMO_FLOW_ID,
  DEMO_FLOW_SUPPORT_ID,
  DEMO_FLOW_ONBOARDING_ID,
] as const;

export const DEMO_BOT_IDS = [
  DEMO_BOT_WA_ID,
  DEMO_BOT_VOICE_ID,
  DEMO_BOT_SUPPORT_ID,
] as const;

export const DEMO_TENANT_NAME = "NovaRetail Demo";
export const DEMO_DEFAULT_EMAIL = "demo@integracionessh.dev";
export const DEMO_DEFAULT_PASSWORD = "DemoAccess2026!";
export const DEMO_DEV_TABLE_NAME = "chatbot-platform-dev";

export function demoUuid(seq: number): string {
  return `00000000-0000-4000-8000-${seq.toString(16).padStart(12, "0")}`;
}

export function demoPhone(index: number): string {
  return `573${String(10_000_000 + index).padStart(8, "0")}`;
}

export function demoConversationId(index: number): string {
  return demoUuid(DEMO_SEQ.conversation + index);
}

export function demoOpportunityId(index: number): string {
  return demoUuid(DEMO_SEQ.opportunity + index);
}

export function demoLeadId(index: number): string {
  return demoUuid(DEMO_SEQ.lead + index);
}

export function demoCallId(index: number): string {
  return demoUuid(DEMO_SEQ.call + index);
}

export function demoCampaignId(index: number): string {
  return demoUuid(DEMO_SEQ.campaign + index);
}

export function demoBulkJobId(index: number): string {
  return demoUuid(DEMO_SEQ.bulkJob + index);
}

export function demoAdvisorId(index: number): string {
  return demoUuid(DEMO_SEQ.advisor + index);
}

export function demoAutomationId(index: number): string {
  return demoUuid(DEMO_SEQ.automation + index);
}

export function demoSalesTaskId(index: number): string {
  return demoUuid(DEMO_SEQ.salesTask + index);
}

export function demoPaymentId(index: number): string {
  return demoUuid(DEMO_SEQ.payment + index);
}

export function demoMacroId(index: number): string {
  return demoUuid(DEMO_SEQ.macro + index);
}
