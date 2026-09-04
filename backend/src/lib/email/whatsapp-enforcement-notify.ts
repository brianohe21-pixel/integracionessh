import type { Tenant, WhatsAppChannel } from "../../types/index.js";
import { parseEmailList, sendEmail } from "./client.js";

function adminRecipients(): string[] {
  return parseEmailList(process.env.ADMIN_NOTIFICATION_EMAILS);
}

export async function notifyWhatsAppEnforcementBlock(params: {
  tenant: Tenant;
  channel: WhatsAppChannel;
  reason: string;
  event?: string;
}): Promise<void> {
  const recipients = adminRecipients();
  if (recipients.length === 0) return;

  const subject = `WhatsApp bloqueado: ${params.tenant.name}`;
  const lines = [
    "Meta o la plataforma bloqueó envíos salientes para un número de WhatsApp.",
    "",
    `Tenant: ${params.tenant.name} (${params.tenant.tenantId})`,
    `Número: ${params.channel.displayPhoneNumber ?? params.channel.phoneNumberId}`,
    `Phone Number ID: ${params.channel.phoneNumberId}`,
    `Motivo: ${params.reason}`,
    ...(params.event ? [`Evento: ${params.event}`] : []),
    "",
    "Solo un administrador de plataforma puede desbloquear tras revalidar en Meta.",
  ];

  await sendEmail({
    to: recipients,
    subject,
    text: lines.join("\n"),
  });
}
