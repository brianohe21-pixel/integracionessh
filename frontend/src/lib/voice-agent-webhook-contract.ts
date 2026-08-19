export const VOICE_AGENT_WEBHOOK_HEADERS = [
  "Content-Type: application/json",
  "User-Agent: IntegracionesSSH/1.0",
  "X-Integration-Event: call.terminated",
  "X-Voice-Agent-Id: {botId}",
  "X-Integration-Signature: {hmac_sha256_hex} (optional)",
] as const;

export function buildVoiceAgentWebhookExample(botId: string, businessPhoneNumber?: string) {
  return {
    event: "call.terminated",
    timestamp: "2026-08-12T17:28:05.000Z",
    tenantId: "tenant-id",
    data: {
      botId,
      callId: "call-id",
      direction: "USER_INITIATED",
      phoneNumber: "+17875550199",
      ...(businessPhoneNumber ? { businessPhoneNumber } : {}),
      status: "completed",
      duration: 185,
      startedAt: "2026-08-12T17:25:00.000Z",
      endedAt: "2026-08-12T17:28:05.000Z",
      structuredOutputs: {
        name: "customer_order",
        result: {
          subtotal: 34.98,
          impuestos: 4.02,
          metodo_pago: "tarjeta_credito",
          valor_total: 42.5,
          delivery_fee: 3.5,
          tipo_servicio: "delivery",
          detalle_pedido: "Pizza grande All Meat con extra queso y una Coca-Cola",
          nombre_cliente: "Daniel Salcedo",
          direccion_entrega: "Urbanizacion Hyde Park, calle Muñoz 452, apto 3B",
          telefono_contacto: "+17875550199",
        },
      },
    },
  };
}

export function serializeVoiceAgentWebhookExample(
  botId: string,
  businessPhoneNumber?: string
): string {
  return JSON.stringify(buildVoiceAgentWebhookExample(botId, businessPhoneNumber), null, 2);
}
