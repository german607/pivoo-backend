terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "pivoo-terraform-state"
    key    = "dev/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = local.common_tags
  }
}

locals {
  project     = "pivoo"
  environment = "dev"
  common_tags = {
    Project     = local.project
    Environment = local.environment
    ManagedBy   = "terraform"
  }

  services_config = {
    "auth-service" = {
      port         = 3001
      priority     = 10
      path_pattern = "/api/v1/auth*"
    }
    "users-service" = {
      port         = 3002
      priority     = 20
      path_pattern = "/api/v1/users*"
    }
    "matches-service" = {
      port         = 3003
      priority     = 30
      path_pattern = "/api/v1/matches*"
    }
    "sports-service" = {
      port         = 3004
      priority     = 40
      path_pattern = "/api/v1/sports*"
    }
    "complexes-service" = {
      port         = 3005
      priority     = 50
      path_pattern = "/api/v1/complexes*"
    }
  }
}

module "vpc" {
  source             = "../../modules/vpc"
  project            = local.project
  environment        = local.environment
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["${var.aws_region}a", "${var.aws_region}b"]
  tags               = local.common_tags
}

module "ecr" {
  source  = "../../modules/ecr"
  project = local.project
  tags    = local.common_tags
}

module "alb" {
  source            = "../../modules/alb"
  project           = local.project
  environment       = local.environment
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  certificate_arn   = var.certificate_arn
  services          = { for k, v in local.services_config : k => v }
  tags              = local.common_tags
}

module "rds" {
  source                = "../../modules/rds"
  project               = local.project
  environment           = local.environment
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  ecs_security_group_id = module.ecs.ecs_security_group_id
  db_name               = "pivoo"
  db_username           = var.db_username
  db_password           = var.db_password
  instance_class        = "db.t4g.micro"
  tags                  = local.common_tags
}

module "ecs" {
  source                = "../../modules/ecs"
  project               = local.project
  environment           = local.environment
  aws_region            = var.aws_region
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  alb_security_group_id = module.alb.security_group_id
  target_group_arns     = module.alb.target_group_arns

  services = {
    "auth-service" = {
      image         = "${module.ecr.repository_urls["auth-service"]}:latest"
      port          = 3001
      cpu           = 256
      memory        = 512
      desired_count = 1
      environment = [
        { name = "PORT", value = "3001" },
        { name = "JWT_EXPIRES_IN", value = "15m" },
        { name = "JWT_REFRESH_EXPIRES_IN", value = "7d" },
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:pivoo/dev/auth-db-url" },
        { name = "JWT_SECRET", valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:pivoo/dev/jwt-secret" },
      ]
    }
    "users-service" = {
      image         = "${module.ecr.repository_urls["users-service"]}:latest"
      port          = 3002
      cpu           = 256
      memory        = 512
      desired_count = 1
      environment = [
        { name = "PORT", value = "3002" },
        { name = "AUTH_SERVICE_URL", value = "http://internal-alb/api/v1" },
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:pivoo/dev/users-db-url" },
      ]
    }
    "matches-service" = {
      image         = "${module.ecr.repository_urls["matches-service"]}:latest"
      port          = 3003
      cpu           = 256
      memory        = 512
      desired_count = 1
      environment = [
        { name = "PORT", value = "3003" },
        { name = "USERS_SERVICE_URL", value = "http://internal-alb/api/v1" },
        { name = "SPORTS_SERVICE_URL", value = "http://internal-alb/api/v1" },
        { name = "COMPLEXES_SERVICE_URL", value = "http://internal-alb/api/v1" },
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:pivoo/dev/matches-db-url" },
      ]
    }
    "sports-service" = {
      image         = "${module.ecr.repository_urls["sports-service"]}:latest"
      port          = 3004
      cpu           = 256
      memory        = 512
      desired_count = 1
      environment   = [{ name = "PORT", value = "3004" }]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:pivoo/dev/sports-db-url" },
      ]
    }
    "complexes-service" = {
      image         = "${module.ecr.repository_urls["complexes-service"]}:latest"
      port          = 3005
      cpu           = 256
      memory        = 512
      desired_count = 1
      environment   = [{ name = "PORT", value = "3005" }]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:pivoo/dev/complexes-db-url" },
      ]
    }
  }

  tags = local.common_tags
}
