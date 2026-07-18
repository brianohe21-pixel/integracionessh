import { ShoppingBag } from "lucide-react";
import type { BotIndustryTemplate, BotTemplateLocale } from "./types";
import {
  awaitOrderNode,
  branchX,
  buttonsNode,
  edge,
  endNode,
  handoffNode,
  messageNode,
  rowY,
  sendCatalogNode,
  triggerNode,
} from "./flow-builder";

const copy = {
  es: {
    botName: "Asistente de tienda",
    flowName: "Ventas y pedidos",
    systemPrompt:
      "Eres el asistente virtual de una tienda online o retail. Ayudas con catálogo, ofertas, estado de pedidos y recomendaciones de productos. Sé amable y orientado a ventas sin ser insistente. Si el cliente necesita ayuda personalizada, transfiere a un asesor humano.",
    welcome: "¡Hola! Bienvenido a nuestra tienda. ¿Qué te gustaría hacer hoy?",
    menuPrompt: "Elige una opción:",
    btnCatalog: "Ver catálogo",
    btnOrder: "Mi pedido",
    btnDeals: "Ofertas",
    btnAgent: "Hablar con asesor",
    catalogMessage: "Aquí tienes nuestro catálogo de productos:",
    orderPrompt: "Comparte tu número de pedido o descríbelo y te ayudamos a rastrearlo.",
    orderConfirm: "Gracias. Estamos revisando tu pedido y te responderemos en breve.",
    dealsMessage:
      "Esta semana tenemos hasta 30% de descuento en productos seleccionados. ¿Quieres ver el catálogo?",
  },
  en: {
    botName: "Store assistant",
    flowName: "Sales and orders",
    systemPrompt:
      "You are the virtual assistant for an online or retail store. You help with catalog, deals, order status, and product recommendations. Be friendly and sales-oriented without being pushy. If the customer needs personalized help, transfer to a human advisor.",
    welcome: "Hello! Welcome to our store. What would you like to do today?",
    menuPrompt: "Choose an option:",
    btnCatalog: "View catalog",
    btnOrder: "My order",
    btnDeals: "Deals",
    btnAgent: "Talk to advisor",
    catalogMessage: "Here is our product catalog:",
    orderPrompt: "Share your order number or describe it and we will help you track it.",
    orderConfirm: "Thank you. We are reviewing your order and will reply shortly.",
    dealsMessage:
      "This week we have up to 30% off on selected products. Would you like to see the catalog?",
  },
} as const;

function buildFlow(locale: BotTemplateLocale) {
  const t = copy[locale];
  const btnCatalog = "btn-catalog";
  const btnOrder = "btn-order";
  const btnDeals = "btn-deals";
  const btnAgent = "btn-agent";

  const nodes = [
    triggerNode("trigger-1", "first_message", "Start", rowY(0)),
    messageNode("message-welcome", t.welcome, "Welcome", 400, rowY(1)),
    buttonsNode(
      "buttons-menu",
      t.menuPrompt,
      [
        { id: btnCatalog, title: t.btnCatalog },
        { id: btnOrder, title: t.btnOrder },
        { id: btnDeals, title: t.btnDeals },
        { id: btnAgent, title: t.btnAgent },
      ],
      "Menu",
      rowY(2)
    ),
    sendCatalogNode("send-catalog", t.catalogMessage, "Catalog", branchX(0, 4), rowY(3)),
    endNode("end-catalog", "End", branchX(0, 4), rowY(4)),
    awaitOrderNode(
      "await-order",
      t.orderPrompt,
      t.orderConfirm,
      "Order",
      branchX(1, 4),
      rowY(3)
    ),
    endNode("end-order", "End", branchX(1, 4), rowY(4)),
    messageNode("message-deals", t.dealsMessage, "Deals", branchX(2, 4), rowY(3)),
    endNode("end-deals", "End", branchX(2, 4), rowY(4)),
    handoffNode("handoff-agent", "Handoff", branchX(3, 4), rowY(3)),
    endNode("end-agent", "End", branchX(3, 4), rowY(4)),
  ];

  const edges = [
    edge("e1", "trigger-1", "message-welcome"),
    edge("e2", "message-welcome", "buttons-menu"),
    edge("e3", "buttons-menu", "send-catalog", btnCatalog),
    edge("e4", "send-catalog", "end-catalog"),
    edge("e5", "buttons-menu", "await-order", btnOrder),
    edge("e6", "await-order", "end-order"),
    edge("e7", "buttons-menu", "message-deals", btnDeals),
    edge("e8", "message-deals", "end-deals"),
    edge("e9", "buttons-menu", "handoff-agent", btnAgent),
    edge("e10", "handoff-agent", "end-agent"),
  ];

  return {
    name: t.flowName,
    nodes,
    edges,
    entryNodeId: "trigger-1",
    welcomeMessage: t.welcome,
  };
}

export const retailTemplate: BotIndustryTemplate = {
  id: "retail",
  icon: ShoppingBag,
  getSystemPrompt: (locale) => copy[locale].systemPrompt,
  getDefaultBotName: (locale) => copy[locale].botName,
  getFlowDefinition: buildFlow,
};
