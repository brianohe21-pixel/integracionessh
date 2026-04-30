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

variable "lambda_zip_path" {
  type        = string
  default     = "../../backend/dist/functions.zip"
  description = "Path to deployment zip. If the file is missing, a minimal bootstrap zip in the module is used so terraform plan/apply can run; run `npm run build` in backend/ and apply again to deploy real code."
}

variable "tags" {
  type    = map(string)
  default = {}
}
