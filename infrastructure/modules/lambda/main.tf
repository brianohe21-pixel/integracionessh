data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  newrelic_enabled             = var.enable_newrelic && trimspace(var.newrelic_account_id) != "" && trimspace(var.newrelic_license_key) != ""
  newrelic_secret_name         = "/${var.environment}/platform/newrelic"
  newrelic_layer_arn           = "arn:aws:lambda:${data.aws_region.current.name}:451483290750:layer:NewRelicNodeJS20X-slim:${var.newrelic_layer_version}"
  newrelic_trusted_account_key = trimspace(var.newrelic_trusted_account_key) != "" ? trimspace(var.newrelic_trusted_account_key) : trimspace(var.newrelic_account_id)
  newrelic_environment_variables = {
    NEW_RELIC_ACCOUNT_ID                   = trimspace(var.newrelic_account_id)
    NEW_RELIC_TRUSTED_ACCOUNT_KEY          = local.newrelic_trusted_account_key
    NEW_RELIC_LICENSE_KEY_SECRET           = local.newrelic_secret_name
    NEW_RELIC_NO_CONFIG_FILE               = "true"
    NEW_RELIC_APM_LAMBDA_MODE              = "true"
    NEW_RELIC_APP_NAME                     = "${var.project}-${var.environment}"
    NEW_RELIC_EXTENSION_SEND_FUNCTION_LOGS = "true"
    NEW_RELIC_CLOUD_AWS_ACCOUNT_ID         = data.aws_caller_identity.current.account_id
    NEW_RELIC_NATIVE_METRICS_ENABLED       = "false"
  }
}

resource "aws_secretsmanager_secret" "newrelic_license_key" {
  count = local.newrelic_enabled ? 1 : 0

  name = local.newrelic_secret_name
  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "newrelic_license_key" {
  count = local.newrelic_enabled ? 1 : 0

  secret_id     = aws_secretsmanager_secret.newrelic_license_key[0].id
  secret_string = trimspace(var.newrelic_license_key)
}

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
          var.flow_event_sqs_queue_arn,
          var.call_events_sqs_queue_arn,
          var.mailrelay_sync_sqs_queue_arn,
          var.whatsapp_sync_sqs_queue_arn,
          var.sequence_sqs_queue_arn,
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
          "cognito-idp:DescribeUserPoolClient",
          "cognito-idp:UpdateUserPoolClient",
          "cognito-idp:CreateIdentityProvider",
          "cognito-idp:UpdateIdentityProvider",
          "cognito-idp:DeleteIdentityProvider",
          "cognito-idp:DescribeIdentityProvider",
        ]
        Resource = var.cognito_user_pool_arn
      },
      {
        Effect = "Allow"
        Action = [
          "amplify:ListApps",
          "amplify:GetApp",
          "amplify:CreateDomainAssociation",
          "amplify:GetDomainAssociation",
          "amplify:UpdateDomainAssociation",
          "amplify:DeleteDomainAssociation",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "route53:ListHostedZones",
          "route53:ListHostedZonesByName",
          "route53:GetHostedZone",
          "route53:ListResourceRecordSets",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:CreateSecret",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecret",
          "secretsmanager:DeleteSecret",
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
          "ses:VerifyDomainIdentity",
          "ses:VerifyDomainDkim",
          "ses:GetIdentityVerificationAttributes",
          "ses:GetIdentityDkimAttributes",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction",
        ]
        Resource = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${var.project}-${var.environment}-voicebot-session"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish",
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

  campaigns_function_name        = "${var.project}-${var.environment}-campaigns"
  campaigns_function_arn         = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${local.campaigns_function_name}"
  automations_function_name      = "${var.project}-${var.environment}-automations"
  automations_function_arn       = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${local.automations_function_name}"
  flows_function_name            = "${var.project}-${var.environment}-flows"
  flows_function_arn             = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${local.flows_function_name}"
  calendar_function_name         = "${var.project}-${var.environment}-calendar"
  calendar_function_arn          = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${local.calendar_function_name}"
  reports_function_name          = "${var.project}-${var.environment}-reports"
  reports_function_arn           = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${local.reports_function_name}"
  sales_function_name            = "${var.project}-${var.environment}-sales"
  sales_function_arn             = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${local.sales_function_name}"
  voicebot_session_function_name = "${var.project}-${var.environment}-voicebot-session"
  voicebot_session_function_arn  = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${local.voicebot_session_function_name}"

  google_calendar_redirect_uri = trimspace(var.api_public_url) != "" ? "${trimsuffix(trimspace(var.api_public_url), "/")}/public/integrations/google-calendar/oauth/callback" : ""

  functions = {
    webhook = {
      handler     = "webhook/index.handler"
      description = "Receives and validates WhatsApp webhooks from Meta"
      timeout     = 30
      memory      = 256
      environment = {
        WHATSAPP_VERIFY_TOKEN   = var.whatsapp_verify_token
        WHATSAPP_APP_SECRET     = var.whatsapp_app_secret != "" ? var.whatsapp_app_secret : var.meta_app_secret
        SQS_QUEUE_URL           = var.sqs_queue_url
        CALL_EVENTS_QUEUE_URL   = var.call_events_sqs_queue_url
        WHATSAPP_SYNC_QUEUE_URL = var.whatsapp_sync_sqs_queue_url
        MEDIA_BUCKET            = var.media_bucket_name
        TABLE_NAME              = var.dynamodb_table_name
      }
    }
    process_message = {
      handler     = "process-message/index.handler"
      description = "Processes incoming messages via OpenAI and replies on WhatsApp"
      timeout     = 300
      memory      = 512
      environment = {
        TABLE_NAME                    = var.dynamodb_table_name
        ENVIRONMENT                   = var.environment
        INTEGRATION_SQS_QUEUE_URL     = var.integration_sqs_queue_url
        MEDIA_BUCKET                  = var.media_bucket_name
        WEBSOCKET_API_ENDPOINT        = local.websocket_management_endpoint
        GOOGLE_CALENDAR_CLIENT_ID     = var.google_calendar_client_id
        GOOGLE_CALENDAR_CLIENT_SECRET = var.google_calendar_client_secret
        GOOGLE_CALENDAR_REDIRECT_URI  = local.google_calendar_redirect_uri
      }
    }
    tenants = {
      handler     = "tenants/index.handler"
      description = "CRUD API for tenants management"
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME                     = var.dynamodb_table_name
        ENVIRONMENT                    = var.environment
        FRONTEND_URL                   = var.frontend_url
        META_APP_ID                    = var.meta_app_id
        META_APP_SECRET                = var.meta_app_secret
        WHATSAPP_APP_SECRET            = var.whatsapp_app_secret != "" ? var.whatsapp_app_secret : var.meta_app_secret
        WHATSAPP_VERIFY_TOKEN          = var.whatsapp_verify_token
        META_EMBEDDED_SIGNUP_CONFIG_ID = var.meta_embedded_signup_config_id
        SES_FROM_EMAIL                 = var.ses_from_email
        ADMIN_NOTIFICATION_EMAILS      = join(",", var.admin_notification_emails)
        SCHEDULER_ROLE_ARN             = var.scheduler_role_arn
        REPORTS_FUNCTION_ARN           = local.reports_function_arn
        COGNITO_USER_POOL_ID           = var.cognito_user_pool_id
        COGNITO_CLIENT_ID              = var.cognito_client_id
        COGNITO_HOSTED_UI_DOMAIN       = var.cognito_hosted_ui_domain
        MEDIA_BUCKET                   = var.media_bucket_name
        API_PUBLIC_URL                 = var.api_public_url
        GOOGLE_BUSINESS_CLIENT_ID      = var.google_business_client_id
        GOOGLE_BUSINESS_CLIENT_SECRET  = var.google_business_client_secret
        GOOGLE_BUSINESS_REDIRECT_URI   = trimspace(var.api_public_url) != "" ? "${trimsuffix(trimspace(var.api_public_url), "/")}/public/integrations/google-business/oauth/callback" : ""
        GOOGLE_CALENDAR_CLIENT_ID      = var.google_calendar_client_id
        GOOGLE_CALENDAR_CLIENT_SECRET  = var.google_calendar_client_secret
        GOOGLE_CALENDAR_REDIRECT_URI   = local.google_calendar_redirect_uri
      }
    }
    reseller = {
      handler     = "reseller/index.handler"
      description = "Reseller subaccounts and white-label domain APIs"
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME           = var.dynamodb_table_name
        ENVIRONMENT          = var.environment
        FRONTEND_URL         = var.frontend_url
        SES_FROM_EMAIL       = var.ses_from_email
        COGNITO_USER_POOL_ID = var.cognito_user_pool_id
        COGNITO_CLIENT_ID    = var.cognito_client_id
        AMPLIFY_APP_NAME     = "${var.project}-${var.environment}"
        AMPLIFY_BRANCH_NAME  = var.amplify_branch_name
      }
    }
    bots = {
      handler     = "bots/index.handler"
      description = "CRUD API for chatbot configurations"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME              = var.dynamodb_table_name
        ENVIRONMENT             = var.environment
        WHATSAPP_SYNC_QUEUE_URL = var.whatsapp_sync_sqs_queue_url
      }
    }
    conversations = {
      handler     = "conversations/index.handler"
      description = "API for reading conversation history"
      timeout     = 30
      memory      = 512
      environment = {
        TABLE_NAME             = var.dynamodb_table_name
        ENVIRONMENT            = var.environment
        WEBSOCKET_API_ENDPOINT = local.websocket_management_endpoint
        MEDIA_BUCKET           = var.media_bucket_name
        FRONTEND_URL           = var.frontend_url
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
    sales = {
      handler     = "sales/index.handler"
      description = "CRUD API for sales pipelines, opportunities and sequences"
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME             = var.dynamodb_table_name
        ENVIRONMENT            = var.environment
        SCHEDULER_ROLE_ARN     = var.scheduler_role_arn
        SALES_FUNCTION_ARN     = local.sales_function_arn
        SEQUENCE_SQS_QUEUE_URL = var.sequence_sqs_queue_url
      }
    }
    process_sequence = {
      handler     = "process-sequence/index.handler"
      description = "Processes scheduled sales sequence steps from SQS"
      timeout     = 120
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
        TABLE_NAME     = var.dynamodb_table_name
        ENVIRONMENT    = var.environment
        FRONTEND_URL   = var.frontend_url
        SES_FROM_EMAIL = var.ses_from_email
        API_PUBLIC_URL = var.api_public_url
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
    reports = {
      handler     = "reports/index.handler"
      description = "Scheduled metrics report delivery"
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME     = var.dynamodb_table_name
        ENVIRONMENT    = var.environment
        SES_FROM_EMAIL = var.ses_from_email
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
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME           = var.dynamodb_table_name
        COGNITO_USER_POOL_ID = var.cognito_user_pool_id
        COGNITO_CLIENT_ID    = var.cognito_client_id
        AMPLIFY_APP_NAME     = "${var.project}-${var.environment}"
        AMPLIFY_BRANCH_NAME  = var.amplify_branch_name
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
        WOMPI_AMOUNT_STARTER_CENTS    = var.wompi_amount_starter_cents
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
        TABLE_NAME                     = var.dynamodb_table_name
        ENVIRONMENT                    = var.environment
        META_APP_ID                    = var.meta_app_id
        META_APP_SECRET                = var.meta_app_secret
        WHATSAPP_APP_SECRET            = var.whatsapp_app_secret != "" ? var.whatsapp_app_secret : var.meta_app_secret
        WHATSAPP_VERIFY_TOKEN          = var.whatsapp_verify_token
        META_EMBEDDED_SIGNUP_CONFIG_ID = var.meta_embedded_signup_config_id
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
    telegram_connect = {
      handler     = "telegram-connect/index.handler"
      description = "Connects Telegram bot credentials and registers webhook"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME     = var.dynamodb_table_name
        ENVIRONMENT    = var.environment
        API_PUBLIC_URL = var.api_public_url
      }
    }
    telegram_webhook = {
      handler     = "telegram-webhook/index.handler"
      description = "Receives Telegram bot webhook updates"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME    = var.dynamodb_table_name
        ENVIRONMENT   = var.environment
        SQS_QUEUE_URL = var.sqs_queue_url
      }
    }
    messenger_connect = {
      handler     = "messenger-connect/index.handler"
      description = "Connects Facebook Messenger page credentials for a bot"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME      = var.dynamodb_table_name
        ENVIRONMENT     = var.environment
        META_APP_ID     = var.meta_app_id
        META_APP_SECRET = var.meta_app_secret
      }
    }
    sms_webhook = {
      handler     = "sms-webhook/index.handler"
      description = "Receives inbound SMS events from SNS and Telcored DLR callbacks"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME    = var.dynamodb_table_name
        SQS_QUEUE_URL = var.sqs_queue_url
      }
    }
    email_inbound = {
      handler     = "email-inbound/index.handler"
      description = "Receives inbound email events from SES via SNS"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME    = var.dynamodb_table_name
        SQS_QUEUE_URL = var.sqs_queue_url
        MEDIA_BUCKET  = var.media_bucket_name
      }
    }
    email_imap_connect = {
      handler     = "email-imap-connect/index.handler"
      description = "Connects IMAP mailbox credentials for email channel"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    poll_imap_inbound = {
      handler     = "poll-imap-inbound/index.handler"
      description = "Polls active IMAP mailboxes for new inbound email"
      timeout     = 180
      memory      = 512
      environment = {
        TABLE_NAME    = var.dynamodb_table_name
        ENVIRONMENT   = var.environment
        SQS_QUEUE_URL = var.sqs_queue_url
        MEDIA_BUCKET  = var.media_bucket_name
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
    voicebot = {
      handler     = "voicebot/index.handler"
      description = "Public voicebot WebRTC sessions"
      timeout     = 30
      memory      = 512
      environment = {
        TABLE_NAME                     = var.dynamodb_table_name
        ENVIRONMENT                    = var.environment
        VOICEBOT_SESSION_FUNCTION_NAME = local.voicebot_session_function_name
      }
    }
    voicebot_session = {
      handler     = "voicebot-session/index.handler"
      description = "Voicebot OpenAI Realtime sideband session worker"
      timeout     = 900
      memory      = 512
      environment = {
        TABLE_NAME                = var.dynamodb_table_name
        ENVIRONMENT               = var.environment
        INTEGRATION_SQS_QUEUE_URL = var.integration_sqs_queue_url
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
        TABLE_NAME             = var.dynamodb_table_name
        ENVIRONMENT            = var.environment
        SCHEDULER_ROLE_ARN     = var.scheduler_role_arn
        CAMPAIGNS_FUNCTION_ARN = local.campaigns_function_arn
        API_PUBLIC_URL         = var.api_public_url
      }
    }
    public_api = {
      handler     = "public-api/index.handler"
      description = "Public REST API for external WhatsApp message sending"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME     = var.dynamodb_table_name
        ENVIRONMENT    = var.environment
        FRONTEND_URL   = var.frontend_url
        SES_FROM_EMAIL = var.ses_from_email
        API_PUBLIC_URL = var.api_public_url
        MEDIA_BUCKET   = var.media_bucket_name
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
        TABLE_NAME               = var.dynamodb_table_name
        FLOW_RUN_SQS_QUEUE_URL   = var.flow_run_sqs_queue_url
        FLOW_EVENT_SQS_QUEUE_URL = var.flow_event_sqs_queue_url
        SCHEDULER_ROLE_ARN       = var.scheduler_role_arn
        FLOWS_FUNCTION_ARN       = local.flows_function_arn
        API_PUBLIC_URL           = var.api_public_url
        ENVIRONMENT              = var.environment
      }
    }
    flow_hooks = {
      handler     = "flow-hooks/index.handler"
      description = "Public webhook endpoint for form-triggered flows"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME                = var.dynamodb_table_name
        FLOW_EVENT_SQS_QUEUE_URL  = var.flow_event_sqs_queue_url
        INTEGRATION_SQS_QUEUE_URL = var.integration_sqs_queue_url
        API_PUBLIC_URL            = var.api_public_url
        ENVIRONMENT               = var.environment
      }
    }
    process_flow = {
      handler     = "process-flow/index.handler"
      description = "Resumes visual flow runs from SQS"
      timeout     = 120
      memory      = 256
      environment = {
        TABLE_NAME                    = var.dynamodb_table_name
        ENVIRONMENT                   = var.environment
        SES_FROM_EMAIL                = var.ses_from_email
        GOOGLE_CALENDAR_CLIENT_ID     = var.google_calendar_client_id
        GOOGLE_CALENDAR_CLIENT_SECRET = var.google_calendar_client_secret
        GOOGLE_CALENDAR_REDIRECT_URI  = local.google_calendar_redirect_uri
      }
    }
    process_flow_event = {
      handler     = "process-flow-event/index.handler"
      description = "Processes form-triggered flow events from SQS"
      timeout     = 300
      memory      = 512
      environment = {
        TABLE_NAME               = var.dynamodb_table_name
        FLOW_RUN_SQS_QUEUE_URL   = var.flow_run_sqs_queue_url
        FLOW_EVENT_SQS_QUEUE_URL = var.flow_event_sqs_queue_url
        SCHEDULER_ROLE_ARN       = var.scheduler_role_arn
        FLOWS_FUNCTION_ARN       = local.flows_function_arn
        ENVIRONMENT              = var.environment
        SES_FROM_EMAIL           = var.ses_from_email
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
    telephony = {
      handler     = "telephony/index.handler"
      description = "Telnyx PSTN telephony webhooks and call control API"
      timeout     = 30
      memory      = 512
      environment = {
        TABLE_NAME                    = var.dynamodb_table_name
        ENVIRONMENT                   = var.environment
        TELEPHONY_GATEWAY_WS_URL      = var.telephony_gateway_ws_url
        INTEGRATION_SQS_QUEUE_URL     = var.integration_sqs_queue_url
        TELEPHONY_CDR_SQS_QUEUE_URL   = var.telephony_cdr_sqs_queue_url
        MEDIA_BUCKET                  = var.media_bucket_name
        API_PUBLIC_URL                = var.api_public_url
        GOOGLE_CALENDAR_CLIENT_ID     = var.google_calendar_client_id
        GOOGLE_CALENDAR_CLIENT_SECRET = var.google_calendar_client_secret
        GOOGLE_CALENDAR_REDIRECT_URI  = local.google_calendar_redirect_uri
      }
    }
    process_telephony_cdr = {
      handler     = "process-telephony-cdr/index.handler"
      description = "Reconciles Telnyx CDR costs for telephony calls"
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME                  = var.dynamodb_table_name
        ENVIRONMENT                 = var.environment
        INTEGRATION_SQS_QUEUE_URL   = var.integration_sqs_queue_url
        TELEPHONY_CDR_SQS_QUEUE_URL = var.telephony_cdr_sqs_queue_url
      }
    }
    calendar = {
      handler     = "calendar/index.handler"
      description = "Calendar app config and bookings per bot"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME                    = var.dynamodb_table_name
        ENVIRONMENT                   = var.environment
        INTEGRATION_SQS_QUEUE_URL     = var.integration_sqs_queue_url
        FRONTEND_URL                  = var.frontend_url
        SCHEDULER_ROLE_ARN            = var.scheduler_role_arn
        CALENDAR_FUNCTION_ARN         = local.calendar_function_arn
        GOOGLE_CALENDAR_CLIENT_ID     = var.google_calendar_client_id
        GOOGLE_CALENDAR_CLIENT_SECRET = var.google_calendar_client_secret
        GOOGLE_CALENDAR_REDIRECT_URI  = local.google_calendar_redirect_uri
      }
    }
    public_calendar = {
      handler     = "public-calendar/index.handler"
      description = "Public calendar booking links for visitors"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME                    = var.dynamodb_table_name
        ENVIRONMENT                   = var.environment
        INTEGRATION_SQS_QUEUE_URL     = var.integration_sqs_queue_url
        FRONTEND_URL                  = var.frontend_url
        MEDIA_BUCKET                  = var.media_bucket_name
        GOOGLE_CALENDAR_CLIENT_ID     = var.google_calendar_client_id
        GOOGLE_CALENDAR_CLIENT_SECRET = var.google_calendar_client_secret
        GOOGLE_CALENDAR_REDIRECT_URI  = local.google_calendar_redirect_uri
      }
    }
    payments = {
      handler     = "payments/index.handler"
      description = "Payments app config and Wompi checkout per bot"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME                    = var.dynamodb_table_name
        ENVIRONMENT                   = var.environment
        INTEGRATION_SQS_QUEUE_URL     = var.integration_sqs_queue_url
        FRONTEND_URL                  = var.frontend_url
        GOOGLE_CALENDAR_CLIENT_ID     = var.google_calendar_client_id
        GOOGLE_CALENDAR_CLIENT_SECRET = var.google_calendar_client_secret
        GOOGLE_CALENDAR_REDIRECT_URI  = local.google_calendar_redirect_uri
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
    hosted_forms = {
      handler     = "hosted-forms/index.handler"
      description = "Hosted form builder CRUD and public submissions"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME                = var.dynamodb_table_name
        ENVIRONMENT               = var.environment
        FLOW_EVENT_SQS_QUEUE_URL  = var.flow_event_sqs_queue_url
        INTEGRATION_SQS_QUEUE_URL = var.integration_sqs_queue_url
        FRONTEND_URL              = var.frontend_url
      }
    }
    short_links = {
      handler     = "short-links/index.handler"
      description = "Short links CRUD and tracked redirects with UTM injection"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME     = var.dynamodb_table_name
        ENVIRONMENT    = var.environment
        API_PUBLIC_URL = var.api_public_url
        FRONTEND_URL   = var.frontend_url
      }
    }
    mailrelay = {
      handler     = "mailrelay/index.handler"
      description = "Mailrelay integration configuration, synchronization, and campaigns API"
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME               = var.dynamodb_table_name
        ENVIRONMENT              = var.environment
        API_PUBLIC_URL           = var.api_public_url
        MAILRELAY_SYNC_QUEUE_URL = var.mailrelay_sync_sqs_queue_url
        MAILRELAY_EVENT_TYPES    = var.mailrelay_event_types
      }
    }
    process_mailrelay_sync = {
      handler     = "process-mailrelay-sync/index.handler"
      description = "Processes Mailrelay synchronization jobs from SQS"
      timeout     = 300
      memory      = 512
      environment = {
        TABLE_NAME               = var.dynamodb_table_name
        ENVIRONMENT              = var.environment
        MAILRELAY_SYNC_QUEUE_URL = var.mailrelay_sync_sqs_queue_url
      }
    }
    mailrelay_webhook = {
      handler     = "mailrelay-webhook/index.handler"
      description = "Receives Mailrelay campaign event webhooks"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    process_whatsapp_sync = {
      handler     = "process-whatsapp-sync/index.handler"
      description = "Processes WhatsApp coexistence sync jobs from SQS"
      timeout     = 300
      memory      = 512
      environment = {
        TABLE_NAME   = var.dynamodb_table_name
        ENVIRONMENT  = var.environment
        MEDIA_BUCKET = var.media_bucket_name
      }
    }
    google_business = {
      handler     = "google-business/index.handler"
      description = "Google Business Profile reviews API"
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME                    = var.dynamodb_table_name
        ENVIRONMENT                   = var.environment
        GOOGLE_BUSINESS_CLIENT_ID     = var.google_business_client_id
        GOOGLE_BUSINESS_CLIENT_SECRET = var.google_business_client_secret
        GOOGLE_BUSINESS_REDIRECT_URI  = trimspace(var.api_public_url) != "" ? "${trimsuffix(trimspace(var.api_public_url), "/")}/public/integrations/google-business/oauth/callback" : ""
        API_PUBLIC_URL                = var.api_public_url
      }
    }
  }
}

resource "aws_lambda_function" "functions" {
  for_each = local.functions

  function_name = "${var.project}-${var.environment}-${replace(each.key, "_", "-")}"
  description   = each.value.description
  role          = aws_iam_role.lambda.arn
  handler       = local.newrelic_enabled ? "newrelic-lambda-wrapper.handler" : each.value.handler
  runtime       = "nodejs20.x"
  timeout       = each.value.timeout
  memory_size   = each.value.memory

  filename         = local.lambda_zip_effective
  source_code_hash = filebase64sha256(local.lambda_zip_effective)

  layers = local.newrelic_enabled ? [local.newrelic_layer_arn] : []

  environment {
    variables = local.newrelic_enabled ? merge(
      each.value.environment,
      local.newrelic_environment_variables,
      {
        NEW_RELIC_LAMBDA_HANDLER = each.value.handler
      }
    ) : each.value.environment
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

resource "aws_lambda_event_source_mapping" "sequence_sqs_trigger" {
  event_source_arn                   = var.sequence_sqs_queue_arn
  function_name                      = aws_lambda_function.functions["process_sequence"].arn
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

resource "aws_lambda_event_source_mapping" "flow_event_sqs_trigger" {
  event_source_arn                   = var.flow_event_sqs_queue_arn
  function_name                      = aws_lambda_function.functions["process_flow_event"].arn
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

resource "aws_lambda_event_source_mapping" "telephony_cdr_sqs_trigger" {
  event_source_arn                   = var.telephony_cdr_sqs_queue_arn
  function_name                      = aws_lambda_function.functions["process_telephony_cdr"].arn
  batch_size                         = 1
  enabled                            = true
  maximum_batching_window_in_seconds = 0
}

resource "aws_lambda_event_source_mapping" "mailrelay_sync_sqs_trigger" {
  event_source_arn                   = var.mailrelay_sync_sqs_queue_arn
  function_name                      = aws_lambda_function.functions["process_mailrelay_sync"].arn
  batch_size                         = 1
  enabled                            = true
  function_response_types            = ["ReportBatchItemFailures"]
  maximum_batching_window_in_seconds = 0
}

resource "aws_lambda_event_source_mapping" "whatsapp_sync_sqs_trigger" {
  event_source_arn                   = var.whatsapp_sync_sqs_queue_arn
  function_name                      = aws_lambda_function.functions["process_whatsapp_sync"].arn
  batch_size                         = 1
  enabled                            = var.whatsapp_sync_sqs_queue_arn != ""
  function_response_types            = ["ReportBatchItemFailures"]
  maximum_batching_window_in_seconds = 0
}

resource "aws_cloudwatch_event_rule" "imap_poll" {
  name                = "${var.project}-${var.environment}-imap-poll"
  description         = "Poll active IMAP mailboxes for inbound email"
  schedule_expression = "rate(${var.imap_poll_rate_minutes} minutes)"
  tags                = var.tags
}

resource "aws_cloudwatch_event_target" "imap_poll" {
  rule      = aws_cloudwatch_event_rule.imap_poll.name
  target_id = "poll-imap-inbound"
  arn       = aws_lambda_function.functions["poll_imap_inbound"].arn
}

resource "aws_lambda_permission" "imap_poll" {
  statement_id  = "AllowEventBridgeImapPoll"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["poll_imap_inbound"].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.imap_poll.arn
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
