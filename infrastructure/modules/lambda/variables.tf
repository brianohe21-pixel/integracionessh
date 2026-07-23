variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "dynamodb_table_name" {
  type = string
}

variable "dynamodb_table_arn" {
  type = string
}

variable "sqs_queue_url" {
  type = string
}

variable "sqs_queue_arn" {
  type = string
}

variable "bulk_sqs_queue_url" {
  type = string
}

variable "bulk_sqs_queue_arn" {
  type = string
}

variable "campaign_sqs_queue_url" {
  type = string
}

variable "campaign_sqs_queue_arn" {
  type = string
}

variable "integration_sqs_queue_url" {
  type = string
}

variable "integration_sqs_queue_arn" {
  type = string
}

variable "automation_sqs_queue_url" {
  type = string
}

variable "automation_sqs_queue_arn" {
  type = string
}

variable "knowledge_sqs_queue_url" {
  type = string
}

variable "knowledge_sqs_queue_arn" {
  type = string
}

variable "flow_run_sqs_queue_url" {
  type = string
}

variable "flow_run_sqs_queue_arn" {
  type = string
}

variable "call_events_sqs_queue_url" {
  type = string
}

variable "call_events_sqs_queue_arn" {
  type = string
}

variable "scheduler_role_arn" {
  type        = string
  default     = ""
  description = "IAM role ARN for EventBridge Scheduler to invoke the campaigns Lambda"
}

variable "media_bucket_arn" {
  type = string
}

variable "media_bucket_name" {
  type    = string
  default = ""
}

variable "cognito_user_pool_id" {
  type = string
}

variable "cognito_user_pool_arn" {
  type = string
}

variable "cognito_client_id" {
  type = string
}

variable "cognito_issuer_url" {
  type = string
}

variable "whatsapp_verify_token" {
  type      = string
  sensitive = true
}

variable "meta_app_id" {
  type        = string
  default     = ""
  description = "Meta App ID for WhatsApp Embedded Signup token exchange"
}

variable "meta_app_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Meta App Secret for WhatsApp Embedded Signup token exchange"
}

variable "whatsapp_app_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Meta App Secret used for webhook signature validation and tenant secret storage"
}

variable "webchat_session_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "HMAC secret for web chat session tokens"
}

variable "livekit_url" {
  type        = string
  default     = ""
  description = "LiveKit server WebSocket URL (wss://...)"
}

variable "livekit_api_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "LiveKit API key"
}

variable "livekit_api_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "LiveKit API secret"
}

variable "lambda_zip_path" {
  type        = string
  default     = ""
  description = "Path to deployment zip. If the file is missing, a minimal bootstrap zip in the module is used so terraform plan/apply can run; run `pnpm --filter chatbot-platform-backend run build` from repo root and apply again to deploy real code."
}

variable "stripe_secret_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Stripe secret API key (sk_test_ or sk_live_)"
}

variable "stripe_webhook_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Stripe webhook signing secret (whsec_)"
}

variable "stripe_price_pro" {
  type        = string
  default     = ""
  description = "Stripe Price ID for Pro plan"
}

variable "stripe_price_enterprise" {
  type        = string
  default     = ""
  description = "Stripe Price ID for Enterprise plan"
}

variable "frontend_url" {
  type        = string
  default     = "http://localhost:3000"
  description = "Frontend base URL for billing redirect URLs"
}

variable "api_public_url" {
  type        = string
  default     = ""
  description = "Public API base URL for channel webhooks (e.g. Telegram registration)"
}

variable "ses_from_email" {
  type        = string
  default     = ""
  description = "Verified SES sender for platform emails. Leave empty to disable outbound email."
}

variable "admin_notification_emails" {
  type        = list(string)
  default     = []
  description = "Admin recipients for new user registration notifications"
}

variable "wompi_public_key" {
  type        = string
  default     = ""
  description = "Wompi public key (pub_test_ or pub_prod_)"
}

variable "wompi_private_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Wompi private key for API (prv_test_ or prv_prod_)"
}

variable "wompi_integrity_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Wompi integrity secret for checkout signature"
}

variable "wompi_events_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Wompi events secret for webhook verification"
}

variable "wompi_amount_pro_cents" {
  type        = string
  default     = "17990000"
  description = "Pro plan price in COP cents (default 179900 COP)"
}

variable "wompi_amount_enterprise_cents" {
  type        = string
  default     = "74990000"
  description = "Enterprise plan price in COP cents (default 749900 COP)"
}

variable "wompi_api_base" {
  type        = string
  default     = "https://production.wompi.co/v1"
  description = "Use https://sandbox.wompi.co/v1 for sandbox"
}

variable "wompi_checkout_url" {
  type        = string
  default     = "https://checkout.wompi.co/p/"
  description = "Wompi Web Checkout base URL"
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "cloudwatch_log_group_import_exclude" {
  type        = set(string)
  default     = ["catalog", "payments", "realtime_ws", "macros"]
  description = "Lambda keys whose log groups are created by Terraform instead of imported (new functions without pre-existing log groups in AWS)"
}
