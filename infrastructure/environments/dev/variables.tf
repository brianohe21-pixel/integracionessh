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

variable "api_public_url" {
  type        = string
  default     = ""
  description = "Public API base URL for channel webhooks (Telegram). When empty, Terraform uses api_custom_domain or the existing API Gateway execute-api URL."
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
  type        = string
  default     = "https://develop.d5sepmwbbwly9.amplifyapp.com"
  description = "Panel URL for Wompi/Stripe redirects. Run terraform output amplify_url after first apply."
}

variable "ops_alert_email" {
  type    = string
  default = ""
}

variable "ops_alert_emails" {
  type        = list(string)
  default     = []
  description = "Operational alert recipients. Falls back to ops_alert_email when empty. Each address must confirm the AWS SNS subscription email after deploy."
}

variable "ses_from_email" {
  type        = string
  default     = ""
  description = "Verified SES sender for registration admin notifications. Must be verified in SES before deploy."
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

variable "wompi_amount_starter_cents" {
  type    = string
  default = "24190000"
}

variable "wompi_amount_pro_cents" {
  type    = string
  default = "81590000"
}

variable "wompi_amount_enterprise_cents" {
  type    = string
  default = "286590000"
}

variable "wompi_api_base" {
  type    = string
  default = "https://sandbox.wompi.co/v1"
}

variable "wompi_checkout_url" {
  type    = string
  default = "https://checkout.wompi.co/p/"
}

variable "livekit_url" {
  type    = string
  default = ""
}

variable "livekit_api_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "livekit_api_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "telephony_gateway_domain" {
  type    = string
  default = ""
}

variable "telephony_gateway_certificate_arn" {
  type    = string
  default = ""
}

variable "telephony_gateway_vpc_id" {
  type        = string
  description = "VPC ID for the telephony gateway (required for ECS Fargate + ALB)"
}

variable "telephony_gateway_public_subnet_ids" {
  type        = list(string)
  default     = []
  description = "Public subnet IDs for telephony gateway. Pass explicitly if IAM lacks ec2:DescribeSubnets."
}

variable "google_client_id" {
  type    = string
  default = ""
}

variable "google_client_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "google_business_client_id" {
  type    = string
  default = ""
}

variable "google_business_client_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "mailrelay_event_types" {
  type        = string
  default     = ""
  description = "Comma-separated Mailrelay webhook event types for tenant subscriptions"
}

variable "demo_account_email" {
  type        = string
  default     = "demo@integracionessh.dev"
  description = "Public demo account email shown on the develop login page"
}

variable "demo_account_password" {
  type        = string
  default     = "DemoAccess2026!"
  sensitive   = true
  description = "Public demo account password for the develop environment only"
}
