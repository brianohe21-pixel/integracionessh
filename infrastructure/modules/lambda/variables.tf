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

variable "tags" {
  type    = map(string)
  default = {}
}
