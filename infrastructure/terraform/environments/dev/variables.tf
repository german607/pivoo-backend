variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "aws_account_id" {
  type = string
}

variable "certificate_arn" {
  type        = string
  description = "ACM certificate ARN for HTTPS"
}

variable "db_username" {
  type      = string
  default   = "pivoo"
  sensitive = true
}

variable "db_password" {
  type      = string
  sensitive = true
}
