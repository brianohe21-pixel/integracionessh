import { buildCurlExample } from "./curl";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type ApiDocEndpoint = {
  id: string;
  method: HttpMethod;
  path: string;
  scope: string;
  descriptionKey: string;
  requestExample?: string;
  responseExample: string;
  curlExample: string;
  notesKey?: string;
};

const SEND_MESSAGE_TEXT_BODY = '{"to":"521234567890","type":"text","text":"Hello!"}';

const SEND_MESSAGE_TEMPLATE_BODY = JSON.stringify(
  {
    to: "521234567890",
    type: "template",
    template: {
      name: "hello_world",
      language: "en_US",
    },
  },
  null,
  2
);

const CREATE_TEMPLATE_BODY = JSON.stringify(
  {
    name: "order_update",
    language: "es",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Hola {{1}}, tu pedido {{2}} está listo.",
        example: {
          body_text: [["Juan", "12345"]],
        },
      },
      {
        type: "FOOTER",
        text: "Gracias por tu compra",
      },
    ],
  },
  null,
  2
);

const UPDATE_TEMPLATE_BODY = JSON.stringify(
  {
    language: "es",
    components: [
      {
        type: "BODY",
        text: "Hola {{1}}, tu pedido {{2}} fue actualizado.",
        example: {
          body_text: [["Juan", "12345"]],
        },
      },
    ],
  },
  null,
  2
);

const TEMPLATE_RESPONSE = JSON.stringify(
  {
    name: "order_update",
    language: "es",
    category: "UTILITY",
    status: "PENDING",
    components: [
      {
        type: "BODY",
        text: "Hola {{1}}, tu pedido {{2}} está listo.",
        example: {
          body_text: [["Juan", "12345"]],
        },
      },
    ],
    metaTemplateId: "1234567890",
    syncedAt: "2026-06-17T12:00:00.000Z",
    createdAt: "2026-06-17T12:00:00.000Z",
  },
  null,
  2
);

const TEMPLATES_LIST_RESPONSE = JSON.stringify(
  [
    {
      name: "hello_world",
      language: "en_US",
      category: "UTILITY",
      status: "APPROVED",
      components: [{ type: "BODY", text: "Hello World" }],
      metaTemplateId: "111",
      syncedAt: "2026-06-17T12:00:00.000Z",
      createdAt: "2026-06-17T12:00:00.000Z",
    },
  ],
  null,
  2
);

const INITIATE_CALL_BODY = JSON.stringify(
  {
    to: "521234567890",
    session: {
      sdp_type: "offer",
      sdp: "v=0...",
    },
  },
  null,
  2
);

const CALL_ACTION_BODY = JSON.stringify(
  {
    action: "accept",
    session: {
      sdp_type: "answer",
      sdp: "v=0...",
    },
  },
  null,
  2
);

const UPDATE_CALL_SETTINGS_BODY = JSON.stringify(
  {
    calling: {
      status: "ENABLED",
    },
  },
  null,
  2
);

const PERMISSION_REQUEST_BODY = '{"to":"521234567890","bodyText":"Can we call you?"}';

const SEND_SMS_BODY = '{"to":"573001234567","text":"Hello from SMS API"}';

const SMS_TRACE_RESPONSE = JSON.stringify(
  {
    traceId: "550e8400-e29b-41d4-a716-446655440000",
    phone: "573001234567",
    channel: "sms",
    status: "delivered",
    failureKind: null,
    externalMessageId: "telcored-123",
    telcoredMessageId: "telcored-123",
    sendErrorMessage: null,
    deliveryErrorCode: null,
    deliveryErrorMessage: null,
    deliveryStatus: "DELIVRD",
    finalDeliveryCode: 1,
    lastIntermediateCode: null,
    sentAt: "2026-06-17T12:00:01.000Z",
    deliveredAt: "2026-06-17T12:00:05.000Z",
    failedAt: null,
    dlrAt: "2026-06-17T12:00:05.000Z",
    cost: "0.02",
    part: "1",
    sender: "msg",
    requestDlr: true,
    createdAt: "2026-06-17T12:00:00.000Z",
    updatedAt: "2026-06-17T12:00:05.000Z",
  },
  null,
  2
);

export const API_DOC_ENDPOINTS: ApiDocEndpoint[] = [
  {
    id: "send-message-text",
    method: "POST",
    path: "/v1/messages",
    scope: "messages:send",
    descriptionKey: "apiDocs.endpoints.sendMessageText",
    requestExample: SEND_MESSAGE_TEXT_BODY,
    responseExample: JSON.stringify(
      { messageId: "wamid.xxx", status: "sent", timestamp: "2026-06-17T12:00:00.000Z" },
      null,
      2
    ),
    curlExample: buildCurlExample({
      method: "POST",
      path: "/v1/messages",
      body: SEND_MESSAGE_TEXT_BODY,
    }),
    notesKey: "apiDocs.endpoints.sendMessageNotes",
  },
  {
    id: "send-sms",
    method: "POST",
    path: "/v1/sms",
    scope: "sms:send",
    descriptionKey: "apiDocs.endpoints.sendSms",
    requestExample: SEND_SMS_BODY,
    responseExample: JSON.stringify(
      {
        traceId: "550e8400-e29b-41d4-a716-446655440000",
        messageId: "telcored-123",
        status: "sent",
        timestamp: "2026-06-17T12:00:00.000Z",
      },
      null,
      2
    ),
    curlExample: buildCurlExample({
      method: "POST",
      path: "/v1/sms",
      body: SEND_SMS_BODY,
    }),
    notesKey: "apiDocs.endpoints.sendSmsNotes",
  },
  {
    id: "get-sms-trace",
    method: "GET",
    path: "/v1/sms/{traceId}",
    scope: "sms:read",
    descriptionKey: "apiDocs.endpoints.getSmsTrace",
    responseExample: SMS_TRACE_RESPONSE,
    curlExample: buildCurlExample({
      method: "GET",
      path: "/v1/sms/550e8400-e29b-41d4-a716-446655440000",
    }),
    notesKey: "apiDocs.endpoints.getSmsTraceNotes",
  },
  {
    id: "send-message-template",
    method: "POST",
    path: "/v1/messages",
    scope: "messages:send",
    descriptionKey: "apiDocs.endpoints.sendMessageTemplate",
    requestExample: SEND_MESSAGE_TEMPLATE_BODY,
    responseExample: JSON.stringify(
      { messageId: "wamid.xxx", status: "sent", timestamp: "2026-06-17T12:00:00.000Z" },
      null,
      2
    ),
    curlExample: buildCurlExample({
      method: "POST",
      path: "/v1/messages",
      body: SEND_MESSAGE_TEMPLATE_BODY.replace(/\n/g, "").replace(/  +/g, ""),
    }),
  },
  {
    id: "list-templates",
    method: "GET",
    path: "/v1/templates",
    scope: "templates:read",
    descriptionKey: "apiDocs.endpoints.listTemplates",
    responseExample: TEMPLATES_LIST_RESPONSE,
    curlExample: buildCurlExample({ method: "GET", path: "/v1/templates" }),
    notesKey: "apiDocs.endpoints.listTemplatesNotes",
  },
  {
    id: "create-template",
    method: "POST",
    path: "/v1/templates",
    scope: "templates:write",
    descriptionKey: "apiDocs.endpoints.createTemplate",
    requestExample: CREATE_TEMPLATE_BODY,
    responseExample: TEMPLATE_RESPONSE,
    curlExample: buildCurlExample({
      method: "POST",
      path: "/v1/templates",
      body: CREATE_TEMPLATE_BODY.replace(/\n/g, "").replace(/  +/g, ""),
    }),
    notesKey: "apiDocs.endpoints.createTemplateNotes",
  },
  {
    id: "update-template",
    method: "PUT",
    path: "/v1/templates/{name}",
    scope: "templates:write",
    descriptionKey: "apiDocs.endpoints.updateTemplate",
    requestExample: UPDATE_TEMPLATE_BODY,
    responseExample: TEMPLATE_RESPONSE,
    curlExample: buildCurlExample({
      method: "PUT",
      path: "/v1/templates/order_update",
      body: UPDATE_TEMPLATE_BODY.replace(/\n/g, "").replace(/  +/g, ""),
    }),
    notesKey: "apiDocs.endpoints.updateTemplateNotes",
  },
  {
    id: "delete-template",
    method: "DELETE",
    path: "/v1/templates/{name}",
    scope: "templates:write",
    descriptionKey: "apiDocs.endpoints.deleteTemplate",
    responseExample: "",
    curlExample: buildCurlExample({ method: "DELETE", path: "/v1/templates/order_update" }),
    notesKey: "apiDocs.endpoints.deleteTemplateNotes",
  },
  {
    id: "initiate-call",
    method: "POST",
    path: "/v1/calls",
    scope: "calls:initiate",
    descriptionKey: "apiDocs.endpoints.initiateCall",
    requestExample: INITIATE_CALL_BODY,
    responseExample: JSON.stringify(
      { callId: "call_xxx", status: "initiated", timestamp: "2026-06-17T12:00:00.000Z" },
      null,
      2
    ),
    curlExample: buildCurlExample({
      method: "POST",
      path: "/v1/calls",
      body: INITIATE_CALL_BODY.replace(/\n/g, "").replace(/  +/g, ""),
    }),
    notesKey: "apiDocs.endpoints.initiateCallNotes",
  },
  {
    id: "call-action",
    method: "POST",
    path: "/v1/calls/{callId}",
    scope: "calls:manage",
    descriptionKey: "apiDocs.endpoints.callAction",
    requestExample: CALL_ACTION_BODY,
    responseExample: JSON.stringify({ callId: "call_xxx", action: "accept", success: true }, null, 2),
    curlExample: buildCurlExample({
      method: "POST",
      path: "/v1/calls/call_xxx",
      body: CALL_ACTION_BODY.replace(/\n/g, "").replace(/  +/g, ""),
    }),
    notesKey: "apiDocs.endpoints.callActionNotes",
  },
  {
    id: "get-call",
    method: "GET",
    path: "/v1/calls/{callId}",
    scope: "calls:manage",
    descriptionKey: "apiDocs.endpoints.getCall",
    responseExample: JSON.stringify(
      {
        callId: "call_xxx",
        tenantId: "tenant_xxx",
        botId: "bot_xxx",
        phoneNumber: "521234567890",
        direction: "BUSINESS_INITIATED",
        status: "initiated",
        startedAt: "2026-06-17T12:00:00.000Z",
        createdAt: "2026-06-17T12:00:00.000Z",
        updatedAt: "2026-06-17T12:00:00.000Z",
      },
      null,
      2
    ),
    curlExample: buildCurlExample({ method: "GET", path: "/v1/calls/call_xxx" }),
  },
  {
    id: "get-call-settings",
    method: "GET",
    path: "/v1/calls/settings",
    scope: "calls:settings",
    descriptionKey: "apiDocs.endpoints.getCallSettings",
    responseExample: JSON.stringify({ calling: { status: "ENABLED" } }, null, 2),
    curlExample: buildCurlExample({ method: "GET", path: "/v1/calls/settings" }),
  },
  {
    id: "update-call-settings",
    method: "PUT",
    path: "/v1/calls/settings",
    scope: "calls:settings",
    descriptionKey: "apiDocs.endpoints.updateCallSettings",
    requestExample: UPDATE_CALL_SETTINGS_BODY,
    responseExample: JSON.stringify({ calling: { status: "ENABLED" } }, null, 2),
    curlExample: buildCurlExample({
      method: "PUT",
      path: "/v1/calls/settings",
      body: UPDATE_CALL_SETTINGS_BODY.replace(/\n/g, "").replace(/  +/g, ""),
    }),
  },
  {
    id: "permission-request",
    method: "POST",
    path: "/v1/calls/permission-request",
    scope: "calls:initiate",
    descriptionKey: "apiDocs.endpoints.permissionRequest",
    requestExample: PERMISSION_REQUEST_BODY,
    responseExample: JSON.stringify({ messageId: "wamid.xxx", status: "sent" }, null, 2),
    curlExample: buildCurlExample({
      method: "POST",
      path: "/v1/calls/permission-request",
      body: PERMISSION_REQUEST_BODY,
    }),
  },
  {
    id: "get-call-permission",
    method: "GET",
    path: "/v1/calls/permission/{userWaId}",
    scope: "calls:initiate",
    descriptionKey: "apiDocs.endpoints.getCallPermission",
    responseExample: JSON.stringify(
      { permission: { status: "granted", expiration_time: 1718640000 } },
      null,
      2
    ),
    curlExample: buildCurlExample({ method: "GET", path: "/v1/calls/permission/521234567890" }),
  },
];
