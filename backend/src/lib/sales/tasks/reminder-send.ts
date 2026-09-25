import { getAdvisor } from "../../dynamodb/advisor.repository.js";
import { getBot, listBots } from "../../dynamodb/bot.repository.js";
import { getContactByPhone } from "../../dynamodb/contact.repository.js";
import { getMember, listMembers } from "../../dynamodb/member.repository.js";
import { getSalesTaskById, updateSalesTask } from "../../dynamodb/sales-task.repository.js";
import { getTenant } from "../../dynamodb/tenant.repository.js";
import { sendEmail } from "../../email/client.js";
import { publishRealtimeEventSafe } from "../../realtime/publish.js";
import {
  getWhatsAppAccessToken,
  sendTemplateMessage,
} from "../../whatsapp/client.js";
import { assertWhatsAppOutboundAllowed } from "../../whatsapp/outbound-guard.js";
import type { SalesTask, TenantMember } from "../../../types/index.js";

function formatDueAt(dueAt?: string): string {
  if (!dueAt) return "";
  try {
    return new Date(dueAt).toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return dueAt;
  }
}

function sanitizeTemplateParam(value: string, max = 200): string {
  const cleaned = value.replace(/[\r\n\t]+/g, " ").trim();
  if (!cleaned) return "—";
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

function buildReminderText(task: SalesTask): string {
  const lines = [`Recordatorio de tarea: ${task.title}`];
  if (task.description?.trim()) {
    lines.push(task.description.trim().slice(0, 400));
  }
  if (task.dueAt) {
    lines.push(`Vence: ${formatDueAt(task.dueAt)}`);
  }
  if (task.contactName || task.contactPhone) {
    lines.push(
      `Contacto: ${[task.contactName, task.contactPhone].filter(Boolean).join(" · ")}`
    );
  }
  lines.push("Puedes marcarla como completada desde la vista de Tareas.");
  return lines.join("\n");
}

function buildReminderHtml(task: SalesTask): string {
  const due = task.dueAt ? `<p><strong>Vence:</strong> ${formatDueAt(task.dueAt)}</p>` : "";
  const contact =
    task.contactName || task.contactPhone
      ? `<p><strong>Contacto:</strong> ${[task.contactName, task.contactPhone]
          .filter(Boolean)
          .join(" · ")}</p>`
      : "";
  const description = task.description?.trim()
    ? `<p>${task.description.trim().slice(0, 400)}</p>`
    : "";
  return `
    <h2>Recordatorio de tarea</h2>
    <p><strong>${task.title}</strong></p>
    ${description}
    ${due}
    ${contact}
    <p>Puedes marcarla como completada desde la vista de Tareas.</p>
  `;
}

function resolveTaskReminderWhatsAppTemplate(settings?: {
  botId?: string;
  templateName?: string;
  templateLanguage?: string;
} | null): {
  botId?: string;
  templateName: string;
  language: string;
} | null {
  const templateName = settings?.templateName?.trim() ?? "";
  if (!templateName) return null;
  const language = settings?.templateLanguage?.trim() || "es";
  const botId = settings?.botId?.trim() || undefined;
  return { templateName, language, ...(botId ? { botId } : {}) };
}

export function buildTaskReminderTemplateParams(task: SalesTask): {
  title: string;
  dueAt: string;
  contact: string;
} {
  return {
    title: sanitizeTemplateParam(task.title || "Tarea"),
    dueAt: sanitizeTemplateParam(task.dueAt ? formatDueAt(task.dueAt) : "Sin vencimiento"),
    contact: sanitizeTemplateParam(
      [task.contactName, task.contactPhone].filter(Boolean).join(" · ") || "—"
    ),
  };
}

async function resolveWhatsAppBot(tenantId: string, botId?: string) {
  if (botId) {
    const bot = await getBot(tenantId, botId);
    if (bot?.phoneNumberId) return bot;
  }
  const bots = await listBots(tenantId);
  return bots.find((b) => b.phoneNumberId) ?? null;
}

async function resolveAdvisorEmail(
  tenantId: string,
  advisorId: string
): Promise<string | null> {
  const members = await listMembers(tenantId);
  const member = members.find((m) => m.advisorId === advisorId && m.enabled);
  return member?.email?.trim() || null;
}

async function resolveContactEmail(task: SalesTask): Promise<string | null> {
  if (task.contactEmail?.trim()) return task.contactEmail.trim();
  if (!task.contactPhone) return null;
  const contact = await getContactByPhone(task.tenantId, task.contactPhone);
  return contact?.email?.trim() || null;
}

async function sendEmailReminder(params: {
  email: string;
  task: SalesTask;
  text: string;
  html: string;
}): Promise<boolean> {
  await sendEmail({
    to: [params.email],
    subject: `Recordatorio: ${params.task.title}`,
    text: params.text,
    html: params.html,
  });
  return true;
}

async function sendMemberReminder(params: {
  tenantId: string;
  member: TenantMember;
  task: SalesTask;
  channels: Set<string>;
  text: string;
  html: string;
  sentEmails: Set<string>;
  sentPhones: Set<string>;
}): Promise<{ sent: boolean; failed: boolean }> {
  let sent = false;
  let failed = false;
  const email = params.member.email?.trim().toLowerCase();

  if (params.channels.has("email") && email && !params.sentEmails.has(email)) {
    try {
      await sendEmailReminder({
        email,
        task: params.task,
        text: params.text,
        html: params.html,
      });
      params.sentEmails.add(email);
      sent = true;
    } catch (error) {
      console.error("Failed to send member task reminder email", error);
      failed = true;
    }
  }

  if (params.channels.has("whatsapp") && params.member.advisorId) {
    try {
      const advisor = await getAdvisor(params.tenantId, params.member.advisorId);
      const phone = advisor?.phoneNumber?.replace(/\D/g, "") || "";
      if (phone && !params.sentPhones.has(phone)) {
        const ok = await sendWhatsAppReminder({
          tenantId: params.tenantId,
          ...(params.task.botId ? { botId: params.task.botId } : {}),
          to: advisor!.phoneNumber!,
          task: params.task,
        });
        if (ok) {
          params.sentPhones.add(phone);
          sent = true;
        } else {
          failed = true;
        }
      }
    } catch (error) {
      console.error("Failed to send member task reminder WhatsApp", error);
      failed = true;
    }
  }

  return { sent, failed };
}

async function sendWhatsAppReminder(params: {
  tenantId: string;
  botId?: string;
  to: string;
  task: SalesTask;
}): Promise<boolean> {
  const phone = params.to.replace(/\D/g, "");
  if (!phone) return false;

  const tenant = await getTenant(params.tenantId);
  const template = resolveTaskReminderWhatsAppTemplate(tenant?.taskReminderWhatsApp);
  if (!template) {
    console.warn(
      "Task reminder WhatsApp template is not configured; skipping WhatsApp task reminder"
    );
    return false;
  }

  const bot = await resolveWhatsAppBot(
    params.tenantId,
    template.botId || params.botId
  );
  if (!bot?.phoneNumberId) return false;

  const environment = process.env.ENVIRONMENT ?? "dev";
  const accessToken = await getWhatsAppAccessToken(params.tenantId, environment);
  if (!accessToken) return false;

  await assertWhatsAppOutboundAllowed({
    tenantId: params.tenantId,
    phoneNumberId: bot.phoneNumberId,
    kind: "transactional",
    to: phone,
  });

  const vars = buildTaskReminderTemplateParams(params.task);
  await sendTemplateMessage({
    phoneNumberId: bot.phoneNumberId,
    to: phone,
    templateName: template.templateName,
    language: template.language,
    accessToken,
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: vars.title },
          { type: "text", text: vars.dueAt },
          { type: "text", text: vars.contact },
        ],
      },
    ],
  });
  return true;
}

export async function sendTaskReminder(params: {
  tenantId: string;
  taskId: string;
}): Promise<{ message: string }> {
  const task = await getSalesTaskById(params.tenantId, params.taskId);
  if (!task) {
    return { message: "Task not found, skipping." };
  }
  if (task.status !== "open") {
    return { message: "Task not open, skipping." };
  }
  if (task.reminderSentAt) {
    return { message: "Reminder already sent, skipping." };
  }

  const channels = new Set(task.reminderChannels ?? []);
  const targets = new Set(task.reminderTargets ?? []);
  const reminderUserIds = Array.from(new Set(task.reminderUserIds ?? []));
  const hasExternal = Boolean(
    task.reminderExternal?.email?.trim() || task.reminderExternal?.whatsapp?.trim()
  );
  const hasExternalChannel = channels.has("email") || channels.has("whatsapp");
  const hasPlatform = channels.has("platform");
  const hasRecipientTargets =
    targets.size > 0 || reminderUserIds.length > 0 || hasExternal;

  if (!channels.size || (hasExternalChannel && !hasRecipientTargets && !hasPlatform)) {
    await updateSalesTask(params.tenantId, params.taskId, {
      reminderStatus: "skipped",
      reminderScheduleName: null,
    });
    return { message: "No reminder channels or targets, skipping." };
  }

  if (!hasPlatform && !hasRecipientTargets) {
    await updateSalesTask(params.tenantId, params.taskId, {
      reminderStatus: "skipped",
      reminderScheduleName: null,
    });
    return { message: "No reminder targets, skipping." };
  }

  const text = buildReminderText(task);
  const html = buildReminderHtml(task);
  let sentAny = false;
  let failedAny = false;
  const sentEmails = new Set<string>();
  const sentPhones = new Set<string>();

  if (hasPlatform) {
    try {
      const createdAt = new Date().toISOString();
      publishRealtimeEventSafe(params.tenantId, {
        type: "task.reminder",
        taskId: task.taskId,
        title: task.title,
        body: text,
        href: "/tasks",
        createdAt,
        ...(task.advisorId ? { advisorId: task.advisorId } : {}),
        ...(reminderUserIds.length ? { userIds: reminderUserIds } : {}),
      });
      sentAny = true;
    } catch (error) {
      console.error("Failed to publish platform task reminder", error);
      failedAny = true;
    }
  }

  if (targets.has("advisor") && task.advisorId) {
    if (channels.has("email")) {
      try {
        const email = await resolveAdvisorEmail(params.tenantId, task.advisorId);
        const normalized = email?.toLowerCase();
        if (normalized && !sentEmails.has(normalized)) {
          await sendEmailReminder({ email: normalized, task, text, html });
          sentEmails.add(normalized);
          sentAny = true;
        }
      } catch (error) {
        console.error("Failed to send advisor task reminder email", error);
        failedAny = true;
      }
    }
    if (channels.has("whatsapp")) {
      try {
        const advisor = await getAdvisor(params.tenantId, task.advisorId);
        const phone = advisor?.phoneNumber?.replace(/\D/g, "") || "";
        if (advisor?.phoneNumber && phone && !sentPhones.has(phone)) {
          const ok = await sendWhatsAppReminder({
            tenantId: params.tenantId,
            ...(task.botId ? { botId: task.botId } : {}),
            to: advisor.phoneNumber,
            task,
          });
          if (ok) {
            sentPhones.add(phone);
            sentAny = true;
          } else failedAny = true;
        }
      } catch (error) {
        console.error("Failed to send advisor task reminder WhatsApp", error);
        failedAny = true;
      }
    }
  }

  if (targets.has("contact")) {
    if (channels.has("email")) {
      try {
        const email = await resolveContactEmail(task);
        const normalized = email?.toLowerCase();
        if (normalized && !sentEmails.has(normalized)) {
          await sendEmailReminder({ email: normalized, task, text, html });
          sentEmails.add(normalized);
          sentAny = true;
        }
      } catch (error) {
        console.error("Failed to send contact task reminder email", error);
        failedAny = true;
      }
    }
    if (channels.has("whatsapp")) {
      try {
        const phoneRaw = task.contactPhone;
        const phone = phoneRaw?.replace(/\D/g, "") || "";
        if (phoneRaw && phone && !sentPhones.has(phone)) {
          const ok = await sendWhatsAppReminder({
            tenantId: params.tenantId,
            ...(task.botId ? { botId: task.botId } : {}),
            to: phoneRaw,
            task,
          });
          if (ok) {
            sentPhones.add(phone);
            sentAny = true;
          } else failedAny = true;
        }
      } catch (error) {
        console.error("Failed to send contact task reminder WhatsApp", error);
        failedAny = true;
      }
    }
  }

  if (reminderUserIds.length) {
    const membersById = new Map(
      (await listMembers(params.tenantId)).map((member) => [member.userId, member])
    );
    for (const userId of reminderUserIds) {
      const member = membersById.get(userId) ?? (await getMember(params.tenantId, userId));
      if (!member?.enabled) continue;
      const result = await sendMemberReminder({
        tenantId: params.tenantId,
        member,
        task,
        channels,
        text,
        html,
        sentEmails,
        sentPhones,
      });
      if (result.sent) sentAny = true;
      if (result.failed) failedAny = true;
    }
  }

  if (hasExternal) {
    const externalEmail = task.reminderExternal?.email?.trim().toLowerCase();
    const externalWhatsapp = task.reminderExternal?.whatsapp?.trim();
    if (channels.has("email") && externalEmail && !sentEmails.has(externalEmail)) {
      try {
        await sendEmailReminder({ email: externalEmail, task, text, html });
        sentEmails.add(externalEmail);
        sentAny = true;
      } catch (error) {
        console.error("Failed to send external task reminder email", error);
        failedAny = true;
      }
    }
    if (channels.has("whatsapp") && externalWhatsapp) {
      const phone = externalWhatsapp.replace(/\D/g, "");
      if (phone && !sentPhones.has(phone)) {
        try {
          const ok = await sendWhatsAppReminder({
            tenantId: params.tenantId,
            ...(task.botId ? { botId: task.botId } : {}),
            to: externalWhatsapp,
            task,
          });
          if (ok) {
            sentPhones.add(phone);
            sentAny = true;
          } else failedAny = true;
        } catch (error) {
          console.error("Failed to send external task reminder WhatsApp", error);
          failedAny = true;
        }
      }
    }
  }

  const now = new Date().toISOString();
  if (sentAny) {
    await updateSalesTask(params.tenantId, params.taskId, {
      reminderStatus: failedAny ? "failed" : "sent",
      reminderSentAt: now,
      reminderScheduleName: null,
    });
    return { message: failedAny ? "Reminder partially sent." : "Reminder sent." };
  }

  await updateSalesTask(params.tenantId, params.taskId, {
    reminderStatus: "failed",
    reminderScheduleName: null,
  });
  return { message: "Reminder failed." };
}
