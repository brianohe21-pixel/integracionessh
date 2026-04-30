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
