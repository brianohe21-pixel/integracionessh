import { buildCurlExample } from "./curl";

export type HttpMethod = "GET" | "POST" | "PUT";

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
