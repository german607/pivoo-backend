resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-${var.environment}-db-subnet-group"
  subnet_ids = var.private_subnet_ids
  tags       = var.tags
}

resource "aws_security_group" "rds" {
  name        = "${var.project}-${var.environment}-rds-sg"
  description = "Allow PostgreSQL access from ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.ecs_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.project}-${var.environment}-rds-sg" })
}

resource "aws_db_instance" "main" {
  identifier             = "${var.project}-${var.environment}-postgres"
  engine                 = "postgres"
  engine_version         = "16.1"
  instance_class         = var.instance_class
  allocated_storage      = var.allocated_storage
  max_allocated_storage  = var.max_allocated_storage
  storage_encrypted      = true
  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  multi_az               = var.environment == "prod"
  skip_final_snapshot    = var.environment != "prod"
  deletion_protection    = var.environment == "prod"
  backup_retention_period = var.environment == "prod" ? 7 : 1

  tags = merge(var.tags, { Name = "${var.project}-${var.environment}-postgres" })
}
