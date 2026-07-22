data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_iam_policy_document" "assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.project}-${var.environment}-lambda"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_permissions" {
  name = "${var.project}-${var.environment}-lambda-permissions"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchWriteItem",
          "dynamodb:BatchGetItem",
        ]
        Resource = [
          var.dynamodb_table_arn,
          "${var.dynamodb_table_arn}/index/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
        ]
        Resource = [
          var.sqs_queue_arn,
          var.bulk_sqs_queue_arn,
          var.campaign_sqs_queue_arn,
          var.integration_sqs_queue_arn,
          var.automation_sqs_queue_arn,
          var.knowledge_sqs_queue_arn,
          var.flow_run_sqs_queue_arn,
          var.call_events_sqs_queue_arn,
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["scheduler:CreateSchedule", "scheduler:DeleteSchedule", "scheduler:GetSchedule"]
        Resource = "arn:aws:scheduler:*:*:schedule/default/*"
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = var.scheduler_role_arn != "" ? var.scheduler_role_arn : "arn:aws:iam::*:role/*"
        Condition = {
          StringEquals = {
            "iam:PassedToService" = "scheduler.amazonaws.com"
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
        ]
        Resource = "arn:aws:secretsmanager:*:*:secret:/${var.environment}/tenants/*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
        ]
        Resource = "arn:aws:secretsmanager:*:*:secret:/${var.environment}/platform/*"
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:ListUsers",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminEnableUser",
          "cognito-idp:AdminDisableUser",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminDeleteUser",
        ]
        Resource = var.cognito_user_pool_arn
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:CreateSecret",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecret",
        ]
        Resource = "arn:aws:secretsmanager:*:*:secret:/${var.environment}/tenants/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
        ]
        Resource = "${var.media_bucket_arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "execute-api:ManageConnections",
        ]
        Resource = "${aws_apigatewayv2_api.websocket.execution_arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail",
        ]
        Resource = "*"
      },
    ]
  })
}

locals {
  lambda_zip_effective = (
    var.lambda_zip_path != "" && fileexists(var.lambda_zip_path)
  ) ? var.lambda_zip_path : "${path.module}/bootstrap/functions.zip"

  campaigns_function_name   = "${var.project}-${var.environment}-campaigns"
  campaigns_function_arn    = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${local.campaigns_function_name}"
  automations_function_name = "${var.project}-${var.environment}-automations"
  automations_function_arn  = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${local.automations_function_name}"
  flows_function_name       = "${var.project}-${var.environment}-flows"
  flows_function_arn        = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${local.flows_function_name}"
  calendar_function_name    = "${var.project}-${var.environment}-calendar"
  calendar_function_arn     = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${local.calendar_function_name}"

  functions = {
    webhook = {
      handler     = "webhook/index.handler"
      description = "Receives and validates WhatsApp webhooks from Meta"
      timeout     = 30
      memory      = 256
      environment = {
        WHATSAPP_VERIFY_TOKEN = var.whatsapp_verify_token
        WHATSAPP_APP_SECRET   = var.whatsapp_app_secret != "" ? var.whatsapp_app_secret : var.meta_app_secret
        SQS_QUEUE_URL         = var.sqs_queue_url
        CALL_EVENTS_QUEUE_URL = var.call_events_sqs_queue_url
        TABLE_NAME            = var.dynamodb_table_name
      }
    }
    process_message = {
      handler     = "process-message/index.handler"
      description = "Processes incoming messages via OpenAI and replies on WhatsApp"
      timeout     = 300
      memory      = 512
      environment = {
        TABLE_NAME                = var.dynamodb_table_name
        ENVIRONMENT               = var.environment
        INTEGRATION_SQS_QUEUE_URL = var.integration_sqs_queue_url
        MEDIA_BUCKET              = var.media_bucket_name
        WEBSOCKET_API_ENDPOINT    = local.websocket_management_endpoint
      }
    }
    tenants = {
      handler     = "tenants/index.handler"
      description = "CRUD API for tenants management"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME                = var.dynamodb_table_name
        ENVIRONMENT               = var.environment
        FRONTEND_URL              = var.frontend_url
        SES_FROM_EMAIL            = var.ses_from_email
        ADMIN_NOTIFICATION_EMAILS = join(",", var.admin_notification_emails)
      }
    }
    bots = {
      handler     = "bots/index.handler"
      description = "CRUD API for chatbot configurations"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    conversations = {
      handler     = "conversations/index.handler"
      description = "API for reading conversation history"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME             = var.dynamodb_table_name
        ENVIRONMENT            = var.environment
        WEBSOCKET_API_ENDPOINT = local.websocket_management_endpoint
      }
    }
    advisors = {
      handler     = "advisors/index.handler"
      description = "CRUD API for human advisors"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME           = var.dynamodb_table_name
        COGNITO_USER_POOL_ID = var.cognito_user_pool_id
        FRONTEND_URL         = var.frontend_url
        SES_FROM_EMAIL       = var.ses_from_email
      }
    }
    contacts = {
      handler     = "contacts/index.handler"
      description = "CRUD API for tenant contacts and compliance"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    leads = {
      handler     = "leads/index.handler"
      description = "CRUD API for lead pipeline and conversion"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    templates = {
      handler     = "templates/index.handler"
      description = "CRUD and send WhatsApp message templates"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    bulk_send = {
      handler     = "bulk-send/index.handler"
      description = "Enqueues bulk template send campaigns"
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME         = var.dynamodb_table_name
        BULK_SQS_QUEUE_URL = var.bulk_sqs_queue_url
        ENVIRONMENT        = var.environment
      }
    }
    process_bulk_send = {
      handler     = "process-bulk-send/index.handler"
      description = "Processes bulk template send messages from SQS"
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    metrics = {
      handler     = "metrics/index.handler"
      description = "Aggregated usage metrics for tenant dashboard"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    support_tickets = {
      handler     = "support-tickets/index.handler"
      description = "Support ticket creation and listing"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    admin = {
      handler     = "admin/index.handler"
      description = "Platform admin APIs for Cognito users and payments"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME           = var.dynamodb_table_name
        COGNITO_USER_POOL_ID = var.cognito_user_pool_id
      }
    }
    billing = {
      handler     = "billing/index.handler"
      description = "Billing checkout (Wompi/Stripe), portal and webhooks"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME                    = var.dynamodb_table_name
        ENVIRONMENT                   = var.environment
        FRONTEND_URL                  = var.frontend_url
        WOMPI_PUBLIC_KEY              = var.wompi_public_key
        WOMPI_PRIVATE_KEY             = var.wompi_private_key
        WOMPI_INTEGRITY_SECRET        = var.wompi_integrity_secret
        WOMPI_EVENTS_SECRET           = var.wompi_events_secret
        WOMPI_AMOUNT_PRO_CENTS        = var.wompi_amount_pro_cents
        WOMPI_AMOUNT_ENTERPRISE_CENTS = var.wompi_amount_enterprise_cents
        WOMPI_API_BASE                = var.wompi_api_base
        WOMPI_CHECKOUT_URL            = var.wompi_checkout_url
        STRIPE_SECRET_KEY             = var.stripe_secret_key
        STRIPE_WEBHOOK_SECRET         = var.stripe_webhook_secret
        STRIPE_PRICE_PRO              = var.stripe_price_pro
        STRIPE_PRICE_ENTERPRISE       = var.stripe_price_enterprise
      }
    }
    whatsapp_connect = {
      handler     = "whatsapp-connect/index.handler"
      description = "Completes WhatsApp Embedded Signup and stores tenant credentials"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME          = var.dynamodb_table_name
        ENVIRONMENT         = var.environment
        META_APP_ID         = var.meta_app_id
        META_APP_SECRET     = var.meta_app_secret
        WHATSAPP_APP_SECRET = var.whatsapp_app_secret != "" ? var.whatsapp_app_secret : var.meta_app_secret
      }
    }
    instagram_connect = {
      handler     = "instagram-connect/index.handler"
      description = "Connects Instagram DM page credentials for a bot"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    webchat = {
      handler     = "webchat/index.handler"
      description = "Public web chat sessions and message polling"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME             = var.dynamodb_table_name
        ENVIRONMENT            = var.environment
        SQS_QUEUE_URL          = var.sqs_queue_url
        WEBCHAT_SESSION_SECRET = var.webchat_session_secret != "" ? var.webchat_session_secret : "dev-webchat-${var.environment}"
        LIVEKIT_URL            = var.livekit_url
        LIVEKIT_API_KEY        = var.livekit_api_key
        LIVEKIT_API_SECRET     = var.livekit_api_secret
      }
    }
    realtime = {
      handler     = "realtime/index.handler"
      description = "LiveKit voice/video calls for webchat advisors"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME         = var.dynamodb_table_name
        ENVIRONMENT        = var.environment
        LIVEKIT_URL        = var.livekit_url
        LIVEKIT_API_KEY    = var.livekit_api_key
        LIVEKIT_API_SECRET = var.livekit_api_secret
      }
    }
    realtime_ws = {
      handler     = "realtime-ws/index.handler"
      description = "WebSocket connections for realtime inbox updates"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME         = var.dynamodb_table_name
        ENVIRONMENT        = var.environment
        COGNITO_CLIENT_ID  = var.cognito_client_id
        COGNITO_ISSUER_URL = var.cognito_issuer_url
      }
    }
    campaigns = {
      handler     = "campaigns/index.handler"
      description = "CRUD API and control for WhatsApp bulk campaigns"
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME             = var.dynamodb_table_name
        CAMPAIGN_SQS_QUEUE_URL = var.campaign_sqs_queue_url
        ENVIRONMENT            = var.environment
        SCHEDULER_ROLE_ARN     = var.scheduler_role_arn
        CAMPAIGNS_FUNCTION_ARN = local.campaigns_function_arn
      }
    }
    process_campaign = {
      handler     = "process-campaign/index.handler"
      description = "Processes campaign messages from SQS"
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    public_api = {
      handler     = "public-api/index.handler"
      description = "Public REST API for external WhatsApp message sending"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    api_keys = {
      handler     = "api-keys/index.handler"
      description = "API key management for public REST API"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    integrations = {
      handler     = "integrations/index.handler"
      description = "Outgoing webhook integration configuration"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    process_integration = {
      handler     = "process-integration/index.handler"
      description = "Delivers integration webhook events from SQS"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME                = var.dynamodb_table_name
        ENVIRONMENT               = var.environment
        INTEGRATION_SQS_QUEUE_URL = var.integration_sqs_queue_url
      }
    }
    automations = {
      handler     = "automations/index.handler"
      description = "CRUD API for automation rules"
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME               = var.dynamodb_table_name
        AUTOMATION_SQS_QUEUE_URL = var.automation_sqs_queue_url
        ENVIRONMENT              = var.environment
        SCHEDULER_ROLE_ARN       = var.scheduler_role_arn
        AUTOMATIONS_FUNCTION_ARN = local.automations_function_arn
      }
    }
    process_automation = {
      handler     = "process-automation/index.handler"
      description = "Processes scheduled automation runs from SQS"
      timeout     = 120
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    knowledge = {
      handler     = "knowledge/index.handler"
      description = "Knowledge base document management per bot"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME              = var.dynamodb_table_name
        KNOWLEDGE_SQS_QUEUE_URL = var.knowledge_sqs_queue_url
        MEDIA_BUCKET            = var.media_bucket_name
        ENVIRONMENT             = var.environment
      }
    }
    macros = {
      handler     = "macros/index.handler"
      description = "CRUD API for advisor quick-reply macros per bot"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    process_knowledge = {
      handler     = "process-knowledge/index.handler"
      description = "Indexes knowledge documents from SQS"
      timeout     = 300
      memory      = 512
      environment = {
        TABLE_NAME   = var.dynamodb_table_name
        MEDIA_BUCKET = var.media_bucket_name
        ENVIRONMENT  = var.environment
      }
    }
    meta_flows = {
      handler     = "meta-flows/index.handler"
      description = "WhatsApp Meta Flows CRUD per bot"
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    flows = {
      handler     = "flows/index.handler"
      description = "Visual flow definitions CRUD"
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME             = var.dynamodb_table_name
        FLOW_RUN_SQS_QUEUE_URL = var.flow_run_sqs_queue_url
        SCHEDULER_ROLE_ARN     = var.scheduler_role_arn
        FLOWS_FUNCTION_ARN     = local.flows_function_arn
        ENVIRONMENT            = var.environment
      }
    }
    process_flow = {
      handler     = "process-flow/index.handler"
      description = "Resumes visual flow runs from SQS"
      timeout     = 120
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    process_call = {
      handler     = "process-call/index.handler"
      description = "Processes WhatsApp call events from SQS"
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME                = var.dynamodb_table_name
        ENVIRONMENT               = var.environment
        INTEGRATION_SQS_QUEUE_URL = var.integration_sqs_queue_url
      }
    }
    calling = {
      handler     = "calling/index.handler"
      description = "WhatsApp calling settings and history API"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    calendar = {
      handler     = "calendar/index.handler"
      description = "Calendar app config and bookings per bot"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME                = var.dynamodb_table_name
        ENVIRONMENT               = var.environment
        INTEGRATION_SQS_QUEUE_URL = var.integration_sqs_queue_url
        FRONTEND_URL              = var.frontend_url
        SCHEDULER_ROLE_ARN        = var.scheduler_role_arn
        CALENDAR_FUNCTION_ARN     = local.calendar_function_arn
      }
    }
    public_calendar = {
      handler     = "public-calendar/index.handler"
      description = "Public calendar booking links for visitors"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME                = var.dynamodb_table_name
        ENVIRONMENT               = var.environment
        INTEGRATION_SQS_QUEUE_URL = var.integration_sqs_queue_url
        FRONTEND_URL              = var.frontend_url
        MEDIA_BUCKET              = var.media_bucket_name
      }
    }
    payments = {
      handler     = "payments/index.handler"
      description = "Payments app config and Wompi checkout per bot"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME                = var.dynamodb_table_name
        ENVIRONMENT               = var.environment
        INTEGRATION_SQS_QUEUE_URL = var.integration_sqs_queue_url
        FRONTEND_URL              = var.frontend_url
      }
    }
    catalog = {
      handler     = "catalog/index.handler"
      description = "Catalog app config, products and orders per bot"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME                = var.dynamodb_table_name
        ENVIRONMENT               = var.environment
        INTEGRATION_SQS_QUEUE_URL = var.integration_sqs_queue_url
        FRONTEND_URL              = var.frontend_url
        MEDIA_BUCKET              = var.media_bucket_name
      }
    }
  }
}

resource "aws_lambda_function" "functions" {
  for_each = local.functions

  function_name = "${var.project}-${var.environment}-${replace(each.key, "_", "-")}"
  description   = each.value.description
  role          = aws_iam_role.lambda.arn
  handler       = each.value.handler
  runtime       = "nodejs20.x"
  timeout       = each.value.timeout
  memory_size   = each.value.memory

  filename         = local.lambda_zip_effective
  source_code_hash = filebase64sha256(local.lambda_zip_effective)

  environment {
    variables = each.value.environment
  }

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash,
    ]
  }

  depends_on = [aws_cloudwatch_log_group.lambda_logs]

  tags = var.tags
}

resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = var.sqs_queue_arn
  function_name    = aws_lambda_function.functions["process_message"].arn
  batch_size       = 1
  enabled          = true
}

resource "aws_lambda_event_source_mapping" "bulk_sqs_trigger" {
  event_source_arn                   = var.bulk_sqs_queue_arn
  function_name                      = aws_lambda_function.functions["process_bulk_send"].arn
  batch_size                         = 1
  enabled                            = true
  maximum_batching_window_in_seconds = 0
}

resource "aws_lambda_event_source_mapping" "campaign_sqs_trigger" {
  event_source_arn                   = var.campaign_sqs_queue_arn
  function_name                      = aws_lambda_function.functions["process_campaign"].arn
  batch_size                         = 1
  enabled                            = true
  maximum_batching_window_in_seconds = 0
}

resource "aws_lambda_event_source_mapping" "integration_sqs_trigger" {
  event_source_arn                   = var.integration_sqs_queue_arn
  function_name                      = aws_lambda_function.functions["process_integration"].arn
  batch_size                         = 1
  enabled                            = true
  maximum_batching_window_in_seconds = 0
}

resource "aws_lambda_event_source_mapping" "automation_sqs_trigger" {
  event_source_arn                   = var.automation_sqs_queue_arn
  function_name                      = aws_lambda_function.functions["process_automation"].arn
  batch_size                         = 1
  enabled                            = true
  maximum_batching_window_in_seconds = 0
}

resource "aws_lambda_event_source_mapping" "knowledge_sqs_trigger" {
  event_source_arn                   = var.knowledge_sqs_queue_arn
  function_name                      = aws_lambda_function.functions["process_knowledge"].arn
  batch_size                         = 1
  enabled                            = true
  maximum_batching_window_in_seconds = 0
}

resource "aws_lambda_event_source_mapping" "flow_run_sqs_trigger" {
  event_source_arn                   = var.flow_run_sqs_queue_arn
  function_name                      = aws_lambda_function.functions["process_flow"].arn
  batch_size                         = 1
  enabled                            = true
  maximum_batching_window_in_seconds = 0
}

resource "aws_lambda_event_source_mapping" "call_events_sqs_trigger" {
  event_source_arn                   = var.call_events_sqs_queue_arn
  function_name                      = aws_lambda_function.functions["process_call"].arn
  batch_size                         = 1
  enabled                            = true
  maximum_batching_window_in_seconds = 0
}

resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each          = local.functions
  name              = "/aws/lambda/${var.project}-${var.environment}-${replace(each.key, "_", "-")}"
  retention_in_days = var.environment == "prod" ? 30 : 7
  tags              = var.tags
}

resource "aws_ses_email_identity" "from" {
  count = var.ses_from_email != "" ? 1 : 0
  email = var.ses_from_email
}
