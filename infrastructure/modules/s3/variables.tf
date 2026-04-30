variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "account_id" {
  type = string
}

variable "allowed_origins" {
  type    = list(string)
  default = ["*"]
}

variable "tags" {
  type    = map(string)
  default = {}
}
