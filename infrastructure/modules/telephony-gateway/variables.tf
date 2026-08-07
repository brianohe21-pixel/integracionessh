variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "vpc_id" {
  type        = string
  description = "VPC ID for the telephony gateway ALB and ECS tasks"
}

variable "public_subnet_ids" {
  type        = list(string)
  default     = []
  description = "Public subnet IDs for the ALB and ECS tasks. If empty, subnets are discovered in the VPC."
}

variable "dynamodb_table_arn" {
  type = string
}

variable "dynamodb_table_name" {
  type = string
}

variable "certificate_arn" {
  type        = string
  default     = ""
  description = "Optional ACM certificate ARN for HTTPS/WSS on the ALB"
}

variable "domain_name" {
  type        = string
  default     = ""
  description = "Optional custom domain for telephony gateway"
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "telephony_lambda_name" {
  type        = string
  default     = ""
  description = "Telephony Lambda function name for tool execution"
}

variable "tags" {
  type    = map(string)
  default = {}
}
