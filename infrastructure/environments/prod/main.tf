terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    external = {
      source  = "hashicorp/external"
      version = "~> 2.3"
    }
  }

  backend "s3" {
    bucket       = "chatbot-platform-tfstate-979054355542"
    key          = "prod/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.tags
  }
}

provider "aws" {
  alias  = "untagged"
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

data "external" "amplify_browser_origin" {
  program = [
    "${path.module}/../../scripts/amplify-browser-origin.sh",
    local.project,
    local.environment,
    var.aws_region,
    "main",
  ]
}

locals {
  project     = "chatbot-platform"
  environment = "prod"

  tags = {
    Project     = local.project
    Environment = local.environment
    ManagedBy   = "terraform"
  }

  custom_domain_trimmed = trimspace(var.custom_domain)
  has_custom_domain     = length(local.custom_domain_trimmed) > 0

  cognito_callback_urls = concat(
    local.has_custom_domain ? ["https://${local.custom_domain_trimmed}/api/auth/callback/cognito"] : [],
    var.extra_callback_urls
  )
  cognito_logout_urls = concat(
    local.has_custom_domain ? ["https://${local.custom_domain_trimmed}"] : [],
    var.extra_logout_urls
  )
  browser_origins = concat(
    local.has_custom_domain ? ["https://${local.custom_domain_trimmed}"] : [],
    data.external.amplify_browser_origin.result.origin != "" ? [data.external.amplify_browser_origin.result.origin] : [],
    var.extra_allowed_origins
  )

  ops_alert_emails = length(var.ops_alert_emails) > 0 ? var.ops_alert_emails : compact([var.ops_alert_email])
}

module "dynamodb" {
  source      = "../../modules/dynamodb"
  project     = local.project
  environment = local.environment
  tags        = local.tags
}

module "cognito" {
  source        = "../../modules/cognito"
  project       = local.project
  environment   = local.environment
  callback_urls = local.cognito_callback_urls
  logout_urls   = local.cognito_logout_urls
  tags          = local.tags
}

module "sqs" {
  source           = "../../modules/sqs"
  project          = local.project
  environment      = local.environment
  lambda_role_arns = [module.lambda.role_arn]
  tags             = local.tags
}

module "s3" {
  source          = "../../modules/s3"
  project         = local.project
  environment     = local.environment
  account_id      = data.aws_caller_identity.current.account_id
  allowed_origins = local.browser_origins
  tags            = local.tags
}

resource "aws_iam_role" "scheduler" {
  name = "${local.project}-${local.environment}-scheduler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "scheduler_invoke" {
  name = "${local.project}-${local.environment}-scheduler-invoke"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["lambda:InvokeFunction"]
      Resource = [
        module.lambda.campaigns_function_arn,
        module.lambda.automations_function_arn,
        module.lambda.flows_function_arn,
        module.lambda.calendar_function_arn,
      ]
    }]
  })
}

module "lambda" {
  source                        = "../../modules/lambda"
  project                       = local.project
  environment                   = local.environment
  dynamodb_table_name           = module.dynamodb.table_name
  dynamodb_table_arn            = module.dynamodb.table_arn
  sqs_queue_url                 = module.sqs.queue_url
  sqs_queue_arn                 = module.sqs.queue_arn
  bulk_sqs_queue_url            = module.sqs.bulk_queue_url
  bulk_sqs_queue_arn            = module.sqs.bulk_queue_arn
  campaign_sqs_queue_url        = module.sqs.campaign_queue_url
  campaign_sqs_queue_arn        = module.sqs.campaign_queue_arn
  integration_sqs_queue_url     = module.sqs.integration_queue_url
  integration_sqs_queue_arn     = module.sqs.integration_queue_arn
  automation_sqs_queue_url      = module.sqs.automation_queue_url
  automation_sqs_queue_arn      = module.sqs.automation_queue_arn
  knowledge_sqs_queue_url       = module.sqs.knowledge_queue_url
  knowledge_sqs_queue_arn       = module.sqs.knowledge_queue_arn
  flow_run_sqs_queue_url        = module.sqs.flow_run_queue_url
  flow_run_sqs_queue_arn        = module.sqs.flow_run_queue_arn
  call_events_sqs_queue_url     = module.sqs.call_events_queue_url
  call_events_sqs_queue_arn     = module.sqs.call_events_queue_arn
  scheduler_role_arn            = aws_iam_role.scheduler.arn
  media_bucket_arn              = module.s3.media_bucket_arn
  media_bucket_name             = module.s3.media_bucket_name
  cognito_user_pool_id          = module.cognito.user_pool_id
  cognito_user_pool_arn         = module.cognito.user_pool_arn
  cognito_client_id             = module.cognito.client_id
  whatsapp_verify_token         = var.whatsapp_verify_token
  meta_app_id                   = var.meta_app_id
  meta_app_secret               = var.meta_app_secret
  whatsapp_app_secret           = var.whatsapp_app_secret
  lambda_zip_path               = var.lambda_zip_path != "" ? abspath("${path.module}/${var.lambda_zip_path}") : ""
  stripe_secret_key             = var.stripe_secret_key
  stripe_webhook_secret         = var.stripe_webhook_secret
  stripe_price_pro              = var.stripe_price_pro
  stripe_price_enterprise       = var.stripe_price_enterprise
  frontend_url                  = var.frontend_url
  wompi_public_key              = var.wompi_public_key
  wompi_private_key             = var.wompi_private_key
  wompi_integrity_secret        = var.wompi_integrity_secret
  wompi_events_secret           = var.wompi_events_secret
  wompi_amount_pro_cents        = var.wompi_amount_pro_cents
  wompi_amount_enterprise_cents = var.wompi_amount_enterprise_cents
  wompi_api_base                = var.wompi_api_base
  wompi_checkout_url            = var.wompi_checkout_url
  livekit_url                   = var.livekit_url
  livekit_api_key               = var.livekit_api_key
  livekit_api_secret            = var.livekit_api_secret
  ses_from_email                = var.ses_from_email
  admin_notification_emails     = local.ops_alert_emails
  tags                          = local.tags
}

module "api_gateway" {
  source                         = "../../modules/api-gateway"
  project                        = local.project
  environment                    = local.environment
  cognito_client_id              = module.cognito.client_id
  cognito_issuer_url             = module.cognito.endpoint
  webhook_invoke_arn             = module.lambda.webhook_invoke_arn
  webhook_function_arn           = module.lambda.function_arns["webhook"]
  tenants_invoke_arn             = module.lambda.tenants_invoke_arn
  tenants_function_arn           = module.lambda.function_arns["tenants"]
  bots_invoke_arn                = module.lambda.bots_invoke_arn
  bots_function_arn              = module.lambda.function_arns["bots"]
  conversations_invoke_arn       = module.lambda.conversations_invoke_arn
  conversations_function_arn     = module.lambda.function_arns["conversations"]
  advisors_invoke_arn            = module.lambda.advisors_invoke_arn
  advisors_function_arn          = module.lambda.advisors_function_arn
  contacts_invoke_arn            = module.lambda.contacts_invoke_arn
  contacts_function_arn          = module.lambda.contacts_function_arn
  leads_invoke_arn               = module.lambda.leads_invoke_arn
  leads_function_arn             = module.lambda.leads_function_arn
  templates_invoke_arn           = module.lambda.templates_invoke_arn
  templates_function_arn         = module.lambda.function_arns["templates"]
  bulk_send_invoke_arn           = module.lambda.bulk_send_invoke_arn
  bulk_send_function_arn         = module.lambda.function_arns["bulk_send"]
  metrics_invoke_arn             = module.lambda.metrics_invoke_arn
  metrics_function_arn           = module.lambda.function_arns["metrics"]
  whatsapp_connect_invoke_arn    = module.lambda.whatsapp_connect_invoke_arn
  whatsapp_connect_function_arn  = module.lambda.whatsapp_connect_function_arn
  instagram_connect_invoke_arn   = module.lambda.instagram_connect_invoke_arn
  instagram_connect_function_arn = module.lambda.instagram_connect_function_arn
  webchat_invoke_arn             = module.lambda.webchat_invoke_arn
  webchat_function_arn           = module.lambda.webchat_function_arn
  campaigns_invoke_arn           = module.lambda.campaigns_invoke_arn
  campaigns_function_arn         = module.lambda.campaigns_function_arn
  support_tickets_invoke_arn     = module.lambda.support_tickets_invoke_arn
  support_tickets_function_arn   = module.lambda.support_tickets_function_arn
  billing_invoke_arn             = module.lambda.billing_invoke_arn
  billing_function_arn           = module.lambda.billing_function_arn
  admin_invoke_arn               = module.lambda.admin_invoke_arn
  admin_function_arn             = module.lambda.admin_function_arn
  public_api_invoke_arn          = module.lambda.public_api_invoke_arn
  public_api_function_arn        = module.lambda.public_api_function_arn
  api_keys_invoke_arn            = module.lambda.api_keys_invoke_arn
  api_keys_function_arn          = module.lambda.api_keys_function_arn
  integrations_invoke_arn        = module.lambda.integrations_invoke_arn
  integrations_function_arn      = module.lambda.integrations_function_arn
  automations_invoke_arn         = module.lambda.automations_invoke_arn
  automations_function_arn       = module.lambda.automations_function_arn
  knowledge_invoke_arn           = module.lambda.knowledge_invoke_arn
  knowledge_function_arn         = module.lambda.knowledge_function_arn
  meta_flows_invoke_arn          = module.lambda.meta_flows_invoke_arn
  meta_flows_function_arn        = module.lambda.meta_flows_function_arn
  flows_invoke_arn               = module.lambda.flows_invoke_arn
  flows_function_arn             = module.lambda.flows_function_arn
  calling_invoke_arn             = module.lambda.calling_invoke_arn
  calling_function_arn           = module.lambda.calling_function_arn
  realtime_invoke_arn            = module.lambda.realtime_invoke_arn
  realtime_function_arn          = module.lambda.realtime_function_arn
  calendar_invoke_arn            = module.lambda.calendar_invoke_arn
  calendar_function_arn          = module.lambda.calendar_function_arn
  public_calendar_invoke_arn     = module.lambda.public_calendar_invoke_arn
  public_calendar_function_arn   = module.lambda.public_calendar_function_arn
  payments_invoke_arn            = module.lambda.payments_invoke_arn
  payments_function_arn          = module.lambda.payments_function_arn
  catalog_invoke_arn             = module.lambda.catalog_invoke_arn
  catalog_function_arn           = module.lambda.catalog_function_arn
  allowed_origins                = local.browser_origins
  api_custom_domain              = var.api_custom_domain
  tags                           = local.tags
}

module "monitoring" {
  count  = var.enable_monitoring ? 1 : 0
  source = "../../modules/monitoring"

  project               = local.project
  environment           = local.environment
  alert_emails          = local.ops_alert_emails
  api_id                = module.api_gateway.api_id
  dlq_arns              = module.sqs.dlq_arns
  lambda_function_names = values(module.lambda.function_names)
  sqs_queue_arns = {
    for k, v in module.sqs.queue_arns : k => v
    if contains(["messages", "bulk_send", "campaign", "integration"], k)
  }

  providers = {
    aws = aws.untagged
  }
}

module "amplify" {
  source                         = "../../modules/amplify"
  project                        = local.project
  environment                    = local.environment
  repository_url                 = var.repository_url
  github_access_token            = var.github_access_token
  branch_name                    = "main"
  api_endpoint                   = module.api_gateway.api_endpoint
  aws_region                     = var.aws_region
  cognito_user_pool_id           = module.cognito.user_pool_id
  cognito_client_id              = module.cognito.client_id
  meta_app_id                    = var.meta_app_id
  meta_embedded_signup_config_id = var.meta_embedded_signup_config_id
  custom_domain                  = var.custom_domain
  tags                           = local.tags
}

import {
  for_each = module.lambda.lambda_log_group_ids
  to       = module.lambda.aws_cloudwatch_log_group.lambda_logs[each.key]
  id       = each.value
}
