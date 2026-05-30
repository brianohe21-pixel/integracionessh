terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
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

data "aws_caller_identity" "current" {}

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
    var.extra_allowed_origins
  )
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
      Effect   = "Allow"
      Action   = ["lambda:InvokeFunction"]
      Resource = module.lambda.campaigns_function_arn
    }]
  })
}

resource "aws_scheduler_schedule_group" "campaigns" {
  name = "${local.project}-${local.environment}"
  tags = local.tags
}

module "lambda" {
  source                 = "../../modules/lambda"
  project                = local.project
  environment            = local.environment
  dynamodb_table_name    = module.dynamodb.table_name
  dynamodb_table_arn     = module.dynamodb.table_arn
  sqs_queue_url          = module.sqs.queue_url
  sqs_queue_arn          = module.sqs.queue_arn
  bulk_sqs_queue_url     = module.sqs.bulk_queue_url
  bulk_sqs_queue_arn     = module.sqs.bulk_queue_arn
  campaign_sqs_queue_url = module.sqs.campaign_queue_url
  campaign_sqs_queue_arn = module.sqs.campaign_queue_arn
  scheduler_role_arn     = aws_iam_role.scheduler.arn
  media_bucket_arn       = module.s3.media_bucket_arn
  cognito_user_pool_id   = module.cognito.user_pool_id
  cognito_client_id      = module.cognito.client_id
  whatsapp_verify_token  = var.whatsapp_verify_token
  meta_app_id            = var.meta_app_id
  meta_app_secret        = var.meta_app_secret
  whatsapp_app_secret    = var.whatsapp_app_secret
  lambda_zip_path        = var.lambda_zip_path
  tags                   = local.tags
}

module "api_gateway" {
  source                        = "../../modules/api-gateway"
  project                       = local.project
  environment                   = local.environment
  cognito_client_id             = module.cognito.client_id
  cognito_issuer_url            = module.cognito.endpoint
  webhook_invoke_arn            = module.lambda.webhook_invoke_arn
  webhook_function_arn          = module.lambda.function_arns["webhook"]
  tenants_invoke_arn            = module.lambda.tenants_invoke_arn
  tenants_function_arn          = module.lambda.function_arns["tenants"]
  bots_invoke_arn               = module.lambda.bots_invoke_arn
  bots_function_arn             = module.lambda.function_arns["bots"]
  conversations_invoke_arn      = module.lambda.conversations_invoke_arn
  conversations_function_arn    = module.lambda.function_arns["conversations"]
  templates_invoke_arn          = module.lambda.templates_invoke_arn
  templates_function_arn        = module.lambda.function_arns["templates"]
  bulk_send_invoke_arn          = module.lambda.bulk_send_invoke_arn
  bulk_send_function_arn        = module.lambda.function_arns["bulk_send"]
  metrics_invoke_arn            = module.lambda.metrics_invoke_arn
  metrics_function_arn          = module.lambda.function_arns["metrics"]
  whatsapp_connect_invoke_arn   = module.lambda.whatsapp_connect_invoke_arn
  whatsapp_connect_function_arn = module.lambda.whatsapp_connect_function_arn
  campaigns_invoke_arn          = module.lambda.campaigns_invoke_arn
  campaigns_function_arn        = module.lambda.campaigns_function_arn
  allowed_origins               = local.browser_origins
  tags                          = local.tags
}

module "amplify" {
  source               = "../../modules/amplify"
  project              = local.project
  environment          = local.environment
  repository_url       = var.repository_url
  github_access_token  = var.github_access_token
  branch_name          = "main"
  api_endpoint         = module.api_gateway.api_endpoint
  aws_region           = var.aws_region
  cognito_user_pool_id              = module.cognito.user_pool_id
  cognito_client_id                 = module.cognito.client_id
  meta_app_id                       = var.meta_app_id
  meta_embedded_signup_config_id    = var.meta_embedded_signup_config_id
  tags                              = local.tags
}
