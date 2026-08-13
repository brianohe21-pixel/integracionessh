import type { FlowDefinition, FlowEdge, FlowNode } from "../../types/index.js";

const BASE_URL = "https://bot-integration.satelital355.com";
const CENTER_X = 400;
const ROW = 130;

function pos(x: number, y: number) {
  return { x, y };
}

function edge(id: string, source: string, target: string, sourceHandle?: string): FlowEdge {
  return { id, source, target, ...(sourceHandle ? { sourceHandle } : {}) };
}

function httpNode(
  id: string,
  label: string,
  toolName: string,
  description: string,
  method: "GET" | "POST" | "PATCH",
  url: string,
  body: string,
  headers: Array<{ key: string; value: string }>,
  responseVariable: string,
  instruction: string,
  x: number,
  y: number
): FlowNode {
  return {
    id,
    type: "http_request",
    position: pos(x, y),
    data: {
      label,
      httpMethod: method,
      httpUrl: url,
      httpBody: body,
      httpHeaders: headers,
      httpResponseVariable: responseVariable,
      voiceToolName: toolName,
      voiceToolDescription: description,
      voiceInstruction: instruction,
      voiceToolParameters: JSON.stringify(
        toolName === "lookup_customer"
          ? {
              type: "object",
              properties: {
                phone_country_code: { type: "string", description: "Country code without +" },
                phone_number: { type: "string", description: "Phone number without country code" },
              },
              required: ["phone_country_code", "phone_number"],
            }
          : toolName === "autocomplete_street"
            ? {
                type: "object",
                properties: {
                  q: { type: "string", description: "Street search text, min 2 chars" },
                },
                required: ["q"],
              }
            : toolName === "resolve_street"
              ? {
                  type: "object",
                  properties: {
                    place_id: { type: "string", description: "place_id from autocomplete" },
                  },
                  required: ["place_id"],
                }
              : toolName === "create_customer"
                ? {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      phone_country_code: { type: "string" },
                      phone_number: { type: "string" },
                      email: { type: "string" },
                    },
                    required: ["name", "phone_country_code", "phone_number"],
                  }
                : toolName === "create_offer"
                  ? {
                      type: "object",
                      properties: {
                        origin_lat: { type: "number" },
                        origin_lng: { type: "number" },
                        origin_main_text: { type: "string" },
                        origin_secondary_text: { type: "string" },
                        destination_lat: { type: "number" },
                        destination_lng: { type: "number" },
                        destination_main_text: { type: "string" },
                        destination_secondary_text: { type: "string" },
                      },
                      required: [
                        "origin_lat",
                        "origin_lng",
                        "origin_main_text",
                        "destination_lat",
                        "destination_lng",
                        "destination_main_text",
                      ],
                    }
                  : toolName === "create_trip"
                    ? {
                        type: "object",
                        properties: {
                          offer_id: { type: "string" },
                        },
                        required: ["offer_id"],
                      }
                    : toolName === "get_trip"
                      ? {
                          type: "object",
                          properties: {
                            trip_id: { type: "string" },
                          },
                          required: ["trip_id"],
                        }
                      : toolName === "cancel_trip"
                        ? {
                            type: "object",
                            properties: {
                              trip_id: { type: "string" },
                            },
                            required: ["trip_id"],
                          }
                        : toolName === "list_active_trips"
                          ? { type: "object", properties: {} }
                          : { type: "object", properties: {} }
      ),
    },
  };
}

const apiHeaders = [
  { key: "X-Api-Key", value: "{{secret.FYRAGO_API_KEY}}" },
  { key: "Content-Type", value: "application/json" },
];

export function buildTaxi355SatelitalVoiceFlow(params: {
  flowId: string;
  tenantId: string;
  botId: string;
  companyId: string;
  now?: string;
}): FlowDefinition {
  const now = params.now ?? new Date().toISOString();
  const nodes: FlowNode[] = [
    {
      id: "trigger-voice",
      type: "trigger",
      position: pos(CENTER_X, 40),
      data: {
        label: "Llamada entrante",
        triggerType: "voice_call",
        flowVariables: {
          company_id: params.companyId,
          api_base_url: BASE_URL,
          demo_mode: "true",
          default_city: "Lima",
          default_country: "Perú",
          default_currency: "PEN",
          default_customer_id: "demo-customer-001",
        },
      },
    },
    {
      id: "msg-greeting",
      type: "message",
      position: pos(CENTER_X, 40 + ROW),
      data: {
        label: "Saludo",
        messageText:
          "Saluda como 355 Satelital. Identifica si el cliente quiere solicitar taxi, consultar servicio, cancelar, consultar tarifa o hablar con operador.",
      },
    },
    {
      id: "msg-request-taxi",
      type: "message",
      position: pos(120, 40 + ROW * 2),
      data: {
        label: "Solicitar taxi",
        messageText:
          "Pide solo origen y destino. Acepta las direcciones como las diga el cliente y avanza sin confirmaciones extra. No pidas teléfono. Usa las herramientas en segundo plano, comunica tarifa en soles y confirma el viaje.",
      },
    },
    httpNode(
      "http-autocomplete",
      "Autocompletar calle",
      "autocomplete_street",
      "Autocomplete a street address",
      "GET",
      `${BASE_URL}/v1/streets/autocomplete?q={{args.q}}`,
      "",
      [{ key: "X-Api-Key", value: "{{secret.FYRAGO_API_KEY}}" }],
      "street_autocomplete",
      "Autocompleta en segundo plano; si hay coincidencia, úsala sin preguntar al cliente.",
      120,
      40 + ROW * 3
    ),
    httpNode(
      "http-resolve-street",
      "Resolver calle",
      "resolve_street",
      "Resolve street coordinates from place_id",
      "GET",
      `${BASE_URL}/v1/streets/{{args.place_id}}`,
      "",
      [{ key: "X-Api-Key", value: "{{secret.FYRAGO_API_KEY}}" }],
      "street_detail",
      "Resuelve coordenadas de la dirección elegida sin pedir más datos.",
      120,
      40 + ROW * 4
    ),
    httpNode(
      "http-create-offer",
      "Consultar oferta",
      "create_offer",
      "Create trip offers and fare estimate",
      "POST",
      `${BASE_URL}/v1/offers`,
      JSON.stringify(
        {
          company_id: "{{var.company_id}}",
          customer_id: "{{var.default_customer_id}}",
          origin: {
            lat: "{{args.origin_lat}}",
            lng: "{{args.origin_lng}}",
            main_text: "{{args.origin_main_text}}",
            secondary_text: "{{args.origin_secondary_text}}",
          },
          destination: {
            lat: "{{args.destination_lat}}",
            lng: "{{args.destination_lng}}",
            main_text: "{{args.destination_main_text}}",
            secondary_text: "{{args.destination_secondary_text}}",
          },
        },
        null,
        2
      ),
      apiHeaders,
      "offer_response",
      "Consulta disponibilidad y tarifa del viaje.",
      120,
      40 + ROW * 5
    ),
    httpNode(
      "http-create-trip",
      "Crear viaje",
      "create_trip",
      "Create a trip from a selected offer_id",
      "POST",
      `${BASE_URL}/v1/trips`,
      JSON.stringify({ offer_id: "{{args.offer_id}}" }, null, 2),
      apiHeaders,
      "trip_created",
      "Crea la solicitud de taxi con la oferta elegida.",
      120,
      40 + ROW * 6
    ),
    httpNode(
      "http-get-trip",
      "Consultar viaje",
      "get_trip",
      "Get trip status by id",
      "GET",
      `${BASE_URL}/v1/trips/{{args.trip_id}}`,
      "",
      [{ key: "X-Api-Key", value: "{{secret.FYRAGO_API_KEY}}" }],
      "trip_status",
      "Consulta el estado del viaje y si ya hay conductor asignado.",
      520,
      40 + ROW * 3
    ),
    httpNode(
      "http-list-active",
      "Viajes activos",
      "list_active_trips",
      "List active trips for a customer",
      "GET",
      `${BASE_URL}/v1/trips/active?customer_id={{var.default_customer_id}}`,
      "",
      [{ key: "X-Api-Key", value: "{{secret.FYRAGO_API_KEY}}" }],
      "active_trips",
      "Lista viajes en curso del cliente.",
      520,
      40 + ROW * 4
    ),
    httpNode(
      "http-cancel-trip",
      "Cancelar viaje",
      "cancel_trip",
      "Cancel a trip by id",
      "PATCH",
      `${BASE_URL}/v1/trips/{{args.trip_id}}/cancel`,
      "",
      [{ key: "X-Api-Key", value: "{{secret.FYRAGO_API_KEY}}" }],
      "trip_cancelled",
      "Cancela un viaje activo o pendiente.",
      520,
      40 + ROW * 5
    ),
    {
      id: "msg-consult-service",
      type: "message",
      position: pos(520, 40 + ROW * 2),
      data: {
        label: "Consultar servicio",
        messageText:
          "Consulta el viaje activo o por ID. Informa el estado en español: pendiente, en camino, finalizado o cancelado. Incluye datos del conductor si existen.",
      },
    },
    {
      id: "msg-cancel",
      type: "message",
      position: pos(820, 40 + ROW * 2),
      data: {
        label: "Cancelar taxi",
        messageText: "Confirma el viaje a cancelar y usa cancel_trip.",
      },
    },
    {
      id: "msg-fare",
      type: "message",
      position: pos(1120, 40 + ROW * 2),
      data: {
        label: "Consultar tarifa",
        messageText:
          "Pide solo origen y destino, consulta create_offer sin confirmar viaje y comunica precio en soles y ETA si están disponibles.",
      },
    },
    {
      id: "handoff-operator",
      type: "handoff",
      position: pos(1420, 40 + ROW * 2),
      data: {
        label: "Operador",
        haltPipeline: true,
      },
    },
    {
      id: "msg-tracking",
      type: "message",
      position: pos(CENTER_X, 40 + ROW * 7),
      data: {
        label: "Seguimiento",
        messageText:
          "Tras crear el viaje, di que quedó en estado pendiente. No uses códigos en inglés como PENDING. Simula que ya encontraste conductor, confirma el viaje y comunica nombre, vehículo y placa. Indica que va en camino al punto de recojo.",
      },
    },
    {
      id: "end-call",
      type: "end",
      position: pos(CENTER_X, 40 + ROW * 8),
      data: { label: "Fin", haltPipeline: true },
    },
  ];

  const edges: FlowEdge[] = [
    edge("e1", "trigger-voice", "msg-greeting"),
    edge("e2", "msg-greeting", "msg-request-taxi"),
    edge("e3", "msg-greeting", "msg-consult-service"),
    edge("e4", "msg-greeting", "msg-cancel"),
    edge("e5", "msg-greeting", "msg-fare"),
    edge("e6", "msg-greeting", "handoff-operator"),
    edge("e7", "msg-request-taxi", "http-autocomplete"),
    edge("e8", "http-autocomplete", "http-resolve-street"),
    edge("e9", "http-resolve-street", "http-create-offer"),
    edge("e10", "http-create-offer", "http-create-trip"),
    edge("e11", "http-create-trip", "msg-tracking"),
    edge("e12", "msg-consult-service", "http-get-trip"),
    edge("e13", "http-get-trip", "http-list-active"),
    edge("e14", "msg-cancel", "http-cancel-trip"),
    edge("e15", "msg-fare", "http-create-offer"),
    edge("e16", "msg-tracking", "end-call"),
    edge("e17", "http-cancel-trip", "end-call"),
    edge("e18", "http-list-active", "end-call"),
    edge("e19", "handoff-operator", "end-call"),
  ];

  return {
    flowId: params.flowId,
    tenantId: params.tenantId,
    botId: params.botId,
    name: "355 Satelital - Agente de voz",
    flowKind: "voice_ai",
    enabled: false,
    version: 1,
    nodes,
    edges,
    entryNodeId: "trigger-voice",
    createdAt: now,
    updatedAt: now,
  };
}
