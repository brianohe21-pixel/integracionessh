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
