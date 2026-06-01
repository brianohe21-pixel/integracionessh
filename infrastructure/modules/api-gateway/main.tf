resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project}-${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["Content-Type", "Authorization", "X-Api-Key"]
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
    metrics_get = {
      route_key    = "GET /metrics"
      invoke_arn   = var.metrics_invoke_arn
      function_arn = var.metrics_function_arn
      protected    = true
    }
    whatsapp_connect = {
      route_key    = "POST /whatsapp/connect"
      invoke_arn   = var.whatsapp_connect_invoke_arn
      function_arn = var.whatsapp_connect_function_arn
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
    templates        = var.templates_function_arn
    bulk_send        = var.bulk_send_function_arn
    metrics          = var.metrics_function_arn
    whatsapp_connect = var.whatsapp_connect_function_arn
    campaigns        = var.campaigns_function_arn
    support_tickets  = var.support_tickets_function_arn
    billing          = var.billing_function_arn
  }

  statement_id  = "AllowAPIGatewayInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
