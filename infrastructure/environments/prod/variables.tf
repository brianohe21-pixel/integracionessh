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
  default = "../../backend/dist/functions.zip"
}

variable "custom_domain" {
  type    = string
  default = ""
}

variable "extra_callback_urls" {
  type        = list(string)
  default     = []
  description = "Add Amplify branch URL + /api/auth/callback/cognito after first apply (terraform output amplify_url)."
}

variable "extra_logout_urls" {
  type        = list(string)
  default     = []
  description = "Add Amplify origin URL for Cognito sign-out after first apply."
}

variable "extra_allowed_origins" {
  type        = list(string)
  default     = []
  description = "Add Amplify origin for API Gateway and S3 CORS after first apply."
}
