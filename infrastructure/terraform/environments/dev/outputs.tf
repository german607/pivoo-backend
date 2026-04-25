output "alb_dns_name" {
  value = module.alb.alb_dns_name
}

output "rds_endpoint" {
  value     = module.rds.endpoint
  sensitive = true
}

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}
