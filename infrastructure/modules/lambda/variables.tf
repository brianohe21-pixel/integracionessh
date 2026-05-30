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

variable "scheduler_role_arn" {
  type        = string
  default     = ""
  description = "IAM role ARN for EventBridge Scheduler to invoke the campaigns Lambda"
}

variable "media_bucket_arn" {
  type = string
}

variable "cognito_user_pool_id" {
  type = string
}

variable "cognito_client_id" {
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

variable "lambda_zip_path" {
  type        = string
  default     = "../../backend/dist/functions.zip"
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
  default     = "9900000"
  description = "Pro plan price in COP cents (default 99000 COP)"
}

variable "wompi_amount_enterprise_cents" {
  type        = string
  default     = "29900000"
  description = "Enterprise plan price in COP cents (default 299000 COP)"
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
