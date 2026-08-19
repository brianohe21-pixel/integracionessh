output "ecr_repository_url" {
  value = aws_ecr_repository.gateway.repository_url
}

output "alb_dns_name" {
  value = aws_lb.gateway.dns_name
}

output "ws_url" {
  value = var.domain_name != "" ? "wss://${var.domain_name}" : "wss://${aws_lb.gateway.dns_name}"
}

output "cluster_name" {
  value = aws_ecs_cluster.gateway.name
}

output "service_name" {
  value = aws_ecs_service.gateway.name
}
