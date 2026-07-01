resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project}-${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["Content-Type", "Authorization", "X-Api-Key", "X-Widget-Key"]
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_origins = var.allowed_origins
    max_age       = 300
  }

  tags = var.tags
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw.arn
    format          = "$context.requestId $context.error.message $context.error.messageString $context.httpMethod $context.routeKey $context.status"
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "api_gw" {
  name              = "/aws/api-gateway/${var.project}-${var.environment}"
  retention_in_days = var.environment == "prod" ? 30 : 7
  tags              = var.tags
}

resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-jwt"

  jwt_configuration {
    audience = [var.cognito_client_id]
    issuer   = var.cognito_issuer_url
  }
}

locals {
  routes = {
    webhook_verify = {
      route_key    = "GET /webhook"
      invoke_arn   = var.webhook_invoke_arn
      function_arn = var.webhook_function_arn
      protected    = false
    }
    webhook_receive = {
      route_key    = "POST /webhook"
      invoke_arn   = var.webhook_invoke_arn
      function_arn = var.webhook_function_arn
      protected    = false
    }
    tenants_list = {
      route_key    = "GET /tenants"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    tenants_create = {
      route_key    = "POST /tenants"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    tenants_get = {
      route_key    = "GET /tenants/{tenantId}"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    tenants_update = {
      route_key    = "PUT /tenants/{tenantId}"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    tenants_delete = {
      route_key    = "DELETE /tenants/{tenantId}"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    bots_list = {
      route_key    = "GET /bots"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_create = {
      route_key    = "POST /bots"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_get = {
      route_key    = "GET /bots/{botId}"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_update = {
      route_key    = "PUT /bots/{botId}"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_delete = {
      route_key    = "DELETE /bots/{botId}"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    conversations_list = {
      route_key    = "GET /conversations"
      invoke_arn   = var.conversations_invoke_arn
      function_arn = var.conversations_function_arn
      protected    = true
    }
    conversations_get = {
      route_key    = "GET /conversations/{conversationId}"
      invoke_arn   = var.conversations_invoke_arn
      function_arn = var.conversations_function_arn
      protected    = true
    }
    conversations_handoff = {
      route_key    = "POST /conversations/{conversationId}/handoff"
      invoke_arn   = var.conversations_invoke_arn
      function_arn = var.conversations_function_arn
      protected    = true
    }
    conversations_release = {
      route_key    = "POST /conversations/{conversationId}/release"
      invoke_arn   = var.conversations_invoke_arn
      function_arn = var.conversations_function_arn
      protected    = true
    }
    conversations_send_message = {
      route_key    = "POST /conversations/{conversationId}/messages"
      invoke_arn   = var.conversations_invoke_arn
      function_arn = var.conversations_function_arn
      protected    = true
    }
    conversations_wa_link = {
      route_key    = "GET /conversations/{conversationId}/wa-link"
      invoke_arn   = var.conversations_invoke_arn
      function_arn = var.conversations_function_arn
      protected    = true
    }
    advisors_list = {
      route_key    = "GET /advisors"
      invoke_arn   = var.advisors_invoke_arn
      function_arn = var.advisors_function_arn
      protected    = true
    }
    advisors_create = {
      route_key    = "POST /advisors"
      invoke_arn   = var.advisors_invoke_arn
      function_arn = var.advisors_function_arn
      protected    = true
    }
    advisors_get = {
      route_key    = "GET /advisors/{advisorId}"
      invoke_arn   = var.advisors_invoke_arn
      function_arn = var.advisors_function_arn
      protected    = true
    }
    advisors_update = {
      route_key    = "PUT /advisors/{advisorId}"
      invoke_arn   = var.advisors_invoke_arn
      function_arn = var.advisors_function_arn
      protected    = true
    }
    advisors_delete = {
      route_key    = "DELETE /advisors/{advisorId}"
      invoke_arn   = var.advisors_invoke_arn
      function_arn = var.advisors_function_arn
      protected    = true
    }
    contacts_export = {
      route_key    = "GET /contacts/export"
      invoke_arn   = var.contacts_invoke_arn
      function_arn = var.contacts_function_arn
      protected    = true
    }
    contacts_import = {
      route_key    = "POST /contacts/import"
      invoke_arn   = var.contacts_invoke_arn
      function_arn = var.contacts_function_arn
      protected    = true
    }
    contacts_list = {
      route_key    = "GET /contacts"
      invoke_arn   = var.contacts_invoke_arn
      function_arn = var.contacts_function_arn
      protected    = true
    }
    contacts_create = {
      route_key    = "POST /contacts"
      invoke_arn   = var.contacts_invoke_arn
      function_arn = var.contacts_function_arn
      protected    = true
    }
    contacts_get = {
      route_key    = "GET /contacts/{phone}"
      invoke_arn   = var.contacts_invoke_arn
      function_arn = var.contacts_function_arn
      protected    = true
    }
    contacts_update = {
      route_key    = "PATCH /contacts/{phone}"
      invoke_arn   = var.contacts_invoke_arn
      function_arn = var.contacts_function_arn
      protected    = true
    }
    contacts_delete = {
      route_key    = "DELETE /contacts/{phone}"
      invoke_arn   = var.contacts_invoke_arn
      function_arn = var.contacts_function_arn
      protected    = true
    }
    leads_list = {
      route_key    = "GET /leads"
      invoke_arn   = var.leads_invoke_arn
      function_arn = var.leads_function_arn
      protected    = true
    }
    leads_get = {
      route_key    = "GET /leads/{leadId}"
      invoke_arn   = var.leads_invoke_arn
      function_arn = var.leads_function_arn
      protected    = true
    }
    leads_update = {
      route_key    = "PATCH /leads/{leadId}"
      invoke_arn   = var.leads_invoke_arn
      function_arn = var.leads_function_arn
      protected    = true
    }
    leads_convert = {
      route_key    = "POST /leads/{leadId}/convert"
      invoke_arn   = var.leads_invoke_arn
      function_arn = var.leads_function_arn
      protected    = true
    }
    leads_lose = {
      route_key    = "POST /leads/{leadId}/lose"
      invoke_arn   = var.leads_invoke_arn
      function_arn = var.leads_function_arn
      protected    = true
    }
    leads_delete = {
      route_key    = "DELETE /leads/{leadId}"
      invoke_arn   = var.leads_invoke_arn
      function_arn = var.leads_function_arn
      protected    = true
    }
    templates_list = {
      route_key    = "GET /templates"
      invoke_arn   = var.templates_invoke_arn
      function_arn = var.templates_function_arn
      protected    = true
    }
    templates_create = {
      route_key    = "POST /templates"
      invoke_arn   = var.templates_invoke_arn
      function_arn = var.templates_function_arn
      protected    = true
    }
    templates_update = {
      route_key    = "PUT /templates/{name}"
      invoke_arn   = var.templates_invoke_arn
      function_arn = var.templates_function_arn
      protected    = true
    }
    templates_delete = {
      route_key    = "DELETE /templates/{name}"
      invoke_arn   = var.templates_invoke_arn
      function_arn = var.templates_function_arn
      protected    = true
    }
    templates_send = {
      route_key    = "POST /templates/{name}/send"
      invoke_arn   = var.templates_invoke_arn
      function_arn = var.templates_function_arn
      protected    = true
    }
    bulk_send_create = {
      route_key    = "POST /bulk-send"
      invoke_arn   = var.bulk_send_invoke_arn
      function_arn = var.bulk_send_function_arn
      protected    = true
    }
    bulk_send_list = {
      route_key    = "GET /bulk-send"
      invoke_arn   = var.bulk_send_invoke_arn
      function_arn = var.bulk_send_function_arn
      protected    = true
    }
    bulk_send_get = {
      route_key    = "GET /bulk-send/{jobId}"
      invoke_arn   = var.bulk_send_invoke_arn
      function_arn = var.bulk_send_function_arn
      protected    = true
    }
    bulk_send_failures = {
      route_key    = "GET /bulk-send/{jobId}/failures"
      invoke_arn   = var.bulk_send_invoke_arn
      function_arn = var.bulk_send_function_arn
      protected    = true
    }
    metrics_leads = {
      route_key    = "GET /metrics/leads"
      invoke_arn   = var.metrics_invoke_arn
      function_arn = var.metrics_function_arn
      protected    = true
    }
    metrics_marketing = {
      route_key    = "GET /metrics/marketing"
      invoke_arn   = var.metrics_invoke_arn
      function_arn = var.metrics_function_arn
      protected    = true
    }
    metrics_calling = {
      route_key    = "GET /metrics/calling"
      invoke_arn   = var.metrics_invoke_arn
      function_arn = var.metrics_function_arn
      protected    = true
    }
    metrics_get = {
      route_key    = "GET /metrics"
      invoke_arn   = var.metrics_invoke_arn
      function_arn = var.metrics_function_arn
      protected    = true
    }
    conversations_status = {
      route_key    = "PATCH /conversations/{conversationId}/status"
      invoke_arn   = var.conversations_invoke_arn
      function_arn = var.conversations_function_arn
      protected    = true
    }
    conversations_note = {
      route_key    = "PATCH /conversations/{conversationId}/note"
      invoke_arn   = var.conversations_invoke_arn
      function_arn = var.conversations_function_arn
      protected    = true
    }
    conversations_resolve = {
      route_key    = "POST /conversations/{conversationId}/resolve"
      invoke_arn   = var.conversations_invoke_arn
      function_arn = var.conversations_function_arn
      protected    = true
    }
    conversations_delete = {
      route_key    = "DELETE /conversations/{conversationId}"
      invoke_arn   = var.conversations_invoke_arn
      function_arn = var.conversations_function_arn
      protected    = true
    }
    conversations_calls_create = {
      route_key    = "POST /conversations/{conversationId}/calls"
      invoke_arn   = var.realtime_invoke_arn
      function_arn = var.realtime_function_arn
      protected    = true
    }
    conversations_calls_active = {
      route_key    = "GET /conversations/{conversationId}/calls/active"
      invoke_arn   = var.realtime_invoke_arn
      function_arn = var.realtime_function_arn
      protected    = true
    }
    conversations_calls_token = {
      route_key    = "POST /conversations/{conversationId}/calls/{callId}/token"
      invoke_arn   = var.realtime_invoke_arn
      function_arn = var.realtime_function_arn
      protected    = true
    }
    conversations_calls_end = {
      route_key    = "POST /conversations/{conversationId}/calls/{callId}/end"
      invoke_arn   = var.realtime_invoke_arn
      function_arn = var.realtime_function_arn
      protected    = true
    }
    whatsapp_connect = {
      route_key    = "POST /whatsapp/connect"
      invoke_arn   = var.whatsapp_connect_invoke_arn
      function_arn = var.whatsapp_connect_function_arn
      protected    = true
    }
    instagram_connect = {
      route_key    = "POST /instagram/connect"
      invoke_arn   = var.instagram_connect_invoke_arn
      function_arn = var.instagram_connect_function_arn
      protected    = true
    }
    webchat_sessions_create = {
      route_key    = "POST /webchat/sessions"
      invoke_arn   = var.webchat_invoke_arn
      function_arn = var.webchat_function_arn
      protected    = false
    }
    webchat_messages_send = {
      route_key    = "POST /webchat/sessions/{sessionId}/messages"
      invoke_arn   = var.webchat_invoke_arn
      function_arn = var.webchat_function_arn
      protected    = false
    }
    webchat_messages_poll = {
      route_key    = "GET /webchat/sessions/{sessionId}/messages"
      invoke_arn   = var.webchat_invoke_arn
      function_arn = var.webchat_function_arn
      protected    = false
    }
    webchat_call_token = {
      route_key    = "POST /webchat/sessions/{sessionId}/calls/{callId}/token"
      invoke_arn   = var.webchat_invoke_arn
      function_arn = var.webchat_function_arn
      protected    = false
    }
    webchat_call_decline = {
      route_key    = "POST /webchat/sessions/{sessionId}/calls/{callId}/decline"
      invoke_arn   = var.webchat_invoke_arn
      function_arn = var.webchat_function_arn
      protected    = false
    }
    webchat_call_accept = {
      route_key    = "POST /webchat/sessions/{sessionId}/calls/{callId}/accept"
      invoke_arn   = var.webchat_invoke_arn
      function_arn = var.webchat_function_arn
      protected    = false
    }
    bots_webchat_put = {
      route_key    = "PUT /bots/{botId}/webchat"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_webchat_rotate_key = {
      route_key    = "POST /bots/{botId}/webchat/rotate-key"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    campaigns_list = {
      route_key    = "GET /campaigns"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_create = {
      route_key    = "POST /campaigns"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_get = {
      route_key    = "GET /campaigns/{campaignId}"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_update = {
      route_key    = "PUT /campaigns/{campaignId}"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_delete = {
      route_key    = "DELETE /campaigns/{campaignId}"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_start = {
      route_key    = "POST /campaigns/{campaignId}/start"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_pause = {
      route_key    = "POST /campaigns/{campaignId}/pause"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_resume = {
      route_key    = "POST /campaigns/{campaignId}/resume"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_failures = {
      route_key    = "GET /campaigns/{campaignId}/failures"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    support_tickets_list = {
      route_key    = "GET /support/tickets"
      invoke_arn   = var.support_tickets_invoke_arn
      function_arn = var.support_tickets_function_arn
      protected    = true
    }
    support_tickets_create = {
      route_key    = "POST /support/tickets"
      invoke_arn   = var.support_tickets_invoke_arn
      function_arn = var.support_tickets_function_arn
      protected    = true
    }
    admin_support_tickets_list = {
      route_key    = "GET /admin/support/tickets"
      invoke_arn   = var.support_tickets_invoke_arn
      function_arn = var.support_tickets_function_arn
      protected    = true
    }
    admin_support_tickets_patch = {
      route_key    = "PATCH /admin/support/tickets/{ticketId}"
      invoke_arn   = var.support_tickets_invoke_arn
      function_arn = var.support_tickets_function_arn
      protected    = true
    }
    admin_cognito_users_list = {
      route_key    = "GET /admin/cognito/users"
      invoke_arn   = var.admin_invoke_arn
      function_arn = var.admin_function_arn
      protected    = true
    }
    admin_cognito_users_patch = {
      route_key    = "PATCH /admin/cognito/users/{username}"
      invoke_arn   = var.admin_invoke_arn
      function_arn = var.admin_function_arn
      protected    = true
    }
    admin_payments_list = {
      route_key    = "GET /admin/payments"
      invoke_arn   = var.admin_invoke_arn
      function_arn = var.admin_function_arn
      protected    = true
    }
    billing_checkout = {
      route_key    = "POST /billing/checkout"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = true
    }
    billing_portal = {
      route_key    = "POST /billing/portal"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = true
    }
    billing_usage = {
      route_key    = "GET /billing/usage"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = true
    }
    billing_status = {
      route_key    = "GET /billing/status"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = true
    }
    billing_transaction = {
      route_key    = "GET /billing/transaction"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = true
    }
    billing_webhook = {
      route_key    = "POST /billing/webhook"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = false
    }
    billing_wompi_webhook = {
      route_key    = "POST /billing/wompi/webhook"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = false
    }
    billing_wompi_confirm = {
      route_key    = "POST /billing/wompi/confirm"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = true
    }
    billing_providers = {
      route_key    = "GET /billing/providers"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = true
    }
    tenants_accept_terms = {
      route_key    = "POST /tenants/me/accept-terms"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    tenants_legal = {
      route_key    = "GET /tenants/me/legal"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    tenants_openai_key_get = {
      route_key    = "GET /tenants/me/openai-key"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    tenants_openai_key_save = {
      route_key    = "PUT /tenants/me/openai-key"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    tenants_openai_key_delete = {
      route_key    = "DELETE /tenants/me/openai-key"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    tenants_branding_get = {
      route_key    = "GET /tenants/me/branding"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    tenants_branding_update = {
      route_key    = "PUT /tenants/me/branding"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    tenants_branding_logo_upload = {
      route_key    = "POST /tenants/me/branding/logo"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    tenants_branding_logo_delete = {
      route_key    = "DELETE /tenants/me/branding/logo"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    public_api_messages = {
      route_key    = "POST /v1/messages"
      invoke_arn   = var.public_api_invoke_arn
      function_arn = var.public_api_function_arn
      protected    = false
    }
    public_api_calls_create = {
      route_key    = "POST /v1/calls"
      invoke_arn   = var.public_api_invoke_arn
      function_arn = var.public_api_function_arn
      protected    = false
    }
    public_api_calls_action = {
      route_key    = "POST /v1/calls/{callId}"
      invoke_arn   = var.public_api_invoke_arn
      function_arn = var.public_api_function_arn
      protected    = false
    }
    public_api_calls_get = {
      route_key    = "GET /v1/calls/{callId}"
      invoke_arn   = var.public_api_invoke_arn
      function_arn = var.public_api_function_arn
      protected    = false
    }
    public_api_calls_settings_get = {
      route_key    = "GET /v1/calls/settings"
      invoke_arn   = var.public_api_invoke_arn
      function_arn = var.public_api_function_arn
      protected    = false
    }
    public_api_calls_settings_put = {
      route_key    = "PUT /v1/calls/settings"
      invoke_arn   = var.public_api_invoke_arn
      function_arn = var.public_api_function_arn
      protected    = false
    }
    public_api_calls_permission = {
      route_key    = "POST /v1/calls/permission-request"
      invoke_arn   = var.public_api_invoke_arn
      function_arn = var.public_api_function_arn
      protected    = false
    }
    public_api_calls_permission_status = {
      route_key    = "GET /v1/calls/permission/{userWaId}"
      invoke_arn   = var.public_api_invoke_arn
      function_arn = var.public_api_function_arn
      protected    = false
    }
    bots_calling_settings_get = {
      route_key    = "GET /bots/{botId}/calling/settings"
      invoke_arn   = var.calling_invoke_arn
      function_arn = var.calling_function_arn
      protected    = true
    }
    bots_calling_settings_put = {
      route_key    = "PUT /bots/{botId}/calling/settings"
      invoke_arn   = var.calling_invoke_arn
      function_arn = var.calling_function_arn
      protected    = true
    }
    bots_calling_calls_list = {
      route_key    = "GET /bots/{botId}/calling/calls"
      invoke_arn   = var.calling_invoke_arn
      function_arn = var.calling_function_arn
      protected    = true
    }
    bots_calling_calls_get = {
      route_key    = "GET /bots/{botId}/calling/calls/{callId}"
      invoke_arn   = var.calling_invoke_arn
      function_arn = var.calling_function_arn
      protected    = true
    }
    bots_calling_permission_request = {
      route_key    = "POST /bots/{botId}/calling/calls/permission-request"
      invoke_arn   = var.calling_invoke_arn
      function_arn = var.calling_function_arn
      protected    = true
    }
    bots_calling_permission_status = {
      route_key    = "GET /bots/{botId}/calling/calls/permission/{userWaId}"
      invoke_arn   = var.calling_invoke_arn
      function_arn = var.calling_function_arn
      protected    = true
    }
    bots_calling_initiate = {
      route_key    = "POST /bots/{botId}/calling/calls/initiate"
      invoke_arn   = var.calling_invoke_arn
      function_arn = var.calling_function_arn
      protected    = true
    }
    bots_calling_action = {
      route_key    = "POST /bots/{botId}/calling/calls/{callId}/action"
      invoke_arn   = var.calling_invoke_arn
      function_arn = var.calling_function_arn
      protected    = true
    }
    api_keys_list = {
      route_key    = "GET /api-keys"
      invoke_arn   = var.api_keys_invoke_arn
      function_arn = var.api_keys_function_arn
      protected    = true
    }
    api_keys_create = {
      route_key    = "POST /api-keys"
      invoke_arn   = var.api_keys_invoke_arn
      function_arn = var.api_keys_function_arn
      protected    = true
    }
    api_keys_update = {
      route_key    = "PATCH /api-keys/{keyId}"
      invoke_arn   = var.api_keys_invoke_arn
      function_arn = var.api_keys_function_arn
      protected    = true
    }
    api_keys_delete = {
      route_key    = "DELETE /api-keys/{keyId}"
      invoke_arn   = var.api_keys_invoke_arn
      function_arn = var.api_keys_function_arn
      protected    = true
    }
    api_keys_usage = {
      route_key    = "GET /api-keys/usage"
      invoke_arn   = var.api_keys_invoke_arn
      function_arn = var.api_keys_function_arn
      protected    = true
    }
    api_keys_logs = {
      route_key    = "GET /api-keys/{keyId}/logs"
      invoke_arn   = var.api_keys_invoke_arn
      function_arn = var.api_keys_function_arn
      protected    = true
    }
    integrations_webhook_get = {
      route_key    = "GET /integrations/webhook"
      invoke_arn   = var.integrations_invoke_arn
      function_arn = var.integrations_function_arn
      protected    = true
    }
    integrations_webhook_put = {
      route_key    = "PUT /integrations/webhook"
      invoke_arn   = var.integrations_invoke_arn
      function_arn = var.integrations_function_arn
      protected    = true
    }
    integrations_webhook_test = {
      route_key    = "POST /integrations/webhook/test"
      invoke_arn   = var.integrations_invoke_arn
      function_arn = var.integrations_function_arn
      protected    = true
    }
    integrations_deliveries = {
      route_key    = "GET /integrations/deliveries"
      invoke_arn   = var.integrations_invoke_arn
      function_arn = var.integrations_function_arn
      protected    = true
    }
    automations_list = {
      route_key    = "GET /automations"
      invoke_arn   = var.automations_invoke_arn
      function_arn = var.automations_function_arn
      protected    = true
    }
    automations_create = {
      route_key    = "POST /automations"
      invoke_arn   = var.automations_invoke_arn
      function_arn = var.automations_function_arn
      protected    = true
    }
    automations_get = {
      route_key    = "GET /automations/{ruleId}"
      invoke_arn   = var.automations_invoke_arn
      function_arn = var.automations_function_arn
      protected    = true
    }
    automations_update = {
      route_key    = "PUT /automations/{ruleId}"
      invoke_arn   = var.automations_invoke_arn
      function_arn = var.automations_function_arn
      protected    = true
    }
    automations_delete = {
      route_key    = "DELETE /automations/{ruleId}"
      invoke_arn   = var.automations_invoke_arn
      function_arn = var.automations_function_arn
      protected    = true
    }
    automations_enable = {
      route_key    = "POST /automations/{ruleId}/enable"
      invoke_arn   = var.automations_invoke_arn
      function_arn = var.automations_function_arn
      protected    = true
    }
    automations_disable = {
      route_key    = "POST /automations/{ruleId}/disable"
      invoke_arn   = var.automations_invoke_arn
      function_arn = var.automations_function_arn
      protected    = true
    }
    apps_list = {
      route_key    = "GET /apps"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_config_get = {
      route_key    = "GET /calendar/{botId}/config"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_config_put = {
      route_key    = "PUT /calendar/{botId}/config"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_enable = {
      route_key    = "POST /calendar/{botId}/enable"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_disable = {
      route_key    = "POST /calendar/{botId}/disable"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_slots = {
      route_key    = "GET /calendar/{botId}/slots"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_bookings_list = {
      route_key    = "GET /calendar/{botId}/bookings"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_bookings_create = {
      route_key    = "POST /calendar/{botId}/bookings"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_bookings_patch = {
      route_key    = "PATCH /calendar/{botId}/bookings/{bookingId}"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    knowledge_list = {
      route_key    = "GET /bots/{botId}/knowledge"
      invoke_arn   = var.knowledge_invoke_arn
      function_arn = var.knowledge_function_arn
      protected    = true
    }
    knowledge_upload_url = {
      route_key    = "POST /bots/{botId}/knowledge/upload-url"
      invoke_arn   = var.knowledge_invoke_arn
      function_arn = var.knowledge_function_arn
      protected    = true
    }
    knowledge_index = {
      route_key    = "POST /bots/{botId}/knowledge/{docId}/index"
      invoke_arn   = var.knowledge_invoke_arn
      function_arn = var.knowledge_function_arn
      protected    = true
    }
    knowledge_delete = {
      route_key    = "DELETE /bots/{botId}/knowledge/{docId}"
      invoke_arn   = var.knowledge_invoke_arn
      function_arn = var.knowledge_function_arn
      protected    = true
    }
    meta_flows_responses = {
      route_key    = "GET /bots/{botId}/meta-flows/responses"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    meta_flows_list = {
      route_key    = "GET /bots/{botId}/meta-flows"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    meta_flows_create = {
      route_key    = "POST /bots/{botId}/meta-flows"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    meta_flows_get = {
      route_key    = "GET /bots/{botId}/meta-flows/{flowId}"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    meta_flows_update = {
      route_key    = "PUT /bots/{botId}/meta-flows/{flowId}"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    meta_flows_delete = {
      route_key    = "DELETE /bots/{botId}/meta-flows/{flowId}"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    meta_flows_publish = {
      route_key    = "POST /bots/{botId}/meta-flows/{flowId}/publish"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    meta_flows_deprecate = {
      route_key    = "POST /bots/{botId}/meta-flows/{flowId}/deprecate"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    meta_flows_test_send = {
      route_key    = "POST /bots/{botId}/meta-flows/{flowId}/test-send"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    flows_list = {
      route_key    = "GET /flows"
      invoke_arn   = var.flows_invoke_arn
      function_arn = var.flows_function_arn
      protected    = true
    }
    flows_create = {
      route_key    = "POST /flows"
      invoke_arn   = var.flows_invoke_arn
      function_arn = var.flows_function_arn
      protected    = true
    }
    flows_get = {
      route_key    = "GET /flows/{flowId}"
      invoke_arn   = var.flows_invoke_arn
      function_arn = var.flows_function_arn
      protected    = true
    }
    flows_update = {
      route_key    = "PUT /flows/{flowId}"
      invoke_arn   = var.flows_invoke_arn
      function_arn = var.flows_function_arn
      protected    = true
    }
    flows_delete = {
      route_key    = "DELETE /flows/{flowId}"
      invoke_arn   = var.flows_invoke_arn
      function_arn = var.flows_function_arn
      protected    = true
    }
    flows_enable = {
      route_key    = "POST /flows/{flowId}/enable"
      invoke_arn   = var.flows_invoke_arn
      function_arn = var.flows_function_arn
      protected    = true
    }
    flows_disable = {
      route_key    = "POST /flows/{flowId}/disable"
      invoke_arn   = var.flows_invoke_arn
      function_arn = var.flows_function_arn
      protected    = true
    }
  }
}

resource "aws_apigatewayv2_integration" "integrations" {
  for_each = local.routes

  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = local.routes

  api_id    = aws_apigatewayv2_api.main.id
  route_key = each.value.route_key
  target    = "integrations/${aws_apigatewayv2_integration.integrations[each.key].id}"

  authorization_type = each.value.protected ? "JWT" : "NONE"
  authorizer_id      = each.value.protected ? aws_apigatewayv2_authorizer.jwt.id : null
}

resource "aws_lambda_permission" "api_gw" {
  for_each = {
    webhook          = var.webhook_function_arn
    tenants          = var.tenants_function_arn
    bots             = var.bots_function_arn
    conversations    = var.conversations_function_arn
    advisors         = var.advisors_function_arn
    contacts         = var.contacts_function_arn
    leads            = var.leads_function_arn
    templates        = var.templates_function_arn
    bulk_send        = var.bulk_send_function_arn
    metrics          = var.metrics_function_arn
    whatsapp_connect = var.whatsapp_connect_function_arn
    instagram_connect = var.instagram_connect_function_arn
    webchat          = var.webchat_function_arn
    campaigns        = var.campaigns_function_arn
    support_tickets  = var.support_tickets_function_arn
    billing          = var.billing_function_arn
    admin            = var.admin_function_arn
    public_api       = var.public_api_function_arn
    api_keys         = var.api_keys_function_arn
    integrations     = var.integrations_function_arn
    automations      = var.automations_function_arn
    knowledge        = var.knowledge_function_arn
    meta_flows       = var.meta_flows_function_arn
    flows            = var.flows_function_arn
    calling          = var.calling_function_arn
    realtime         = var.realtime_function_arn
    calendar         = var.calendar_function_arn
  }

  statement_id  = "AllowAPIGatewayInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
