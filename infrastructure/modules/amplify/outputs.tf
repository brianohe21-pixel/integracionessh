output "app_id" {
  value = aws_amplify_app.frontend.id
}

output "default_domain" {
  value = aws_amplify_app.frontend.default_domain
}

output "branch_url" {
  value = "https://${var.branch_name}.${aws_amplify_app.frontend.default_domain}"
}

output "amplify_service_role_arn" {
  value = aws_iam_role.amplify_service.arn
}
