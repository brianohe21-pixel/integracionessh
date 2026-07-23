import { randomUUID } from "crypto";
import { addMessage } from "../dynamodb/conversation.repository.js";
import { getTenant } from "../dynamodb/tenant.repository.js";
import {
  createQuotationRecord,
  listQuotationsForConversation,
  makeQuotationId,
  updateQuotation,
} from "../dynamodb/quotation.repository.js";
import { resolveBranding } from "../branding/resolve.js";
import { getConfigOrDefault, createPaymentRequest } from "../payments/payments.service.js";
import { formatPaymentMessage } from "../payments/checkout.js";
import {
  buildOutboundContext,
  sendChannelDocument,
  sendChannelText,
} from "../channels/router.js";
import {
  buildQuotationPdfS3Key,
  getObjectBuffer,
  getPresignedReadUrl,
  putObjectBuffer,
} from "../s3/client.js";
import { resolveAccessTokenForBot } from "./channel-access.js";
import type {
  Bot,
  Conversation,
  PaymentRequest,
  Quotation,
} from "../../types/index.js";
import {
  buildQuotationNumber,
  computeQuotationLineItems,
  computeQuotationTotals,
  renderQuotationPdf,
} from "./pdf.js";

export type CreateQuotationInput = {
  tenantId: string;
  botId: string;
  bot: Bot;
  conversation: Conversation;
  environment: string;
  createdByAdvisorId?: string;
  items: Array<{ description: string; quantity: number; unitPriceInCents: number }>;
  notes?: string;
  validUntil?: string;
  paymentDescription?: string;
};

export async function listConversationQuotations(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
}): Promise<Quotation[]> {
  const quotations = await listQuotationsForConversation(params);
  return Promise.all(
    quotations.map(async (quotation) => {
      if (!quotation.pdfS3Key) return quotation;
      const pdfDownloadUrl = await getPresignedReadUrl(quotation.pdfS3Key, 86400);
      return { ...quotation, pdfDownloadUrl };
    })
  );
}

export async function createAndSendQuotation(
  input: CreateQuotationInput
): Promise<{ quotation: Quotation; payment: PaymentRequest }> {
  const lineItems = computeQuotationLineItems(input.items).filter(
    (item) => item.description.length > 0
  );
  if (lineItems.length === 0) {
    throw new Error("At least one line item is required");
  }

  const { subtotalInCents, totalInCents } = computeQuotationTotals(lineItems);
  if (totalInCents < 1000) {
    throw new Error("Minimum quotation total is 1000 cents (COP $10)");
  }

  const quotationId = makeQuotationId();
  const now = new Date().toISOString();
  const contactPhone =
    input.conversation.phoneNumber ?? input.conversation.participantId ?? "";
  if (!contactPhone) {
    throw new Error("Conversation has no contact phone");
  }

  const quotation: Quotation = {
    quotationId,
    tenantId: input.tenantId,
    botId: input.botId,
    conversationId: input.conversation.conversationId,
    contactPhone,
    ...(input.conversation.contactName ? { contactName: input.conversation.contactName } : {}),
    number: buildQuotationNumber(quotationId),
    items: lineItems,
    subtotalInCents,
    totalInCents,
    currency: "COP",
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    ...(input.validUntil ? { validUntil: input.validUntil } : {}),
    status: "sent",
    ...(input.createdByAdvisorId ? { createdByAdvisorId: input.createdByAdvisorId } : {}),
    sentAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await createQuotationRecord(quotation);

  const tenant = await getTenant(input.tenantId);
  if (!tenant) throw new Error("Tenant not found");
  const branding = resolveBranding(tenant);
  let logoBytes: Uint8Array | undefined;
  if (tenant?.branding?.logoS3Key) {
    try {
      logoBytes = await getObjectBuffer(tenant.branding.logoS3Key);
    } catch {
      logoBytes = undefined;
    }
  }

  const pdfBuffer = await renderQuotationPdf({
    quotation,
    branding,
    ...(logoBytes ? { logoBytes } : {}),
  });
  const pdfS3Key = buildQuotationPdfS3Key(input.tenantId, input.botId, quotationId);
  await putObjectBuffer(pdfS3Key, pdfBuffer, "application/pdf");
  const pdfDownloadUrl = await getPresignedReadUrl(pdfS3Key, 86400);

  const paymentDescription =
    input.paymentDescription?.trim() || `Cotización ${quotation.number}`;

  const payment = await createPaymentRequest({
    tenantId: input.tenantId,
    botId: input.botId,
    amountInCents: totalInCents,
    description: paymentDescription,
    contactPhone,
    ...(input.conversation.contactName ? { contactName: input.conversation.contactName } : {}),
    source: "quotation",
    conversationId: input.conversation.conversationId,
    quotationId,
    environment: input.environment,
    sendWhatsApp: false,
  });

  const updatedQuotation = await updateQuotation(input.tenantId, quotationId, {
    paymentId: payment.paymentId,
    pdfS3Key,
    pdfDownloadUrl,
  });

  const config = await getConfigOrDefault(input.tenantId, input.botId);
  const channel = input.conversation.channel ?? "whatsapp";
  const accessToken = await resolveAccessTokenForBot(
    input.tenantId,
    input.botId,
    channel,
    input.environment
  );

  const outboundCtx = buildOutboundContext({
    tenantId: input.tenantId,
    botId: input.botId,
    bot: input.bot,
    conversation: input.conversation,
    accessToken,
    environment: input.environment,
  });

  const paymentText = formatPaymentMessage(
    config.paymentMessageTemplate,
    payment.checkoutUrl,
    totalInCents,
    paymentDescription
  );

  const pdfFilename = `${quotation.number}.pdf`;
  let documentSent = false;

  if (channel === "whatsapp" && accessToken) {
    try {
      const docResult = await sendChannelDocument(outboundCtx, {
        buffer: pdfBuffer,
        mimeType: "application/pdf",
        filename: pdfFilename,
        caption: `Cotización ${quotation.number}`,
      });
      await addMessage(
        {
          messageId: `adv-${randomUUID()}`,
          conversationId: input.conversation.conversationId,
          tenantId: input.tenantId,
          role: "advisor",
          content: `[Documento] ${pdfFilename}`,
          channel,
          source: "panel",
          ...(input.createdByAdvisorId ? { sentByAdvisorId: input.createdByAdvisorId } : {}),
          ...(docResult.externalMessageId
            ? {
                externalMessageId: docResult.externalMessageId,
                whatsappMessageId: docResult.externalMessageId,
              }
            : {}),
          timestamp: now,
        },
        input.botId
      );
      documentSent = true;
    } catch {
      documentSent = false;
    }
  }

  const textBody = documentSent
    ? paymentText
    : `${paymentText}\n\nDescargar cotización: ${pdfDownloadUrl}`;

  const textResult = await sendChannelText(outboundCtx, textBody);
  await addMessage(
    {
      messageId: `adv-${randomUUID()}`,
      conversationId: input.conversation.conversationId,
      tenantId: input.tenantId,
      role: "advisor",
      content: textBody,
      channel,
      source: "panel",
      ...(input.createdByAdvisorId ? { sentByAdvisorId: input.createdByAdvisorId } : {}),
      ...(textResult.externalMessageId
        ? {
            externalMessageId: textResult.externalMessageId,
            ...(channel === "whatsapp"
              ? { whatsappMessageId: textResult.externalMessageId }
              : {}),
          }
        : {}),
      timestamp: new Date().toISOString(),
    },
    input.botId
  );

  return {
    quotation: updatedQuotation ?? { ...quotation, paymentId: payment.paymentId, pdfS3Key, pdfDownloadUrl },
    payment,
  };
}

export async function markQuotationPaid(
  tenantId: string,
  quotationId: string
): Promise<Quotation | null> {
  return updateQuotation(tenantId, quotationId, { status: "paid" });
}
