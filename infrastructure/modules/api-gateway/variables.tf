variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "cognito_client_id" {
  type = string
}

variable "cognito_issuer_url" {
  type = string
}

variable "webhook_invoke_arn" {
  type = string
}

variable "webhook_function_arn" {
  type = string
}

variable "tenants_invoke_arn" {
  type = string
}

variable "tenants_function_arn" {
  type = string
}

variable "bots_invoke_arn" {
  type = string
}

variable "bots_function_arn" {
  type = string
}

variable "conversations_invoke_arn" {
  type = string
}

variable "conversations_function_arn" {
  type = string
}

variable "advisors_invoke_arn" {
  type = string
}

variable "advisors_function_arn" {
  type = string
}

variable "contacts_invoke_arn" {
  type = string
}

variable "contacts_function_arn" {
  type = string
}

variable "templates_invoke_arn" {
  type = string
}

variable "templates_function_arn" {
  type = string
}

variable "bulk_send_invoke_arn" {
  type = string
}

variable "bulk_send_function_arn" {
  type = string
}

variable "metrics_invoke_arn" {
  type = string
}

variable "metrics_function_arn" {
  type = string
}

variable "whatsapp_connect_invoke_arn" {
  type = string
}

variable "whatsapp_connect_function_arn" {
  type = string
}

variable "campaigns_invoke_arn" {
  type = string
}

variable "campaigns_function_arn" {
  type = string
}

variable "support_tickets_invoke_arn" {
  type = string
}

variable "support_tickets_function_arn" {
  type = string
}

variable "billing_invoke_arn" {
  type = string
}

variable "billing_function_arn" {
  type = string
}

variable "admin_invoke_arn" {
  type = string
}

variable "admin_function_arn" {
  type = string
}

variable "public_api_invoke_arn" {
  type = string
}

variable "public_api_function_arn" {
  type = string
}

variable "api_keys_invoke_arn" {
  type = string
}

variable "api_keys_function_arn" {
  type = string
}

variable "integrations_invoke_arn" {
  type = string
}

variable "integrations_function_arn" {
  type = string
}

variable "automations_invoke_arn" {
  type = string
}

variable "automations_function_arn" {
  type = string
}

variable "knowledge_invoke_arn" {
  type = string
}

variable "knowledge_function_arn" {
  type = string
}

variable "meta_flows_invoke_arn" {
  type = string
}

variable "meta_flows_function_arn" {
  type = string
}

variable "flows_invoke_arn" {
  type = string
}

variable "flows_function_arn" {
  type = string
}

variable "calling_invoke_arn" {
  type = string
}

variable "calling_function_arn" {
  type = string
}

variable "allowed_origins" {
  type    = list(string)
  default = ["*"]
}

variable "api_custom_domain" {
  type        = string
  default     = ""
  description = "Optional custom hostname for API Gateway (e.g. api.example.com). DNS must be configured externally (CNAME to api_gateway_domain_target output)."
}

variable "tags" {
  type    = map(string)
  default = {}
}
