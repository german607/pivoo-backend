output "alb_dns_name" {
  value = aws_alb.main.dns_name
}

output "alb_zone_id" {
  value = aws_alb.main.zone_id
}

output "security_group_id" {
  value = aws_security_group.alb.id
}

output "target_group_arns" {
  value = { for k, v in aws_alb_target_group.services : k => v.arn }
}
