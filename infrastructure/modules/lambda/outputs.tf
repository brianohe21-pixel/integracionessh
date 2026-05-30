output "role_arn" {
  value = aws_iam_role.lambda.arn
}

output "function_arns" {
  value = { for k, v in aws_lambda_function.functions : k => v.arn }
}

output "function_names" {
  value = { for k, v in aws_lambda_function.functions : k => v.function_name }
}

output "webhook_invoke_arn" {
  value = aws_lambda_function.functions["webhook"].invoke_arn
}

output "tenants_invoke_arn" {
  value = aws_lambda_function.functions["tenants"].invoke_arn
}

output "bots_invoke_arn" {
  value = aws_lambda_function.functions["bots"].invoke_arn
}

output "conversations_invoke_arn" {
  value = aws_lambda_function.functions["conversations"].invoke_arn
}

output "templates_invoke_arn" {
  value = aws_lambda_function.functions["templates"].invoke_arn
}

output "templates_function_arn" {
  value = aws_lambda_function.functions["templates"].arn
}

output "bulk_send_invoke_arn" {
  value = aws_lambda_function.functions["bulk_send"].invoke_arn
}

output "bulk_send_function_arn" {
  value = aws_lambda_function.functions["bulk_send"].arn
}

output "metrics_invoke_arn" {
  value = aws_lambda_function.functions["metrics"].invoke_arn
}

output "metrics_function_arn" {
  value = aws_lambda_function.functions["metrics"].arn
}

output "whatsapp_connect_invoke_arn" {
  value = aws_lambda_function.functions["whatsapp_connect"].invoke_arn
}

output "whatsapp_connect_function_arn" {
  value = aws_lambda_function.functions["whatsapp_connect"].arn
}

output "authorizer_invoke_arn" {
  value = aws_lambda_function.functions["authorizer"].invoke_arn
}

output "authorizer_arn" {
  value = aws_lambda_function.functions["authorizer"].arn
}

output "campaigns_invoke_arn" {
  value = aws_lambda_function.functions["campaigns"].invoke_arn
}

output "campaigns_function_arn" {
  value = aws_lambda_function.functions["campaigns"].arn
}

output "support_tickets_invoke_arn" {
  value = aws_lambda_function.functions["support_tickets"].invoke_arn
}

output "support_tickets_function_arn" {
  value = aws_lambda_function.functions["support_tickets"].arn
}
