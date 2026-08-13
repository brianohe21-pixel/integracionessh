import type { VoiceAgentHttpTool } from "../../types/index.js";

const BASE_URL = "https://bot-integration.satelital355.com";

const API_HEADERS = [
  { key: "X-Api-Key", value: "{{secret.FYRAGO_API_KEY}}" },
  { key: "Content-Type", value: "application/json" },
];

export const TAXI355_VOICE_AGENT_TOOL_SECRET_NAMES = [
  "FYRAGO_API_KEY",
  "COMPANY_ID",
  "DEFAULT_CUSTOMER_ID",
] as const;

export interface VoiceAgentToolTemplateInput {
  name: string;
  description: string;
  httpUrl: string;
  httpMethod: "GET" | "POST" | "PATCH";
  httpBody?: string;
  httpHeaders?: Array<{ key: string; value: string }>;
  httpResponseVariable?: string;
  parametersJson: string;
  instruction: string;
  sortOrder: number;
}

export function buildTaxi355VoiceAgentToolTemplates(): VoiceAgentToolTemplateInput[] {
  return [
    {
      name: "autocomplete_street",
      description: "Autocomplete a street address",
      httpMethod: "GET",
      httpUrl: `${BASE_URL}/v1/streets/autocomplete?q={{args.q}}`,
      httpHeaders: [{ key: "X-Api-Key", value: "{{secret.FYRAGO_API_KEY}}" }],
      httpResponseVariable: "street_autocomplete",
      instruction: "Autocompleta en segundo plano; si hay coincidencia, úsala sin preguntar al cliente.",
      parametersJson: JSON.stringify({
        type: "object",
        properties: {
          q: { type: "string", description: "Street search text, min 2 chars" },
        },
        required: ["q"],
      }),
      sortOrder: 0,
    },
    {
      name: "resolve_street",
      description: "Resolve street coordinates from place_id",
      httpMethod: "GET",
      httpUrl: `${BASE_URL}/v1/streets/{{args.place_id}}`,
      httpHeaders: [{ key: "X-Api-Key", value: "{{secret.FYRAGO_API_KEY}}" }],
      httpResponseVariable: "street_detail",
      instruction: "Resuelve coordenadas de la dirección elegida sin pedir más datos.",
      parametersJson: JSON.stringify({
        type: "object",
        properties: {
          place_id: { type: "string", description: "place_id from autocomplete" },
        },
        required: ["place_id"],
      }),
      sortOrder: 1,
    },
    {
      name: "create_offer",
      description: "Create trip offers and fare estimate",
      httpMethod: "POST",
      httpUrl: `${BASE_URL}/v1/offers`,
      httpBody: JSON.stringify(
        {
          company_id: "{{secret.COMPANY_ID}}",
          customer_id: "{{secret.DEFAULT_CUSTOMER_ID}}",
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
      httpHeaders: API_HEADERS,
      httpResponseVariable: "offer_response",
      instruction: "Consulta disponibilidad y tarifa del viaje.",
      parametersJson: JSON.stringify({
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
      }),
      sortOrder: 2,
    },
    {
      name: "create_trip",
      description: "Create a trip from a selected offer_id",
      httpMethod: "POST",
      httpUrl: `${BASE_URL}/v1/trips`,
      httpBody: JSON.stringify({ offer_id: "{{args.offer_id}}" }, null, 2),
      httpHeaders: API_HEADERS,
      httpResponseVariable: "trip_created",
      instruction: "Crea la solicitud de taxi con la oferta elegida.",
      parametersJson: JSON.stringify({
        type: "object",
        properties: {
          offer_id: { type: "string" },
        },
        required: ["offer_id"],
      }),
      sortOrder: 3,
    },
    {
      name: "get_trip",
      description: "Get trip status by id",
      httpMethod: "GET",
      httpUrl: `${BASE_URL}/v1/trips/{{args.trip_id}}`,
      httpHeaders: [{ key: "X-Api-Key", value: "{{secret.FYRAGO_API_KEY}}" }],
      httpResponseVariable: "trip_status",
      instruction: "Consulta el estado del viaje y si ya hay conductor asignado.",
      parametersJson: JSON.stringify({
        type: "object",
        properties: {
          trip_id: { type: "string" },
        },
        required: ["trip_id"],
      }),
      sortOrder: 4,
    },
    {
      name: "list_active_trips",
      description: "List active trips for the configured customer",
      httpMethod: "GET",
      httpUrl: `${BASE_URL}/v1/trips/active?customer_id={{secret.DEFAULT_CUSTOMER_ID}}`,
      httpHeaders: [{ key: "X-Api-Key", value: "{{secret.FYRAGO_API_KEY}}" }],
      httpResponseVariable: "active_trips",
      instruction: "Lista viajes en curso del cliente.",
      parametersJson: JSON.stringify({ type: "object", properties: {} }),
      sortOrder: 5,
    },
    {
      name: "cancel_trip",
      description: "Cancel a trip by id",
      httpMethod: "PATCH",
      httpUrl: `${BASE_URL}/v1/trips/{{args.trip_id}}/cancel`,
      httpHeaders: [{ key: "X-Api-Key", value: "{{secret.FYRAGO_API_KEY}}" }],
      httpResponseVariable: "trip_cancelled",
      instruction: "Cancela un viaje activo o pendiente.",
      parametersJson: JSON.stringify({
        type: "object",
        properties: {
          trip_id: { type: "string" },
        },
        required: ["trip_id"],
      }),
      sortOrder: 6,
    },
  ];
}

export function buildTaxi355VoiceAgentSystemPrompt(): string {
  return [
    "Eres Ana, agente de voz de 355 Satelital. Tu objetivo principal es tomar solicitudes reales de taxi de forma breve, natural y segura.",
    "",
    "Saluda una sola vez y detecta si el cliente quiere solicitar taxi, consultar tarifa, consultar un servicio o cancelar.",
    "Habla siempre en español, usa frases cortas y nunca menciones nombres técnicos, códigos internos ni herramientas.",
    "",
    "Reglas generales:",
    "- Considera exitosa una operación solo cuando la herramienta responda ok=true, HTTP 2xx y el cuerpo no indique success=false ni error.",
    "- Conserva y reutiliza place_id, coordenadas, offer_id y trip_id durante toda la llamada. No repitas una herramienta si ya tienes un resultado válido.",
    "- Evita silencios: antes de ejecutar cualquier herramienta responde inmediatamente con una frase breve de espera y luego ejecuta la herramienta.",
    "- Para ubicar direcciones di: Perfecto, dame un momento mientras ubico las direcciones.",
    "- Para consultar tarifa di: Un momento, voy a consultar la tarifa de tu viaje.",
    "- Para crear el viaje di: Perfecto, dame un momento, voy a confirmar tu servicio.",
    "- Para consultar el estado di: Dame un momento, voy a revisar el estado de tu servicio.",
    "- Para cancelar di: Un momento, voy a confirmar la cancelación de tu servicio.",
    "- Usa solo una frase de espera por grupo de herramientas. No repitas la frase, no narres cada paso y no prometas una duración exacta.",
    "- Nunca inventes tarifas, viajes, cancelaciones, estados, conductores, vehículos ni placas.",
    "",
    "Para solicitar taxi:",
    "1. Pide únicamente origen y destino. Acepta las direcciones como las diga el cliente y pregunta una aclaración corta solo si falta una de las dos.",
    "2. Cuando tengas ambas direcciones, ejecuta autocomplete_street para origen y destino en paralelo.",
    "3. Si hay una coincidencia clara, selecciónala. Si hay varias coincidencias realmente distintas, pregunta cuál corresponde.",
    "4. Ejecuta resolve_street para ambos place_id y conserva las coordenadas.",
    "5. Ejecuta create_offer con las direcciones resueltas.",
    "6. Comunica únicamente la tarifa y tiempo devueltos por create_offer en soles (PEN) y pregunta si desea confirmar.",
    "7. Solo después de una confirmación explícita ejecuta create_trip usando el offer_id ya obtenido; no vuelvas a buscar las direcciones.",
    "8. Confirma que el taxi fue solicitado únicamente si create_trip fue exitoso. Informa el estado en español e incluye conductor, vehículo y placa solo si la respuesta los contiene.",
    "",
    "Para consultar tarifa sin crear viaje:",
    "- Sigue los pasos de ubicación y create_offer, comunica la tarifa real y no ejecutes create_trip.",
    "",
    "Para consultar servicio:",
    "- Si conservas un trip_id de esta llamada, usa get_trip.",
    "- Si no tienes trip_id, usa list_active_trips y selecciona el viaje indicado por el cliente.",
    "- Informa el estado como pendiente, en camino, finalizado o cancelado e incluye conductor solo si existe en la respuesta.",
    "",
    "Para cancelar:",
    "- Usa el trip_id conservado; si no existe, usa list_active_trips para identificar el viaje.",
    "- Confirma brevemente cuál viaje cancelará y ejecuta cancel_trip.",
    "- Di que fue cancelado únicamente si cancel_trip fue exitoso.",
    "",
    "Si una herramienta falla, devuelve vacío o no encuentra coincidencias:",
    "- Mantén el flujo y no termines la conversación abruptamente.",
    "- No reintentes ni vuelvas a invocar durante la llamada una herramienta que haya fallado.",
    "- Continúa el flujo conversacional con la información disponible, conserva todos los datos obtenidos y no vuelvas a pedir información que el cliente ya dio.",
    "- Si falla autocomplete_street o resolve_street, conserva la dirección exactamente como la dijo el cliente, solicita únicamente la referencia que falte y continúa con origen y destino.",
    "- Si falla create_offer, informa brevemente que la tarifa está pendiente de validación y pregunta si desea continuar con la solicitud. No inventes una tarifa ni un offer_id.",
    "- Si falla create_trip, informa que la solicitud todavía no está confirmada, conserva origen, destino, tarifa y offer_id, y continúa atendiendo al cliente sin afirmar que el taxi fue solicitado.",
    "- Si falla get_trip o list_active_trips, informa que el estado sigue en validación y continúa usando el trip_id o la referencia que ya tengas sin afirmar un estado no verificado.",
    "- Si falla cancel_trip, informa que la cancelación todavía no está confirmada y conserva el trip_id sin afirmar que el viaje fue cancelado.",
    "- No transfieras la llamada ni ofrezcas un operador humano. Continúa resolviendo la conversación directamente con los datos disponibles.",
    "",
    "Nunca uses códigos en inglés como PENDING, IN_PROGRESS o COMPLETED; tradúcelos al español.",
    "Si el cliente pide un operador humano, explica brevemente que puedes gestionar la solicitud directamente y continúa ayudándolo.",
    "",
    "Herramientas disponibles: autocomplete_street, resolve_street, create_offer, create_trip, get_trip, list_active_trips, cancel_trip.",
  ].join("\n");
}

export function toVoiceAgentHttpTool(
  tenantId: string,
  botId: string,
  toolId: string,
  template: VoiceAgentToolTemplateInput,
  now: string
): VoiceAgentHttpTool {
  return {
    tenantId,
    botId,
    toolId,
    name: template.name,
    description: template.description,
    httpUrl: template.httpUrl,
    httpMethod: template.httpMethod,
    parametersJson: template.parametersJson,
    instruction: template.instruction,
    enabled: true,
    sortOrder: template.sortOrder,
    createdAt: now,
    updatedAt: now,
    ...(template.httpBody !== undefined ? { httpBody: template.httpBody } : {}),
    ...(template.httpHeaders !== undefined ? { httpHeaders: template.httpHeaders } : {}),
    ...(template.httpResponseVariable !== undefined
      ? { httpResponseVariable: template.httpResponseVariable }
      : {}),
  };
}
