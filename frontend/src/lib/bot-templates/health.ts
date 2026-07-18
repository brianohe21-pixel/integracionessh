import { HeartPulse } from "lucide-react";
import type { BotIndustryTemplate, BotTemplateLocale } from "./types";
import {
  bookAppointmentNode,
  branchX,
  buttonsNode,
  edge,
  endNode,
  handoffNode,
  messageNode,
  rowY,
  triggerNode,
} from "./flow-builder";

const copy = {
  es: {
    botName: "Asistente de salud",
    flowName: "Atención al paciente",
    systemPrompt:
      "Eres el asistente virtual de una clínica o centro de salud. Ayudas con citas, horarios, ubicación y orientación general. Responde con empatía y claridad. No das diagnósticos médicos ni recetas. Si el paciente describe una urgencia o emergencia, transfiere de inmediato a un humano.",
    welcome:
      "¡Hola! Bienvenido a nuestra clínica. ¿En qué podemos ayudarte hoy?",
    menuPrompt: "Selecciona una opción:",
    btnAppointment: "Agendar cita",
    btnHours: "Horarios",
    btnUrgent: "Urgencias",
    appointmentConfirm: "Tu cita ha sido registrada. Te enviaremos la confirmación por este medio.",
    hoursMessage:
      "Nuestro horario de atención es de lunes a viernes de 8:00 a 18:00 y sábados de 8:00 a 12:00. Domingos y festivos cerrado.",
  },
  en: {
    botName: "Health assistant",
    flowName: "Patient care",
    systemPrompt:
      "You are the virtual assistant for a clinic or health center. You help with appointments, hours, location, and general guidance. Respond with empathy and clarity. Do not provide medical diagnoses or prescriptions. If the patient describes an emergency, transfer to a human immediately.",
    welcome: "Hello! Welcome to our clinic. How can we help you today?",
    menuPrompt: "Select an option:",
    btnAppointment: "Book appointment",
    btnHours: "Hours",
    btnUrgent: "Emergency",
    appointmentConfirm: "Your appointment has been registered. We will send confirmation here.",
    hoursMessage:
      "Our hours are Monday to Friday 8:00 AM–6:00 PM and Saturday 8:00 AM–12:00 PM. Closed Sundays and holidays.",
  },
} as const;

function buildFlow(locale: BotTemplateLocale) {
  const t = copy[locale];
  const btnAppointment = "btn-appointment";
  const btnHours = "btn-hours";
  const btnUrgent = "btn-urgent";

  const nodes = [
    triggerNode("trigger-1", "first_message", "Start", rowY(0)),
    messageNode("message-welcome", t.welcome, "Welcome", 400, rowY(1)),
    buttonsNode(
      "buttons-menu",
      t.menuPrompt,
      [
        { id: btnAppointment, title: t.btnAppointment },
        { id: btnHours, title: t.btnHours },
        { id: btnUrgent, title: t.btnUrgent },
      ],
      "Menu",
      rowY(2)
    ),
    bookAppointmentNode(
      "book-appointment",
      t.appointmentConfirm,
      "Appointment",
      branchX(0, 3),
      rowY(3)
    ),
    endNode("end-appointment", "End", branchX(0, 3), rowY(4)),
    messageNode("message-hours", t.hoursMessage, "Hours", branchX(1, 3), rowY(3)),
    endNode("end-hours", "End", branchX(1, 3), rowY(4)),
    handoffNode("handoff-urgent", "Handoff", branchX(2, 3), rowY(3)),
    endNode("end-urgent", "End", branchX(2, 3), rowY(4)),
  ];

  const edges = [
    edge("e1", "trigger-1", "message-welcome"),
    edge("e2", "message-welcome", "buttons-menu"),
    edge("e3", "buttons-menu", "book-appointment", btnAppointment),
    edge("e4", "book-appointment", "end-appointment"),
    edge("e5", "buttons-menu", "message-hours", btnHours),
    edge("e6", "message-hours", "end-hours"),
    edge("e7", "buttons-menu", "handoff-urgent", btnUrgent),
    edge("e8", "handoff-urgent", "end-urgent"),
  ];

  return {
    name: t.flowName,
    nodes,
    edges,
    entryNodeId: "trigger-1",
    welcomeMessage: t.welcome,
  };
}

export const healthTemplate: BotIndustryTemplate = {
  id: "health",
  icon: HeartPulse,
  getSystemPrompt: (locale) => copy[locale].systemPrompt,
  getDefaultBotName: (locale) => copy[locale].botName,
  getFlowDefinition: buildFlow,
};
