export interface Tenant {
  tenantId: string;
  name: string;
  email: string;
  plan: "free" | "pro" | "enterprise";
  status: "active" | "suspended" | "pending";
  createdAt: string;
  updatedAt: string;
}

export interface Bot {
  botId: string;
  tenantId: string;
  name: string;
  systemPrompt: string;
  model: "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo";
  temperature: number;
  maxTokens: number;
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
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
