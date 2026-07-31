import { Building2 } from "lucide-react";
import type { BotIndustryTemplate, BotTemplateLocale } from "./types";
import {
  bookAppointmentNode,
  branchX,
  bilingual,
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
    botName: "Asistente inmobiliario",
    flowName: "Atención inmobiliaria",
    systemPrompt:
      "Eres el asistente virtual de una inmobiliaria. Ayudas con información de propiedades, visitas, precios y requisitos. Sé profesional y claro. No inventes datos de propiedades; si no tienes la información, ofrece conectar con un asesor. Agenda visitas cuando el cliente lo solicite.",
    welcome: "¡Hola! Bienvenido a nuestra inmobiliaria. ¿En qué podemos ayudarte?",
    menuPrompt: "Selecciona una opción:",
    btnProperties: "Ver propiedades",
    btnVisit: "Agendar visita",
    btnPricing: "Precios",
    btnAgent: "Hablar con asesor",
    propertiesMessage:
      "Tenemos apartamentos, casas y locales disponibles en varias zonas. Un asesor puede enviarte opciones según tu presupuesto y ubicación preferida.",
    visitConfirm: "Tu visita ha sido agendada. Un asesor te confirmará los detalles.",
    pricingMessage:
      "Los precios varían según zona, tamaño y tipo de propiedad. Comparte tu presupuesto y te enviamos opciones personalizadas.",
  },
  en: {
    botName: "Real estate assistant",
    flowName: "Real estate care",
    systemPrompt:
      "You are the virtual assistant for a real estate agency. You help with property information, visits, pricing, and requirements. Be professional and clear. Do not invent property data; if you lack information, offer to connect with an advisor. Schedule visits when the client requests them.",
    welcome: "Hello! Welcome to our real estate agency. How can we help you?",
    menuPrompt: "Select an option:",
    btnProperties: "View properties",
    btnVisit: "Schedule visit",
    btnPricing: "Pricing",
    btnAgent: "Talk to advisor",
    propertiesMessage:
      "We have apartments, houses, and commercial spaces in several areas. An advisor can send options based on your budget and preferred location.",
    visitConfirm: "Your visit has been scheduled. An advisor will confirm the details.",
    pricingMessage:
      "Prices vary by area, size, and property type. Share your budget and we will send personalized options.",
  },
} as const;

function buildFlow(locale: BotTemplateLocale) {
  const es = copy.es;
  const en = copy.en;
  const btnProperties = "btn-properties";
  const btnVisit = "btn-visit";
  const btnPricing = "btn-pricing";
  const btnAgent = "btn-agent";

  const nodes = [
    triggerNode("trigger-1", "first_message", "Start", rowY(0)),
    messageNode("message-welcome", bilingual(es.welcome, en.welcome), "Welcome", 400, rowY(1)),
    buttonsNode(
      "buttons-menu",
      bilingual(es.menuPrompt, en.menuPrompt),
      [
        { id: btnProperties, title: bilingual(es.btnProperties, en.btnProperties) },
        { id: btnVisit, title: bilingual(es.btnVisit, en.btnVisit) },
        { id: btnPricing, title: bilingual(es.btnPricing, en.btnPricing) },
        { id: btnAgent, title: bilingual(es.btnAgent, en.btnAgent) },
      ],
      "Menu",
      rowY(2)
    ),
    messageNode("message-properties", bilingual(es.propertiesMessage, en.propertiesMessage), "Properties", branchX(0, 4), rowY(3)),
    handoffNode("handoff-properties", "Handoff", branchX(0, 4), rowY(4)),
    endNode("end-properties", "End", branchX(0, 4), rowY(5)),
    bookAppointmentNode("book-visit", bilingual(es.visitConfirm, en.visitConfirm), "Visit", branchX(1, 4), rowY(3)),
    endNode("end-visit", "End", branchX(1, 4), rowY(4)),
    messageNode("message-pricing", bilingual(es.pricingMessage, en.pricingMessage), "Pricing", branchX(2, 4), rowY(3)),
    endNode("end-pricing", "End", branchX(2, 4), rowY(4)),
    handoffNode("handoff-agent", "Handoff", branchX(3, 4), rowY(3)),
    endNode("end-agent", "End", branchX(3, 4), rowY(4)),
  ];

  const edges = [
    edge("e1", "trigger-1", "message-welcome"),
    edge("e2", "message-welcome", "buttons-menu"),
    edge("e3", "buttons-menu", "message-properties", btnProperties),
    edge("e4", "message-properties", "handoff-properties"),
    edge("e5", "handoff-properties", "end-properties"),
    edge("e6", "buttons-menu", "book-visit", btnVisit),
    edge("e7", "book-visit", "end-visit"),
    edge("e8", "buttons-menu", "message-pricing", btnPricing),
    edge("e9", "message-pricing", "end-pricing"),
    edge("e10", "buttons-menu", "handoff-agent", btnAgent),
    edge("e11", "handoff-agent", "end-agent"),
  ];

  return {
    name: copy[locale].flowName,
    nodes,
    edges,
    entryNodeId: "trigger-1",
    welcomeMessage: copy[locale].welcome,
  };
}

export const realEstateTemplate: BotIndustryTemplate = {
  id: "real_estate",
  icon: Building2,
  getSystemPrompt: (locale) => copy[locale].systemPrompt,
  getDefaultBotName: (locale) => copy[locale].botName,
  getFlowDefinition: buildFlow,
};
