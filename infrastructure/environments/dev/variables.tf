variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "repository_url" {
  type = string
}

variable "github_access_token" {
  type      = string
  sensitive = true
}

variable "whatsapp_verify_token" {
  type      = string
  sensitive = true
}

variable "meta_app_id" {
  type    = string
  default = ""
}

variable "meta_app_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "whatsapp_app_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Optional; defaults to meta_app_secret when empty"
}

variable "meta_embedded_signup_config_id" {
  type    = string
  default = ""
}

variable "lambda_zip_path" {
  type    = string
  default = "../../../backend/dist/functions.zip"
}

variable "extra_callback_urls" {
  type        = list(string)
  default     = []
  description = "After first apply, add Amplify branch URL + /api/auth/callback/cognito to enable hosted OAuth (see terraform output amplify_url)."
}

variable "extra_logout_urls" {
  type        = list(string)
  default     = []
  description = "After first apply, add the Amplify branch URL (origin only) for Cognito sign-out."
}

variable "extra_allowed_origins" {
  type        = list(string)
  default     = []
  description = "After first apply, add Amplify origin for API Gateway and S3 CORS."
}

variable "api_custom_domain" {
  type        = string
  default     = ""
  description = "Custom API hostname (e.g. api.integracionessh.lat). Requires DNS CNAME in cPanel; see terraform outputs acm_dns_validation and api_gateway_domain_target."
}

variable "stripe_secret_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "stripe_webhook_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "stripe_price_pro" {
  type    = string
  default = ""
}

variable "stripe_price_enterprise" {
  type    = string
  default = ""
}

variable "frontend_url" {
  type    = string
  default = "http://localhost:3000"
}

variable "ops_alert_email" {
  type    = string
  default = ""
}

variable "enable_monitoring" {
  type        = bool
  default     = false
  description = "Deploy SNS/CloudWatch ops alerts (requires SNS and CloudWatch IAM permissions)"
}

variable "wompi_public_key" {
  type    = string
  default = ""
}

variable "wompi_private_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "wompi_integrity_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "wompi_events_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "wompi_amount_pro_cents" {
  type    = string
  default = "17990000"
}

variable "wompi_amount_enterprise_cents" {
  type    = string
  default = "74990000"
}

variable "wompi_api_base" {
  type    = string
  default = "https://sandbox.wompi.co/v1"
}

variable "wompi_checkout_url" {
  type    = string
  default = "https://checkout.wompi.co/p/"
}
