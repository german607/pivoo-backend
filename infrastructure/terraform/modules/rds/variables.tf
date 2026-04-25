variable "project" { type = string }
variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "ecs_security_group_id" { type = string }
variable "db_name" { type = string }
variable "db_username" { type = string }
variable "db_password" { type = string; sensitive = true }
variable "instance_class" { type = string; default = "db.t4g.micro" }
variable "allocated_storage" { type = number; default = 20 }
variable "max_allocated_storage" { type = number; default = 100 }
variable "tags" { type = map(string); default = {} }
