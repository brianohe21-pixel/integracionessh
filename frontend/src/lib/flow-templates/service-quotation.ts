import type { FlowTemplate } from "./types";
import {
  bilingual,
  conditionNode,
  createLeadNode,
  edge,
  endNode,
  formTriggerNode,
  httpRequestNode,
  rowY,
  saveContactNode,
  sendNotificationNode,
  setVariableNode,
} from "../bot-templates/flow-builder";

const FORM_SAMPLE_PAYLOAD = {
  principal_name: "John Smith",
  whatsapp_number: "+447123456789",
  site_address: "123 Main Street, London",
  postcode: "SL3 7FG",
  email: "name@example.com",
  parking_availability: "Free Parking Provided",
  consent: true,
  kitchen_type: "No Kitchen required",
  kitchen_extras: [],
  bathroom_qty: 0,
  bathroom_type: "Small - Cloakroom / WC",
  bathroom_extras: [],
};

const HTTP_BODY = `{
  "name": "{{form.principal_name}}",
  "phone": "{{form.whatsapp_number}}",
  "email": "{{form.email}}",
  "address": "{{form.site_address}}",
  "postcode": "{{form.postcode}}",
  "parking": "{{form.parking_availability}}",
  "kitchen_type": "{{form.kitchen_type}}",
  "kitchen_extras": {{form.kitchen_extras}},
  "bathroom_qty": "{{form.bathroom_qty}}",
  "bathroom_type": "{{form.bathroom_type}}",
  "bathroom_extras": {{form.bathroom_extras}}
}`;

function buildServiceQuotationFlow() {
  const cx = 420;
  const leftX = 120;
  const rightX = 720;

  const nodes = [
    formTriggerNode("trigger-1", "Form submitted", FORM_SAMPLE_PAYLOAD, cx, rowY(0)),
    conditionNode(
      "condition-consent",
      "form.consent",
      "equals",
      "true",
      "Consent given?",
      cx,
      rowY(1)
    ),
    sendNotificationNode(
      "notify-no-consent",
      {
        channel: "whatsapp",
        recipient: "{{form.whatsapp_number}}",
        messageText: bilingual(
          "No pudimos procesar tu solicitud porque no aceptaste los términos. Contáctanos si necesitas ayuda.",
          "We could not process your request because consent was not given. Contact us if you need help."
        ),
      },
      "Reject – no consent",
      leftX,
      rowY(2)
    ),
    endNode("end-no-consent", "End", leftX, rowY(3)),
    saveContactNode(
      "save-contact",
      {
        phone: "{{form.whatsapp_number}}",
        name: "{{form.principal_name}}",
        email: "{{form.email}}",
      },
      "Save contact",
      ["service-quote"],
      cx,
      rowY(2)
    ),
    createLeadNode(
      "create-lead",
      {
        phone: "{{form.whatsapp_number}}",
        name: "{{form.principal_name}}",
        email: "{{form.email}}",
      },
      "Create lead",
      ["service-quote", "uk-installation"],
      cx,
      rowY(3)
    ),
    conditionNode(
      "condition-kitchen",
      "form.kitchen_type",
      "not_equals",
      "No Kitchen required",
      "Kitchen required?",
      cx,
      rowY(4)
    ),
    setVariableNode(
      "set-kitchen",
      "kitchen_configured",
      "true",
      "Flag kitchen",
      rightX,
      rowY(5)
    ),
    conditionNode(
      "condition-bathroom",
      "form.bathroom_qty",
      "not_equals",
      "0",
      "Bathrooms > 0?",
      cx,
      rowY(6)
    ),
    setVariableNode(
      "set-bathroom",
      "bathroom_configured",
      "true",
      "Flag bathroom",
      rightX,
      rowY(7)
    ),
    httpRequestNode(
      "http-quote",
      {
        url: "https://api.example.com/quotes",
        method: "POST",
        body: HTTP_BODY,
        responseVariable: "quote_response",
      },
      "Calculate quote",
      cx,
      rowY(8)
    ),
    sendNotificationNode(
      "notify-customer",
      {
        channel: "whatsapp",
        recipient: "{{form.whatsapp_number}}",
        messageText: bilingual(
          "Hola {{form.principal_name}}, recibimos tu solicitud de cotización para {{form.site_address}} ({{form.postcode}}). Un asesor validará los detalles y te contactará pronto.",
          "Hi {{form.principal_name}}, we received your quote request for {{form.site_address}} ({{form.postcode}}). An advisor will validate the details and contact you soon."
        ),
      },
      "WhatsApp confirmation",
      cx,
      rowY(9)
    ),
    sendNotificationNode(
      "notify-team",
      {
        channel: "email",
        recipient: "{{form.email}}",
        messageText: bilingual(
          "Nueva cotización: {{form.principal_name}} – {{form.site_address}}, {{form.postcode}}. Cocina: {{form.kitchen_type}}. Baños: {{form.bathroom_qty}}.",
          "New quote: {{form.principal_name}} – {{form.site_address}}, {{form.postcode}}. Kitchen: {{form.kitchen_type}}. Bathrooms: {{form.bathroom_qty}}."
        ),
      },
      "Email to team",
      cx,
      rowY(10)
    ),
    endNode("end-success", "End", cx, rowY(11)),
  ];

  const edges = [
    edge("e1", "trigger-1", "condition-consent"),
    edge("e2", "condition-consent", "notify-no-consent", "false"),
    edge("e3", "notify-no-consent", "end-no-consent"),
    edge("e4", "condition-consent", "save-contact", "true"),
    edge("e5", "save-contact", "create-lead"),
    edge("e6", "create-lead", "condition-kitchen"),
    edge("e7", "condition-kitchen", "set-kitchen", "true"),
    edge("e8", "condition-kitchen", "condition-bathroom", "false"),
    edge("e9", "set-kitchen", "condition-bathroom"),
    edge("e10", "condition-bathroom", "set-bathroom", "true"),
    edge("e11", "condition-bathroom", "http-quote", "false"),
    edge("e12", "set-bathroom", "http-quote"),
    edge("e13", "http-quote", "notify-customer"),
    edge("e14", "notify-customer", "notify-team"),
    edge("e15", "notify-team", "end-success"),
  ];

  return { nodes, edges, entryNodeId: "trigger-1" };
}

export const serviceQuotationTemplate: FlowTemplate = {
  id: "service_quotation",
  name: {
    es: "Cotización de servicios",
    en: "Service quotation",
  },
  description: {
    es: "Procesa el formulario de logística, cocina y baño: guarda contacto, crea lead, calcula cotización y envía confirmaciones.",
    en: "Processes site logistics, kitchen and bathroom form: saves contact, creates lead, calculates quote and sends confirmations.",
  },
  defaultFlowName: {
    es: "Cotización instalación UK",
    en: "UK installation quote",
  },
  getDefinition: buildServiceQuotationFlow,
};
