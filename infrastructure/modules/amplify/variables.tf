variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "repository_url" {
  type = string
}

variable "github_access_token" {
  type      = string
  sensitive = true
}

variable "branch_name" {
  type    = string
  default = "main"
}

variable "api_endpoint" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "cognito_user_pool_id" {
  type = string
}

variable "cognito_client_id" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
