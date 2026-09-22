resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project}-${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = [
      "Content-Type",
      "Authorization",
      "X-Tenant-Context",
      "X-Portal-Host",
      "X-Api-Key",
      "X-Widget-Key",
      "X-Flow-Secret",
      "Idempotency-Key",
    ]
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
  lambda_functions = {
    webhook            = var.webhook_function_arn
    tenants            = var.tenants_function_arn
    reseller           = var.reseller_function_arn
    bots               = var.bots_function_arn
    conversations      = var.conversations_function_arn
    advisors           = var.advisors_function_arn
    contacts           = var.contacts_function_arn
    leads              = var.leads_function_arn
    sales              = var.sales_function_arn
    templates          = var.templates_function_arn
    bulk_send          = var.bulk_send_function_arn
    metrics            = var.metrics_function_arn
    whatsapp_connect   = var.whatsapp_connect_function_arn
    instagram_connect  = var.instagram_connect_function_arn
    telegram_connect   = var.telegram_connect_function_arn
    telegram_webhook   = var.telegram_webhook_function_arn
    messenger_connect  = var.messenger_connect_function_arn
    sms_webhook        = var.sms_webhook_function_arn
    email_inbound      = var.email_inbound_function_arn
    email_imap_connect = var.email_imap_connect_function_arn
    webchat            = var.webchat_function_arn
    voicebot           = var.voicebot_function_arn
    campaigns          = var.campaigns_function_arn
    support_tickets    = var.support_tickets_function_arn
    billing            = var.billing_function_arn
    admin              = var.admin_function_arn
    public_api         = var.public_api_function_arn
    api_keys           = var.api_keys_function_arn
    integrations       = var.integrations_function_arn
    automations        = var.automations_function_arn
    knowledge          = var.knowledge_function_arn
    macros             = var.macros_function_arn
    meta_flows         = var.meta_flows_function_arn
    flows              = var.flows_function_arn
    flow_hooks         = var.flow_hooks_function_arn
    calling            = var.calling_function_arn
    telephony          = var.telephony_function_arn
    realtime           = var.realtime_function_arn
    calendar           = var.calendar_function_arn
    public_calendar    = var.public_calendar_function_arn
    payments           = var.payments_function_arn
    catalog            = var.catalog_function_arn
    hosted_forms       = var.hosted_forms_function_arn
    short_links        = var.short_links_function_arn
    mailrelay          = var.mailrelay_function_arn
    mailrelay_webhook  = var.mailrelay_webhook_function_arn
    google_business    = var.google_business_function_arn
  }

  lambda_invoke_arns = {
    webhook            = var.webhook_invoke_arn
    tenants            = var.tenants_invoke_arn
    reseller           = var.reseller_invoke_arn
    bots               = var.bots_invoke_arn
    conversations      = var.conversations_invoke_arn
    advisors           = var.advisors_invoke_arn
    contacts           = var.contacts_invoke_arn
    leads              = var.leads_invoke_arn
    sales              = var.sales_invoke_arn
    templates          = var.templates_invoke_arn
    bulk_send          = var.bulk_send_invoke_arn
    metrics            = var.metrics_invoke_arn
    whatsapp_connect   = var.whatsapp_connect_invoke_arn
    instagram_connect  = var.instagram_connect_invoke_arn
    telegram_connect   = var.telegram_connect_invoke_arn
    telegram_webhook   = var.telegram_webhook_invoke_arn
    messenger_connect  = var.messenger_connect_invoke_arn
    sms_webhook        = var.sms_webhook_invoke_arn
    email_inbound      = var.email_inbound_invoke_arn
    email_imap_connect = var.email_imap_connect_invoke_arn
    webchat            = var.webchat_invoke_arn
    voicebot           = var.voicebot_invoke_arn
    campaigns          = var.campaigns_invoke_arn
    support_tickets    = var.support_tickets_invoke_arn
    billing            = var.billing_invoke_arn
    admin              = var.admin_invoke_arn
    public_api         = var.public_api_invoke_arn
    api_keys           = var.api_keys_invoke_arn
    integrations       = var.integrations_invoke_arn
    automations        = var.automations_invoke_arn
    knowledge          = var.knowledge_invoke_arn
    macros             = var.macros_invoke_arn
    meta_flows         = var.meta_flows_invoke_arn
    flows              = var.flows_invoke_arn
    flow_hooks         = var.flow_hooks_invoke_arn
    calling            = var.calling_invoke_arn
    telephony          = var.telephony_invoke_arn
    realtime           = var.realtime_invoke_arn
    calendar           = var.calendar_invoke_arn
    public_calendar    = var.public_calendar_invoke_arn
    payments           = var.payments_invoke_arn
    catalog            = var.catalog_invoke_arn
    hosted_forms       = var.hosted_forms_invoke_arn
    short_links        = var.short_links_invoke_arn
    mailrelay          = var.mailrelay_invoke_arn
    mailrelay_webhook  = var.mailrelay_webhook_invoke_arn
    google_business    = var.google_business_invoke_arn
  }

  http_proxy_groups = {
    public_api = {
      path         = "/v1/{proxy+}"
      slug         = "public_api"
      methods      = ["GET", "POST", "PUT", "DELETE"]
      invoke_arn   = var.public_api_invoke_arn
      function_arn = var.public_api_function_arn
      protected    = false
    }
    bots_telephony = {
      path         = "/bots/{botId}/telephony/{proxy+}"
      slug         = "telephony"
      methods      = ["GET", "POST", "PUT", "DELETE"]
      invoke_arn   = var.telephony_invoke_arn
      function_arn = var.telephony_function_arn
      protected    = true
    }
    contact_center = {
      path         = "/contact-center/{proxy+}"
      slug         = "telephony"
      methods      = ["GET", "POST", "PUT", "DELETE"]
      invoke_arn   = var.telephony_invoke_arn
      function_arn = var.telephony_function_arn
      protected    = true
    }
    bots_whatsapp_channels = {
      path         = "/bots/{botId}/whatsapp-channels/{proxy+}"
      slug         = "whatsapp_connect"
      methods      = ["GET", "POST", "PUT", "PATCH", "DELETE"]
      invoke_arn   = var.whatsapp_connect_invoke_arn
      function_arn = var.whatsapp_connect_function_arn
      protected    = true
    }
    telephony = {
      path         = "/telephony/{proxy+}"
      slug         = "telephony"
      methods      = ["GET", "POST"]
      invoke_arn   = var.telephony_invoke_arn
      function_arn = var.telephony_function_arn
      protected    = false
    }
    mailrelay = {
      path         = "/email-marketing/{proxy+}"
      slug         = "mailrelay"
      methods      = ["GET", "POST", "PUT", "PATCH", "DELETE"]
      invoke_arn   = var.mailrelay_invoke_arn
      function_arn = var.mailrelay_function_arn
      protected    = true
    }
    google_business = {
      path         = "/google-business/{proxy+}"
      slug         = "google_business"
      methods      = ["GET", "PUT", "DELETE"]
      invoke_arn   = var.google_business_invoke_arn
      function_arn = var.google_business_function_arn
      protected    = true
    }
    sales = {
      path         = "/sales/{proxy+}"
      slug         = "sales"
      methods      = ["GET", "POST", "PUT", "PATCH", "DELETE"]
      invoke_arn   = var.sales_invoke_arn
      function_arn = var.sales_function_arn
      protected    = true
    }
    catalog = {
      path         = "/catalog/{proxy+}"
      slug         = "catalog"
      methods      = ["GET", "POST", "PUT", "PATCH", "DELETE"]
      invoke_arn   = var.catalog_invoke_arn
      function_arn = var.catalog_function_arn
      protected    = true
    }
    hosted_forms = {
      path         = "/forms/{proxy+}"
      slug         = "hosted_forms"
      methods      = ["GET", "POST", "PUT", "DELETE"]
      invoke_arn   = var.hosted_forms_invoke_arn
      function_arn = var.hosted_forms_function_arn
      protected    = true
    }
    public_hosted_forms = {
      path         = "/public/forms/{proxy+}"
      slug         = "hosted_forms"
      methods      = ["GET", "POST"]
      invoke_arn   = var.hosted_forms_invoke_arn
      function_arn = var.hosted_forms_function_arn
      protected    = false
    }
    metrics = {
      path         = "/metrics/{proxy+}"
      slug         = "metrics"
      methods      = ["GET", "POST"]
      invoke_arn   = var.metrics_invoke_arn
      function_arn = var.metrics_function_arn
      protected    = true
    }
    conversations = {
      path         = "/conversations/{proxy+}"
      slug         = "conversations"
      methods      = ["GET", "POST", "PATCH", "DELETE"]
      invoke_arn   = var.conversations_invoke_arn
      function_arn = var.conversations_function_arn
      protected    = true
    }
    flows = {
      path         = "/flows/{proxy+}"
      slug         = "flows"
      methods      = ["GET", "POST", "PUT", "DELETE"]
      invoke_arn   = var.flows_invoke_arn
      function_arn = var.flows_function_arn
      protected    = true
    }
    webchat = {
      path         = "/webchat/{proxy+}"
      slug         = "webchat"
      methods      = ["GET", "POST"]
      invoke_arn   = var.webchat_invoke_arn
      function_arn = var.webchat_function_arn
      protected    = false
    }
    short_links = {
      path         = "/short-links/{proxy+}"
      slug         = "short_links"
      methods      = ["GET", "POST", "PATCH", "DELETE"]
      invoke_arn   = var.short_links_invoke_arn
      function_arn = var.short_links_function_arn
      protected    = true
    }
    tenants_me = {
      path         = "/tenants/me/{proxy+}"
      slug         = "tenants"
      methods      = ["GET", "POST", "PUT", "PATCH", "DELETE"]
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
  }

  http_proxy_routes = {
    for item in flatten([
      for group_key, group in local.http_proxy_groups : [
        for method in group.methods : {
          key          = "${group_key}_proxy_${lower(method)}"
          route_key    = "${method} ${group.path}"
          slug         = group.slug
          invoke_arn   = group.invoke_arn
          function_arn = group.function_arn
          protected    = group.protected
        }
      ]
      ]) : item.key => {
      route_key    = item.route_key
      slug         = item.slug
      invoke_arn   = item.invoke_arn
      function_arn = item.function_arn
      protected    = item.protected
    }
  }

  explicit_routes = {
    webhook_verify = {
      route_key    = "GET /webhook"
      slug         = "webhook"
      invoke_arn   = var.webhook_invoke_arn
      function_arn = var.webhook_function_arn
      protected    = false
    }
    webhook_receive = {
      route_key    = "POST /webhook"
      slug         = "webhook"
      invoke_arn   = var.webhook_invoke_arn
      function_arn = var.webhook_function_arn
      protected    = false
    }
    webhook_whatsapp_owner_verify = {
      route_key    = "GET /webhook/whatsapp/{ownerTenantId}"
      slug         = "webhook"
      invoke_arn   = var.webhook_invoke_arn
      function_arn = var.webhook_function_arn
      protected    = false
    }
    webhook_whatsapp_owner_receive = {
      route_key    = "POST /webhook/whatsapp/{ownerTenantId}"
      slug         = "webhook"
      invoke_arn   = var.webhook_invoke_arn
      function_arn = var.webhook_function_arn
      protected    = false
    }
    tenants_list = {
      route_key    = "GET /tenants"
      slug         = "tenants"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    tenants_create = {
      route_key    = "POST /tenants"
      slug         = "tenants"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    tenants_get = {
      route_key    = "GET /tenants/{tenantId}"
      slug         = "tenants"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    tenants_update = {
      route_key    = "PUT /tenants/{tenantId}"
      slug         = "tenants"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    tenants_delete = {
      route_key    = "DELETE /tenants/{tenantId}"
      slug         = "tenants"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    bots_list = {
      route_key    = "GET /bots"
      slug         = "bots"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_create = {
      route_key    = "POST /bots"
      slug         = "bots"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_get = {
      route_key    = "GET /bots/{botId}"
      slug         = "bots"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_update = {
      route_key    = "PUT /bots/{botId}"
      slug         = "bots"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_delete = {
      route_key    = "DELETE /bots/{botId}"
      slug         = "bots"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    conversations_list = {
      route_key    = "GET /conversations"
      slug         = "conversations"
      invoke_arn   = var.conversations_invoke_arn
      function_arn = var.conversations_function_arn
      protected    = true
    }
    advisors_list = {
      route_key    = "GET /advisors"
      slug         = "advisors"
      invoke_arn   = var.advisors_invoke_arn
      function_arn = var.advisors_function_arn
      protected    = true
    }
    advisors_create = {
      route_key    = "POST /advisors"
      slug         = "advisors"
      invoke_arn   = var.advisors_invoke_arn
      function_arn = var.advisors_function_arn
      protected    = true
    }
    advisors_get = {
      route_key    = "GET /advisors/{advisorId}"
      slug         = "advisors"
      invoke_arn   = var.advisors_invoke_arn
      function_arn = var.advisors_function_arn
      protected    = true
    }
    advisors_update = {
      route_key    = "PUT /advisors/{advisorId}"
      slug         = "advisors"
      invoke_arn   = var.advisors_invoke_arn
      function_arn = var.advisors_function_arn
      protected    = true
    }
    advisors_delete = {
      route_key    = "DELETE /advisors/{advisorId}"
      slug         = "advisors"
      invoke_arn   = var.advisors_invoke_arn
      function_arn = var.advisors_function_arn
      protected    = true
    }
    contacts_export = {
      route_key    = "GET /contacts/export"
      slug         = "contacts"
      invoke_arn   = var.contacts_invoke_arn
      function_arn = var.contacts_function_arn
      protected    = true
    }
    contacts_import = {
      route_key    = "POST /contacts/import"
      slug         = "contacts"
      invoke_arn   = var.contacts_invoke_arn
      function_arn = var.contacts_function_arn
      protected    = true
    }
    contacts_list = {
      route_key    = "GET /contacts"
      slug         = "contacts"
      invoke_arn   = var.contacts_invoke_arn
      function_arn = var.contacts_function_arn
      protected    = true
    }
    contacts_create = {
      route_key    = "POST /contacts"
      slug         = "contacts"
      invoke_arn   = var.contacts_invoke_arn
      function_arn = var.contacts_function_arn
      protected    = true
    }
    contacts_get = {
      route_key    = "GET /contacts/{phone}"
      slug         = "contacts"
      invoke_arn   = var.contacts_invoke_arn
      function_arn = var.contacts_function_arn
      protected    = true
    }
    contacts_update = {
      route_key    = "PATCH /contacts/{phone}"
      slug         = "contacts"
      invoke_arn   = var.contacts_invoke_arn
      function_arn = var.contacts_function_arn
      protected    = true
    }
    contacts_delete = {
      route_key    = "DELETE /contacts/{phone}"
      slug         = "contacts"
      invoke_arn   = var.contacts_invoke_arn
      function_arn = var.contacts_function_arn
      protected    = true
    }
    leads_list = {
      route_key    = "GET /leads"
      slug         = "leads"
      invoke_arn   = var.leads_invoke_arn
      function_arn = var.leads_function_arn
      protected    = true
    }
    leads_create = {
      route_key    = "POST /leads"
      slug         = "leads"
      invoke_arn   = var.leads_invoke_arn
      function_arn = var.leads_function_arn
      protected    = true
    }
    leads_get = {
      route_key    = "GET /leads/{leadId}"
      slug         = "leads"
      invoke_arn   = var.leads_invoke_arn
      function_arn = var.leads_function_arn
      protected    = true
    }
    leads_update = {
      route_key    = "PATCH /leads/{leadId}"
      slug         = "leads"
      invoke_arn   = var.leads_invoke_arn
      function_arn = var.leads_function_arn
      protected    = true
    }
    leads_convert = {
      route_key    = "POST /leads/{leadId}/convert"
      slug         = "leads"
      invoke_arn   = var.leads_invoke_arn
      function_arn = var.leads_function_arn
      protected    = true
    }
    leads_lose = {
      route_key    = "POST /leads/{leadId}/lose"
      slug         = "leads"
      invoke_arn   = var.leads_invoke_arn
      function_arn = var.leads_function_arn
      protected    = true
    }
    leads_delete = {
      route_key    = "DELETE /leads/{leadId}"
      slug         = "leads"
      invoke_arn   = var.leads_invoke_arn
      function_arn = var.leads_function_arn
      protected    = true
    }
    templates_list = {
      route_key    = "GET /templates"
      slug         = "templates"
      invoke_arn   = var.templates_invoke_arn
      function_arn = var.templates_function_arn
      protected    = true
    }
    templates_create = {
      route_key    = "POST /templates"
      slug         = "templates"
      invoke_arn   = var.templates_invoke_arn
      function_arn = var.templates_function_arn
      protected    = true
    }
    templates_update = {
      route_key    = "PUT /templates/{name}"
      slug         = "templates"
      invoke_arn   = var.templates_invoke_arn
      function_arn = var.templates_function_arn
      protected    = true
    }
    templates_delete = {
      route_key    = "DELETE /templates/{name}"
      slug         = "templates"
      invoke_arn   = var.templates_invoke_arn
      function_arn = var.templates_function_arn
      protected    = true
    }
    templates_send = {
      route_key    = "POST /templates/{name}/send"
      slug         = "templates"
      invoke_arn   = var.templates_invoke_arn
      function_arn = var.templates_function_arn
      protected    = true
    }
    bulk_send_create = {
      route_key    = "POST /bulk-send"
      slug         = "bulk_send"
      invoke_arn   = var.bulk_send_invoke_arn
      function_arn = var.bulk_send_function_arn
      protected    = true
    }
    bulk_send_list = {
      route_key    = "GET /bulk-send"
      slug         = "bulk_send"
      invoke_arn   = var.bulk_send_invoke_arn
      function_arn = var.bulk_send_function_arn
      protected    = true
    }
    bulk_send_get = {
      route_key    = "GET /bulk-send/{jobId}"
      slug         = "bulk_send"
      invoke_arn   = var.bulk_send_invoke_arn
      function_arn = var.bulk_send_function_arn
      protected    = true
    }
    bulk_send_failures = {
      route_key    = "GET /bulk-send/{jobId}/failures"
      slug         = "bulk_send"
      invoke_arn   = var.bulk_send_invoke_arn
      function_arn = var.bulk_send_function_arn
      protected    = true
    }
    metrics_get = {
      route_key    = "GET /metrics"
      slug         = "metrics"
      invoke_arn   = var.metrics_invoke_arn
      function_arn = var.metrics_function_arn
      protected    = true
    }
    conversations_calls_create = {
      route_key    = "POST /conversations/{conversationId}/calls"
      slug         = "realtime"
      invoke_arn   = var.realtime_invoke_arn
      function_arn = var.realtime_function_arn
      protected    = true
    }
    conversations_calls_active = {
      route_key    = "GET /conversations/{conversationId}/calls/active"
      slug         = "realtime"
      invoke_arn   = var.realtime_invoke_arn
      function_arn = var.realtime_function_arn
      protected    = true
    }
    conversations_calls_token = {
      route_key    = "POST /conversations/{conversationId}/calls/{callId}/token"
      slug         = "realtime"
      invoke_arn   = var.realtime_invoke_arn
      function_arn = var.realtime_function_arn
      protected    = true
    }
    conversations_calls_end = {
      route_key    = "POST /conversations/{conversationId}/calls/{callId}/end"
      slug         = "realtime"
      invoke_arn   = var.realtime_invoke_arn
      function_arn = var.realtime_function_arn
      protected    = true
    }
    whatsapp_connect = {
      route_key    = "POST /whatsapp/connect"
      slug         = "whatsapp_connect"
      invoke_arn   = var.whatsapp_connect_invoke_arn
      function_arn = var.whatsapp_connect_function_arn
      protected    = true
    }
    whatsapp_status = {
      route_key    = "GET /whatsapp/status"
      slug         = "whatsapp_connect"
      invoke_arn   = var.whatsapp_connect_invoke_arn
      function_arn = var.whatsapp_connect_function_arn
      protected    = true
    }
    whatsapp_register = {
      route_key    = "POST /whatsapp/register"
      slug         = "whatsapp_connect"
      invoke_arn   = var.whatsapp_connect_invoke_arn
      function_arn = var.whatsapp_connect_function_arn
      protected    = true
    }
    whatsapp_connect_manual = {
      route_key    = "POST /whatsapp/connect-manual"
      slug         = "whatsapp_connect"
      invoke_arn   = var.whatsapp_connect_invoke_arn
      function_arn = var.whatsapp_connect_function_arn
      protected    = true
    }
    whatsapp_connect_coexistence = {
      route_key    = "POST /whatsapp/connect-coexistence"
      slug         = "whatsapp_connect"
      invoke_arn   = var.whatsapp_connect_invoke_arn
      function_arn = var.whatsapp_connect_function_arn
      protected    = true
    }
    bots_whatsapp_channels_list = {
      route_key    = "GET /bots/{botId}/whatsapp-channels"
      slug         = "whatsapp_connect"
      invoke_arn   = var.whatsapp_connect_invoke_arn
      function_arn = var.whatsapp_connect_function_arn
      protected    = true
    }
    instagram_connect = {
      route_key    = "POST /instagram/connect"
      slug         = "instagram_connect"
      invoke_arn   = var.instagram_connect_invoke_arn
      function_arn = var.instagram_connect_function_arn
      protected    = true
    }
    telegram_connect = {
      route_key    = "POST /telegram/connect"
      slug         = "telegram_connect"
      invoke_arn   = var.telegram_connect_invoke_arn
      function_arn = var.telegram_connect_function_arn
      protected    = true
    }
    telegram_webhook = {
      route_key    = "POST /telegram/webhook/{botId}"
      slug         = "telegram_webhook"
      invoke_arn   = var.telegram_webhook_invoke_arn
      function_arn = var.telegram_webhook_function_arn
      protected    = false
    }
    messenger_connect = {
      route_key    = "POST /messenger/connect"
      slug         = "messenger_connect"
      invoke_arn   = var.messenger_connect_invoke_arn
      function_arn = var.messenger_connect_function_arn
      protected    = true
    }
    sms_webhook = {
      route_key    = "POST /sms/webhook"
      slug         = "sms_webhook"
      invoke_arn   = var.sms_webhook_invoke_arn
      function_arn = var.sms_webhook_function_arn
      protected    = false
    }
    sms_dlr = {
      route_key    = "GET /sms/dlr"
      slug         = "sms_webhook"
      invoke_arn   = var.sms_webhook_invoke_arn
      function_arn = var.sms_webhook_function_arn
      protected    = false
    }
    email_inbound = {
      route_key    = "POST /email/inbound"
      slug         = "email_inbound"
      invoke_arn   = var.email_inbound_invoke_arn
      function_arn = var.email_inbound_function_arn
      protected    = false
    }
    email_imap_connect = {
      route_key    = "POST /email/imap/connect"
      slug         = "email_imap_connect"
      invoke_arn   = var.email_imap_connect_invoke_arn
      function_arn = var.email_imap_connect_function_arn
      protected    = true
    }
    email_imap_test = {
      route_key    = "POST /email/imap/test"
      slug         = "email_imap_connect"
      invoke_arn   = var.email_imap_connect_invoke_arn
      function_arn = var.email_imap_connect_function_arn
      protected    = true
    }
    email_imap_disconnect = {
      route_key    = "DELETE /email/imap/connect"
      slug         = "email_imap_connect"
      invoke_arn   = var.email_imap_connect_invoke_arn
      function_arn = var.email_imap_connect_function_arn
      protected    = true
    }
    bots_webchat_put = {
      route_key    = "PUT /bots/{botId}/webchat"
      slug         = "bots"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_webchat_rotate_key = {
      route_key    = "POST /bots/{botId}/webchat/rotate-key"
      slug         = "bots"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_sms_put = {
      route_key    = "PUT /bots/{botId}/sms"
      slug         = "bots"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_email_put = {
      route_key    = "PUT /bots/{botId}/email"
      slug         = "bots"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_voicebot_put = {
      route_key    = "PUT /bots/{botId}/voicebot"
      slug         = "bots"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_voicebot_rotate_key = {
      route_key    = "POST /bots/{botId}/voicebot/rotate-key"
      slug         = "bots"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_ai_assistant_get = {
      route_key    = "GET /bots/{botId}/ai-assistant"
      slug         = "bots"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_ai_assistant_put = {
      route_key    = "PUT /bots/{botId}/ai-assistant"
      slug         = "bots"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_ai_assistant_enable = {
      route_key    = "POST /bots/{botId}/ai-assistant/enable"
      slug         = "bots"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    bots_ai_assistant_disable = {
      route_key    = "POST /bots/{botId}/ai-assistant/disable"
      slug         = "bots"
      invoke_arn   = var.bots_invoke_arn
      function_arn = var.bots_function_arn
      protected    = true
    }
    voicebot_sessions_create = {
      route_key    = "POST /voicebot/sessions"
      slug         = "voicebot"
      invoke_arn   = var.voicebot_invoke_arn
      function_arn = var.voicebot_function_arn
      protected    = false
    }
    voicebot_sessions_end = {
      route_key    = "POST /voicebot/sessions/{sessionId}/end"
      slug         = "voicebot"
      invoke_arn   = var.voicebot_invoke_arn
      function_arn = var.voicebot_function_arn
      protected    = false
    }
    campaigns_list = {
      route_key    = "GET /campaigns"
      slug         = "campaigns"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_create = {
      route_key    = "POST /campaigns"
      slug         = "campaigns"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_get = {
      route_key    = "GET /campaigns/{campaignId}"
      slug         = "campaigns"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_update = {
      route_key    = "PUT /campaigns/{campaignId}"
      slug         = "campaigns"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_delete = {
      route_key    = "DELETE /campaigns/{campaignId}"
      slug         = "campaigns"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_start = {
      route_key    = "POST /campaigns/{campaignId}/start"
      slug         = "campaigns"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_pause = {
      route_key    = "POST /campaigns/{campaignId}/pause"
      slug         = "campaigns"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_resume = {
      route_key    = "POST /campaigns/{campaignId}/resume"
      slug         = "campaigns"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_failures = {
      route_key    = "GET /campaigns/{campaignId}/failures"
      slug         = "campaigns"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_metrics = {
      route_key    = "GET /campaigns/{campaignId}/metrics"
      slug         = "campaigns"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_recipients = {
      route_key    = "GET /campaigns/{campaignId}/recipients"
      slug         = "campaigns"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_export = {
      route_key    = "GET /campaigns/{campaignId}/export"
      slug         = "campaigns"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_archive = {
      route_key    = "POST /campaigns/{campaignId}/archive"
      slug         = "campaigns"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_retry = {
      route_key    = "POST /campaigns/{campaignId}/retry"
      slug         = "campaigns"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    campaigns_clone = {
      route_key    = "POST /campaigns/{campaignId}/clone"
      slug         = "campaigns"
      invoke_arn   = var.campaigns_invoke_arn
      function_arn = var.campaigns_function_arn
      protected    = true
    }
    support_tickets_list = {
      route_key    = "GET /support/tickets"
      slug         = "support_tickets"
      invoke_arn   = var.support_tickets_invoke_arn
      function_arn = var.support_tickets_function_arn
      protected    = true
    }
    support_tickets_create = {
      route_key    = "POST /support/tickets"
      slug         = "support_tickets"
      invoke_arn   = var.support_tickets_invoke_arn
      function_arn = var.support_tickets_function_arn
      protected    = true
    }
    support_tickets_delete = {
      route_key    = "DELETE /support/tickets/{ticketId}"
      slug         = "support_tickets"
      invoke_arn   = var.support_tickets_invoke_arn
      function_arn = var.support_tickets_function_arn
      protected    = true
    }
    admin_support_tickets_list = {
      route_key    = "GET /admin/support/tickets"
      slug         = "support_tickets"
      invoke_arn   = var.support_tickets_invoke_arn
      function_arn = var.support_tickets_function_arn
      protected    = true
    }
    admin_support_tickets_patch = {
      route_key    = "PATCH /admin/support/tickets/{ticketId}"
      slug         = "support_tickets"
      invoke_arn   = var.support_tickets_invoke_arn
      function_arn = var.support_tickets_function_arn
      protected    = true
    }
    admin_cognito_users_list = {
      route_key    = "GET /admin/cognito/users"
      slug         = "admin"
      invoke_arn   = var.admin_invoke_arn
      function_arn = var.admin_function_arn
      protected    = true
    }
    admin_cognito_users_patch = {
      route_key    = "PATCH /admin/cognito/users/{username}"
      slug         = "admin"
      invoke_arn   = var.admin_invoke_arn
      function_arn = var.admin_function_arn
      protected    = true
    }
    admin_payments_list = {
      route_key    = "GET /admin/payments"
      slug         = "admin"
      invoke_arn   = var.admin_invoke_arn
      function_arn = var.admin_function_arn
      protected    = true
    }
    admin_billing_config_get = {
      route_key    = "GET /admin/billing-config"
      slug         = "admin"
      invoke_arn   = var.admin_invoke_arn
      function_arn = var.admin_function_arn
      protected    = true
    }
    admin_billing_config_put = {
      route_key    = "PUT /admin/billing-config"
      slug         = "admin"
      invoke_arn   = var.admin_invoke_arn
      function_arn = var.admin_function_arn
      protected    = true
    }
    admin_billing_overview_get = {
      route_key    = "GET /admin/billing/overview"
      slug         = "admin"
      invoke_arn   = var.admin_invoke_arn
      function_arn = var.admin_function_arn
      protected    = true
    }
    admin_reports_messages_export = {
      route_key    = "GET /admin/reports/messages/export"
      slug         = "admin"
      invoke_arn   = var.admin_invoke_arn
      function_arn = var.admin_function_arn
      protected    = true
    }
    admin_reseller_plan_defaults_get = {
      route_key    = "GET /admin/reseller-plan-defaults"
      slug         = "admin"
      invoke_arn   = var.admin_invoke_arn
      function_arn = var.admin_function_arn
      protected    = true
    }
    admin_reseller_plan_defaults_put = {
      route_key    = "PUT /admin/reseller-plan-defaults"
      slug         = "admin"
      invoke_arn   = var.admin_invoke_arn
      function_arn = var.admin_function_arn
      protected    = true
    }
    admin_reseller_domain_activate = {
      route_key    = "POST /admin/reseller-domain/activate"
      slug         = "admin"
      invoke_arn   = var.admin_invoke_arn
      function_arn = var.admin_function_arn
      protected    = true
    }
    reseller_subaccounts_list = {
      route_key    = "GET /reseller/subaccounts"
      slug         = "reseller"
      invoke_arn   = var.reseller_invoke_arn
      function_arn = var.reseller_function_arn
      protected    = true
    }
    reseller_subaccounts_create = {
      route_key    = "POST /reseller/subaccounts"
      slug         = "reseller"
      invoke_arn   = var.reseller_invoke_arn
      function_arn = var.reseller_function_arn
      protected    = true
    }
    reseller_subaccounts_get = {
      route_key    = "GET /reseller/subaccounts/{subaccountId}"
      slug         = "reseller"
      invoke_arn   = var.reseller_invoke_arn
      function_arn = var.reseller_function_arn
      protected    = true
    }
    reseller_subaccounts_update = {
      route_key    = "PUT /reseller/subaccounts/{subaccountId}"
      slug         = "reseller"
      invoke_arn   = var.reseller_invoke_arn
      function_arn = var.reseller_function_arn
      protected    = true
    }
    reseller_subaccounts_delete = {
      route_key    = "DELETE /reseller/subaccounts/{subaccountId}"
      slug         = "reseller"
      invoke_arn   = var.reseller_invoke_arn
      function_arn = var.reseller_function_arn
      protected    = true
    }
    reseller_subaccounts_assume = {
      route_key    = "POST /reseller/subaccounts/{subaccountId}/assume"
      slug         = "reseller"
      invoke_arn   = var.reseller_invoke_arn
      function_arn = var.reseller_function_arn
      protected    = true
    }
    reseller_subaccounts_send_credentials = {
      route_key    = "POST /reseller/subaccounts/{subaccountId}/send-credentials"
      slug         = "reseller"
      invoke_arn   = var.reseller_invoke_arn
      function_arn = var.reseller_function_arn
      protected    = true
    }
    reseller_domain_get = {
      route_key    = "GET /reseller/domain"
      slug         = "reseller"
      invoke_arn   = var.reseller_invoke_arn
      function_arn = var.reseller_function_arn
      protected    = true
    }
    reseller_domain_put = {
      route_key    = "PUT /reseller/domain"
      slug         = "reseller"
      invoke_arn   = var.reseller_invoke_arn
      function_arn = var.reseller_function_arn
      protected    = true
    }
    reseller_domain_delete = {
      route_key    = "DELETE /reseller/domain"
      slug         = "reseller"
      invoke_arn   = var.reseller_invoke_arn
      function_arn = var.reseller_function_arn
      protected    = true
    }
    public_branding_by_host = {
      route_key    = "GET /public/branding-by-host"
      slug         = "tenants"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = false
    }
    public_auth_methods = {
      route_key    = "GET /public/auth-methods"
      slug         = "tenants"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = false
    }
    public_google_business_oauth_callback = {
      route_key    = "GET /public/integrations/google-business/oauth/callback"
      slug         = "tenants"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = false
    }
    public_google_calendar_oauth_callback = {
      route_key    = "GET /public/integrations/google-calendar/oauth/callback"
      slug         = "tenants"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = false
    }
    auth_portal_access = {
      route_key    = "GET /auth/portal-access"
      slug         = "tenants"
      invoke_arn   = var.tenants_invoke_arn
      function_arn = var.tenants_function_arn
      protected    = true
    }
    billing_checkout = {
      route_key    = "POST /billing/checkout"
      slug         = "billing"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = true
    }
    billing_portal = {
      route_key    = "POST /billing/portal"
      slug         = "billing"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = true
    }
    billing_usage = {
      route_key    = "GET /billing/usage"
      slug         = "billing"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = true
    }
    billing_status = {
      route_key    = "GET /billing/status"
      slug         = "billing"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = true
    }
    billing_transaction = {
      route_key    = "GET /billing/transaction"
      slug         = "billing"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = true
    }
    billing_payments = {
      route_key    = "GET /billing/payments"
      slug         = "billing"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = true
    }
    billing_webhook = {
      route_key    = "POST /billing/webhook"
      slug         = "billing"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = false
    }
    billing_wompi_webhook = {
      route_key    = "POST /billing/wompi/webhook"
      slug         = "billing"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = false
    }
    billing_wompi_confirm = {
      route_key    = "POST /billing/wompi/confirm"
      slug         = "billing"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = true
    }
    billing_providers = {
      route_key    = "GET /billing/providers"
      slug         = "billing"
      invoke_arn   = var.billing_invoke_arn
      function_arn = var.billing_function_arn
      protected    = true
    }
    bots_calling_settings_get = {
      route_key    = "GET /bots/{botId}/calling/settings"
      slug         = "calling"
      invoke_arn   = var.calling_invoke_arn
      function_arn = var.calling_function_arn
      protected    = true
    }
    bots_calling_settings_put = {
      route_key    = "PUT /bots/{botId}/calling/settings"
      slug         = "calling"
      invoke_arn   = var.calling_invoke_arn
      function_arn = var.calling_function_arn
      protected    = true
    }
    bots_calling_calls_list = {
      route_key    = "GET /bots/{botId}/calling/calls"
      slug         = "calling"
      invoke_arn   = var.calling_invoke_arn
      function_arn = var.calling_function_arn
      protected    = true
    }
    bots_calling_calls_get = {
      route_key    = "GET /bots/{botId}/calling/calls/{callId}"
      slug         = "calling"
      invoke_arn   = var.calling_invoke_arn
      function_arn = var.calling_function_arn
      protected    = true
    }
    bots_calling_permission_request = {
      route_key    = "POST /bots/{botId}/calling/calls/permission-request"
      slug         = "calling"
      invoke_arn   = var.calling_invoke_arn
      function_arn = var.calling_function_arn
      protected    = true
    }
    bots_calling_permission_status = {
      route_key    = "GET /bots/{botId}/calling/calls/permission/{userWaId}"
      slug         = "calling"
      invoke_arn   = var.calling_invoke_arn
      function_arn = var.calling_function_arn
      protected    = true
    }
    bots_calling_initiate = {
      route_key    = "POST /bots/{botId}/calling/calls/initiate"
      slug         = "calling"
      invoke_arn   = var.calling_invoke_arn
      function_arn = var.calling_function_arn
      protected    = true
    }
    bots_calling_action = {
      route_key    = "POST /bots/{botId}/calling/calls/{callId}/action"
      slug         = "calling"
      invoke_arn   = var.calling_invoke_arn
      function_arn = var.calling_function_arn
      protected    = true
    }
    api_keys_list = {
      route_key    = "GET /api-keys"
      slug         = "api_keys"
      invoke_arn   = var.api_keys_invoke_arn
      function_arn = var.api_keys_function_arn
      protected    = true
    }
    api_keys_create = {
      route_key    = "POST /api-keys"
      slug         = "api_keys"
      invoke_arn   = var.api_keys_invoke_arn
      function_arn = var.api_keys_function_arn
      protected    = true
    }
    api_keys_update = {
      route_key    = "PATCH /api-keys/{keyId}"
      slug         = "api_keys"
      invoke_arn   = var.api_keys_invoke_arn
      function_arn = var.api_keys_function_arn
      protected    = true
    }
    api_keys_delete = {
      route_key    = "DELETE /api-keys/{keyId}"
      slug         = "api_keys"
      invoke_arn   = var.api_keys_invoke_arn
      function_arn = var.api_keys_function_arn
      protected    = true
    }
    api_keys_usage = {
      route_key    = "GET /api-keys/usage"
      slug         = "api_keys"
      invoke_arn   = var.api_keys_invoke_arn
      function_arn = var.api_keys_function_arn
      protected    = true
    }
    api_keys_logs = {
      route_key    = "GET /api-keys/{keyId}/logs"
      slug         = "api_keys"
      invoke_arn   = var.api_keys_invoke_arn
      function_arn = var.api_keys_function_arn
      protected    = true
    }
    integrations_webhook_get = {
      route_key    = "GET /integrations/webhook"
      slug         = "integrations"
      invoke_arn   = var.integrations_invoke_arn
      function_arn = var.integrations_function_arn
      protected    = true
    }
    integrations_webhook_put = {
      route_key    = "PUT /integrations/webhook"
      slug         = "integrations"
      invoke_arn   = var.integrations_invoke_arn
      function_arn = var.integrations_function_arn
      protected    = true
    }
    integrations_webhook_test = {
      route_key    = "POST /integrations/webhook/test"
      slug         = "integrations"
      invoke_arn   = var.integrations_invoke_arn
      function_arn = var.integrations_function_arn
      protected    = true
    }
    integrations_deliveries = {
      route_key    = "GET /integrations/deliveries"
      slug         = "integrations"
      invoke_arn   = var.integrations_invoke_arn
      function_arn = var.integrations_function_arn
      protected    = true
    }
    automations_list = {
      route_key    = "GET /automations"
      slug         = "automations"
      invoke_arn   = var.automations_invoke_arn
      function_arn = var.automations_function_arn
      protected    = true
    }
    automations_create = {
      route_key    = "POST /automations"
      slug         = "automations"
      invoke_arn   = var.automations_invoke_arn
      function_arn = var.automations_function_arn
      protected    = true
    }
    automations_get = {
      route_key    = "GET /automations/{ruleId}"
      slug         = "automations"
      invoke_arn   = var.automations_invoke_arn
      function_arn = var.automations_function_arn
      protected    = true
    }
    automations_update = {
      route_key    = "PUT /automations/{ruleId}"
      slug         = "automations"
      invoke_arn   = var.automations_invoke_arn
      function_arn = var.automations_function_arn
      protected    = true
    }
    automations_delete = {
      route_key    = "DELETE /automations/{ruleId}"
      slug         = "automations"
      invoke_arn   = var.automations_invoke_arn
      function_arn = var.automations_function_arn
      protected    = true
    }
    automations_enable = {
      route_key    = "POST /automations/{ruleId}/enable"
      slug         = "automations"
      invoke_arn   = var.automations_invoke_arn
      function_arn = var.automations_function_arn
      protected    = true
    }
    automations_disable = {
      route_key    = "POST /automations/{ruleId}/disable"
      slug         = "automations"
      invoke_arn   = var.automations_invoke_arn
      function_arn = var.automations_function_arn
      protected    = true
    }
    apps_list = {
      route_key    = "GET /apps"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_config_get = {
      route_key    = "GET /calendar/{botId}/config"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_config_put = {
      route_key    = "PUT /calendar/{botId}/config"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_enable = {
      route_key    = "POST /calendar/{botId}/enable"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_disable = {
      route_key    = "POST /calendar/{botId}/disable"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_slots = {
      route_key    = "GET /calendar/{botId}/slots"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_bookings_list = {
      route_key    = "GET /calendar/{botId}/bookings"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_bookings_create = {
      route_key    = "POST /calendar/{botId}/bookings"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_bookings_patch = {
      route_key    = "PATCH /calendar/{botId}/bookings/{bookingId}"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_public_link_get = {
      route_key    = "GET /calendar/{botId}/public-link"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_public_link_enable = {
      route_key    = "POST /calendar/{botId}/public-link/enable"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_public_link_disable = {
      route_key    = "POST /calendar/{botId}/public-link/disable"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_public_link_rotate = {
      route_key    = "POST /calendar/{botId}/public-link/rotate-key"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_waitlist_list = {
      route_key    = "GET /calendar/{botId}/waitlist"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_waitlist_patch = {
      route_key    = "PATCH /calendar/{botId}/waitlist/{waitlistId}"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_waitlist_convert = {
      route_key    = "POST /calendar/{botId}/waitlist/{waitlistId}/convert"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_google_status = {
      route_key    = "GET /calendar/{botId}/google"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_google_oauth_start = {
      route_key    = "GET /calendar/{botId}/google/oauth/start"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_google_calendars_refresh = {
      route_key    = "POST /calendar/{botId}/google/calendars/refresh"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_google_patch = {
      route_key    = "PATCH /calendar/{botId}/google"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_google_delete = {
      route_key    = "DELETE /calendar/{botId}/google"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    calendar_booking_retry_sync = {
      route_key    = "POST /calendar/{botId}/bookings/{bookingId}/retry-sync"
      slug         = "calendar"
      invoke_arn   = var.calendar_invoke_arn
      function_arn = var.calendar_function_arn
      protected    = true
    }
    public_calendar_info = {
      route_key    = "GET /public/calendar/{publicKey}"
      slug         = "public_calendar"
      invoke_arn   = var.public_calendar_invoke_arn
      function_arn = var.public_calendar_function_arn
      protected    = false
    }
    public_calendar_dates = {
      route_key    = "GET /public/calendar/{publicKey}/dates"
      slug         = "public_calendar"
      invoke_arn   = var.public_calendar_invoke_arn
      function_arn = var.public_calendar_function_arn
      protected    = false
    }
    public_calendar_slots = {
      route_key    = "GET /public/calendar/{publicKey}/slots"
      slug         = "public_calendar"
      invoke_arn   = var.public_calendar_invoke_arn
      function_arn = var.public_calendar_function_arn
      protected    = false
    }
    public_calendar_bookings = {
      route_key    = "POST /public/calendar/{publicKey}/bookings"
      slug         = "public_calendar"
      invoke_arn   = var.public_calendar_invoke_arn
      function_arn = var.public_calendar_function_arn
      protected    = false
    }
    public_calendar_waitlist = {
      route_key    = "POST /public/calendar/{publicKey}/waitlist"
      slug         = "public_calendar"
      invoke_arn   = var.public_calendar_invoke_arn
      function_arn = var.public_calendar_function_arn
      protected    = false
    }
    payments_wompi_credentials_get = {
      route_key    = "GET /payments/wompi/credentials"
      slug         = "payments"
      invoke_arn   = var.payments_invoke_arn
      function_arn = var.payments_function_arn
      protected    = true
    }
    payments_wompi_credentials_put = {
      route_key    = "PUT /payments/wompi/credentials"
      slug         = "payments"
      invoke_arn   = var.payments_invoke_arn
      function_arn = var.payments_function_arn
      protected    = true
    }
    payments_wompi_credentials_delete = {
      route_key    = "DELETE /payments/wompi/credentials"
      slug         = "payments"
      invoke_arn   = var.payments_invoke_arn
      function_arn = var.payments_function_arn
      protected    = true
    }
    payments_config_get = {
      route_key    = "GET /payments/{botId}/config"
      slug         = "payments"
      invoke_arn   = var.payments_invoke_arn
      function_arn = var.payments_function_arn
      protected    = true
    }
    payments_config_put = {
      route_key    = "PUT /payments/{botId}/config"
      slug         = "payments"
      invoke_arn   = var.payments_invoke_arn
      function_arn = var.payments_function_arn
      protected    = true
    }
    payments_enable = {
      route_key    = "POST /payments/{botId}/enable"
      slug         = "payments"
      invoke_arn   = var.payments_invoke_arn
      function_arn = var.payments_function_arn
      protected    = true
    }
    payments_disable = {
      route_key    = "POST /payments/{botId}/disable"
      slug         = "payments"
      invoke_arn   = var.payments_invoke_arn
      function_arn = var.payments_function_arn
      protected    = true
    }
    payments_requests_list = {
      route_key    = "GET /payments/{botId}/requests"
      slug         = "payments"
      invoke_arn   = var.payments_invoke_arn
      function_arn = var.payments_function_arn
      protected    = true
    }
    payments_requests_create = {
      route_key    = "POST /payments/{botId}/requests"
      slug         = "payments"
      invoke_arn   = var.payments_invoke_arn
      function_arn = var.payments_function_arn
      protected    = true
    }
    payments_requests_get = {
      route_key    = "GET /payments/{botId}/requests/{paymentId}"
      slug         = "payments"
      invoke_arn   = var.payments_invoke_arn
      function_arn = var.payments_function_arn
      protected    = true
    }
    payments_wompi_webhook = {
      route_key    = "POST /payments/wompi/webhook/{tenantId}"
      slug         = "payments"
      invoke_arn   = var.payments_invoke_arn
      function_arn = var.payments_function_arn
      protected    = false
    }
    knowledge_list = {
      route_key    = "GET /bots/{botId}/knowledge"
      slug         = "knowledge"
      invoke_arn   = var.knowledge_invoke_arn
      function_arn = var.knowledge_function_arn
      protected    = true
    }
    knowledge_upload_url = {
      route_key    = "POST /bots/{botId}/knowledge/upload-url"
      slug         = "knowledge"
      invoke_arn   = var.knowledge_invoke_arn
      function_arn = var.knowledge_function_arn
      protected    = true
    }
    knowledge_index = {
      route_key    = "POST /bots/{botId}/knowledge/{docId}/index"
      slug         = "knowledge"
      invoke_arn   = var.knowledge_invoke_arn
      function_arn = var.knowledge_function_arn
      protected    = true
    }
    knowledge_delete = {
      route_key    = "DELETE /bots/{botId}/knowledge/{docId}"
      slug         = "knowledge"
      invoke_arn   = var.knowledge_invoke_arn
      function_arn = var.knowledge_function_arn
      protected    = true
    }
    macros_list = {
      route_key    = "GET /bots/{botId}/macros"
      slug         = "macros"
      invoke_arn   = var.macros_invoke_arn
      function_arn = var.macros_function_arn
      protected    = true
    }
    macros_create = {
      route_key    = "POST /bots/{botId}/macros"
      slug         = "macros"
      invoke_arn   = var.macros_invoke_arn
      function_arn = var.macros_function_arn
      protected    = true
    }
    macros_get = {
      route_key    = "GET /bots/{botId}/macros/{macroId}"
      slug         = "macros"
      invoke_arn   = var.macros_invoke_arn
      function_arn = var.macros_function_arn
      protected    = true
    }
    macros_update = {
      route_key    = "PUT /bots/{botId}/macros/{macroId}"
      slug         = "macros"
      invoke_arn   = var.macros_invoke_arn
      function_arn = var.macros_function_arn
      protected    = true
    }
    macros_delete = {
      route_key    = "DELETE /bots/{botId}/macros/{macroId}"
      slug         = "macros"
      invoke_arn   = var.macros_invoke_arn
      function_arn = var.macros_function_arn
      protected    = true
    }
    meta_flows_responses = {
      route_key    = "GET /bots/{botId}/meta-flows/responses"
      slug         = "meta_flows"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    meta_flows_list = {
      route_key    = "GET /bots/{botId}/meta-flows"
      slug         = "meta_flows"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    meta_flows_create = {
      route_key    = "POST /bots/{botId}/meta-flows"
      slug         = "meta_flows"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    meta_flows_get = {
      route_key    = "GET /bots/{botId}/meta-flows/{flowId}"
      slug         = "meta_flows"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    meta_flows_update = {
      route_key    = "PUT /bots/{botId}/meta-flows/{flowId}"
      slug         = "meta_flows"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    meta_flows_delete = {
      route_key    = "DELETE /bots/{botId}/meta-flows/{flowId}"
      slug         = "meta_flows"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    meta_flows_publish = {
      route_key    = "POST /bots/{botId}/meta-flows/{flowId}/publish"
      slug         = "meta_flows"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    meta_flows_deprecate = {
      route_key    = "POST /bots/{botId}/meta-flows/{flowId}/deprecate"
      slug         = "meta_flows"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    meta_flows_test_send = {
      route_key    = "POST /bots/{botId}/meta-flows/{flowId}/test-send"
      slug         = "meta_flows"
      invoke_arn   = var.meta_flows_invoke_arn
      function_arn = var.meta_flows_function_arn
      protected    = true
    }
    flows_list = {
      route_key    = "GET /flows"
      slug         = "flows"
      invoke_arn   = var.flows_invoke_arn
      function_arn = var.flows_function_arn
      protected    = true
    }
    flows_create = {
      route_key    = "POST /flows"
      slug         = "flows"
      invoke_arn   = var.flows_invoke_arn
      function_arn = var.flows_function_arn
      protected    = true
    }
    hosted_forms_list = {
      route_key    = "GET /forms"
      slug         = "hosted_forms"
      invoke_arn   = var.hosted_forms_invoke_arn
      function_arn = var.hosted_forms_function_arn
      protected    = true
    }
    hosted_forms_create = {
      route_key    = "POST /forms"
      slug         = "hosted_forms"
      invoke_arn   = var.hosted_forms_invoke_arn
      function_arn = var.hosted_forms_function_arn
      protected    = true
    }
    flow_runs_get = {
      route_key    = "GET /flow-runs/{runId}"
      slug         = "flows"
      invoke_arn   = var.flows_invoke_arn
      function_arn = var.flows_function_arn
      protected    = true
    }
    flow_hooks_submit = {
      route_key    = "POST /public/flow-hooks/{hookKey}"
      slug         = "flow_hooks"
      invoke_arn   = var.flow_hooks_invoke_arn
      function_arn = var.flow_hooks_function_arn
      protected    = false
    }
    short_link_redirect = {
      route_key    = "GET /l/{slug}"
      slug         = "short_links"
      invoke_arn   = var.short_links_invoke_arn
      function_arn = var.short_links_function_arn
      protected    = false
    }
    mailrelay_webhook = {
      route_key    = "POST /email-marketing/webhook"
      slug         = "mailrelay_webhook"
      invoke_arn   = var.mailrelay_webhook_invoke_arn
      function_arn = var.mailrelay_webhook_function_arn
      protected    = false
    }
    mailrelay_webhook_tenant = {
      route_key    = "POST /email-marketing/webhook/{tenantId}"
      slug         = "mailrelay_webhook"
      invoke_arn   = var.mailrelay_webhook_invoke_arn
      function_arn = var.mailrelay_webhook_function_arn
      protected    = false
    }
  }

  routes = merge(local.explicit_routes, local.http_proxy_routes)

  function_integration_ids = {
    for slug, invoke_arn in local.lambda_invoke_arns :
    slug => {
      invoke_arn   = invoke_arn
      function_arn = local.lambda_functions[slug]
    }
  }
}

resource "aws_apigatewayv2_integration" "integrations" {
  for_each = local.function_integration_ids

  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = local.routes

  api_id    = aws_apigatewayv2_api.main.id
  route_key = each.value.route_key
  target    = "integrations/${aws_apigatewayv2_integration.integrations[each.value.slug].id}"

  authorization_type = each.value.protected ? "JWT" : "NONE"
  authorizer_id      = each.value.protected ? aws_apigatewayv2_authorizer.jwt.id : null
}

resource "aws_lambda_permission" "api_gw" {
  for_each = local.lambda_functions

  statement_id  = "AllowAPIGatewayInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
