variable "project" { type = string }
variable "environment" { type = string }
variable "aws_region" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "alb_security_group_id" { type = string }
variable "target_group_arns" { type = map(string) }

variable "services" {
  type = map(object({
    image         = string
    port          = number
    cpu           = number
    memory        = number
    desired_count = number
    environment   = list(object({ name = string, value = string }))
    secrets       = list(object({ name = string, valueFrom = string }))
  }))
}

variable "tags" { type = map(string); default = {} }
