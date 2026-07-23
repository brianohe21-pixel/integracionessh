import { Headphones } from "lucide-react";
import type { BotIndustryTemplate, BotTemplateLocale } from "./types";
import {
  branchX,
  bilingual,
  buttonsNode,
  conditionNode,
  edge,
  endNode,
  handoffNode,
  messageNode,
  rowY,
  triggerNode,
} from "./flow-builder";

const copy = {
  es: {
    botName: "Asistente de soporte",
    flowName: "Soporte al cliente",
    systemPrompt:
      "Eres el asistente de soporte al cliente. Ayudas con estado de pedidos, preguntas frecuentes y creación de tickets. Sé paciente y resolutivo. Si no puedes resolver el problema en dos intentos o el cliente lo pide, transfiere a un agente humano.",
    welcome: "¡Hola! Soy tu asistente de soporte. ¿En qué puedo ayudarte?",
    menuPrompt: "Elige una opción:",
    btnOrderStatus: "Estado de pedido",
    btnTicket: "Crear ticket",
    btnFaq: "Preguntas frecuentes",
    btnAgent: "Hablar con agente",
    orderPrompt: "Escribe tu número de pedido o palabra clave relacionada:",
    orderFound:
      "Encontramos información sobre tu pedido. Un agente te dará los detalles actualizados.",
    orderNotFound:
      "No encontramos ese pedido. Verifica el número o escríbenos más detalles.",
    ticketMessage:
      "Describe tu problema y un agente creará un ticket de seguimiento para ti.",
    faqMessage:
      "Preguntas frecuentes:\n• Horario de atención: Lun–Vie 8:00–18:00\n• Tiempo de respuesta: 24 h hábiles\n• Devoluciones: 30 días con factura",
  },
  en: {
    botName: "Support assistant",
    flowName: "Customer support",
    systemPrompt:
      "You are the customer support assistant. You help with order status, FAQs, and ticket creation. Be patient and solution-oriented. If you cannot resolve the issue in two attempts or the client asks, transfer to a human agent.",
    welcome: "Hello! I am your support assistant. How can I help you?",
    menuPrompt: "Choose an option:",
    btnOrderStatus: "Order status",
    btnTicket: "Create ticket",
    btnFaq: "FAQ",
    btnAgent: "Talk to agent",
    orderPrompt: "Enter your order number or related keyword:",
    orderFound:
      "We found information about your order. An agent will provide updated details.",
    orderNotFound:
      "We could not find that order. Please verify the number or share more details.",
    ticketMessage:
      "Describe your issue and an agent will create a follow-up ticket for you.",
    faqMessage:
      "Frequently asked questions:\n• Hours: Mon–Fri 8:00 AM–6:00 PM\n• Response time: 24 business hours\n• Returns: 30 days with receipt",
  },
} as const;

function buildFlow(locale: BotTemplateLocale) {
  const es = copy.es;
  const en = copy.en;
  const btnOrderStatus = "btn-order-status";
  const btnTicket = "btn-ticket";
  const btnFaq = "btn-faq";
  const btnAgent = "btn-agent";

  const nodes = [
    triggerNode("trigger-1", "any_message", "Start", rowY(0)),
    messageNode("message-welcome", bilingual(es.welcome, en.welcome), "Welcome", 400, rowY(1)),
    buttonsNode(
      "buttons-menu",
      bilingual(es.menuPrompt, en.menuPrompt),
      [
        { id: btnOrderStatus, title: bilingual(es.btnOrderStatus, en.btnOrderStatus) },
        { id: btnTicket, title: bilingual(es.btnTicket, en.btnTicket) },
        { id: btnFaq, title: bilingual(es.btnFaq, en.btnFaq) },
        { id: btnAgent, title: bilingual(es.btnAgent, en.btnAgent) },
      ],
      "Menu",
      rowY(2)
    ),
    messageNode("message-order-prompt", bilingual(es.orderPrompt, en.orderPrompt), "Order prompt", branchX(0, 4), rowY(3)),
    conditionNode(
      "condition-order",
      "last_input",
      "contains",
      locale === "es" ? "pedido" : "order",
      "Check order",
      branchX(0, 4),
      rowY(4)
    ),
    messageNode("message-order-found", bilingual(es.orderFound, en.orderFound), "Order found", branchX(0, 4) - 80, rowY(5)),
    handoffNode("handoff-order", "Handoff", branchX(0, 4) - 80, rowY(6)),
    endNode("end-order-found", "End", branchX(0, 4) - 80, rowY(7)),
    messageNode("message-order-notfound", bilingual(es.orderNotFound, en.orderNotFound), "Not found", branchX(0, 4) + 80, rowY(5)),
    endNode("end-order-notfound", "End", branchX(0, 4) + 80, rowY(6)),
    messageNode("message-ticket", bilingual(es.ticketMessage, en.ticketMessage), "Ticket", branchX(1, 4), rowY(3)),
    handoffNode("handoff-ticket", "Handoff", branchX(1, 4), rowY(4)),
    endNode("end-ticket", "End", branchX(1, 4), rowY(5)),
    messageNode("message-faq", bilingual(es.faqMessage, en.faqMessage), "FAQ", branchX(2, 4), rowY(3)),
    endNode("end-faq", "End", branchX(2, 4), rowY(4)),
    handoffNode("handoff-agent", "Handoff", branchX(3, 4), rowY(3)),
    endNode("end-agent", "End", branchX(3, 4), rowY(4)),
  ];

  const edges = [
    edge("e1", "trigger-1", "message-welcome"),
    edge("e2", "message-welcome", "buttons-menu"),
    edge("e3", "buttons-menu", "message-order-prompt", btnOrderStatus),
    edge("e4", "message-order-prompt", "condition-order"),
    edge("e5", "condition-order", "message-order-found", "true"),
    edge("e6", "message-order-found", "handoff-order"),
    edge("e7", "handoff-order", "end-order-found"),
    edge("e8", "condition-order", "message-order-notfound", "false"),
    edge("e9", "message-order-notfound", "end-order-notfound"),
    edge("e10", "buttons-menu", "message-ticket", btnTicket),
    edge("e11", "message-ticket", "handoff-ticket"),
    edge("e12", "handoff-ticket", "end-ticket"),
    edge("e13", "buttons-menu", "message-faq", btnFaq),
    edge("e14", "message-faq", "end-faq"),
    edge("e15", "buttons-menu", "handoff-agent", btnAgent),
    edge("e16", "handoff-agent", "end-agent"),
  ];

  return {
    name: copy[locale].flowName,
    nodes,
    edges,
    entryNodeId: "trigger-1",
    welcomeMessage: copy[locale].welcome,
  };
}

export const supportTemplate: BotIndustryTemplate = {
  id: "support",
  icon: Headphones,
  getSystemPrompt: (locale) => copy[locale].systemPrompt,
  getDefaultBotName: (locale) => copy[locale].botName,
  getFlowDefinition: buildFlow,
};
