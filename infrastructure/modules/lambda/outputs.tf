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

output "advisors_invoke_arn" {
  value = aws_lambda_function.functions["advisors"].invoke_arn
}

output "advisors_function_arn" {
  value = aws_lambda_function.functions["advisors"].arn
}

output "contacts_invoke_arn" {
  value = aws_lambda_function.functions["contacts"].invoke_arn
}

output "contacts_function_arn" {
  value = aws_lambda_function.functions["contacts"].arn
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

output "billing_invoke_arn" {
  value = aws_lambda_function.functions["billing"].invoke_arn
}

output "billing_function_arn" {
  value = aws_lambda_function.functions["billing"].arn
}

output "admin_invoke_arn" {
  value = aws_lambda_function.functions["admin"].invoke_arn
}

output "admin_function_arn" {
  value = aws_lambda_function.functions["admin"].arn
}

output "public_api_invoke_arn" {
  value = aws_lambda_function.functions["public_api"].invoke_arn
}

output "public_api_function_arn" {
  value = aws_lambda_function.functions["public_api"].arn
}

output "api_keys_invoke_arn" {
  value = aws_lambda_function.functions["api_keys"].invoke_arn
}

output "api_keys_function_arn" {
  value = aws_lambda_function.functions["api_keys"].arn
}

output "integrations_invoke_arn" {
  value = aws_lambda_function.functions["integrations"].invoke_arn
}

output "integrations_function_arn" {
  value = aws_lambda_function.functions["integrations"].arn
}

output "automations_invoke_arn" {
  value = aws_lambda_function.functions["automations"].invoke_arn
}

output "automations_function_arn" {
  value = aws_lambda_function.functions["automations"].arn
}

output "knowledge_invoke_arn" {
  value = aws_lambda_function.functions["knowledge"].invoke_arn
}

output "knowledge_function_arn" {
  value = aws_lambda_function.functions["knowledge"].arn
}

output "meta_flows_invoke_arn" {
  value = aws_lambda_function.functions["meta_flows"].invoke_arn
}

output "meta_flows_function_arn" {
  value = aws_lambda_function.functions["meta_flows"].arn
}

output "flows_invoke_arn" {
  value = aws_lambda_function.functions["flows"].invoke_arn
}

output "flows_function_arn" {
  value = aws_lambda_function.functions["flows"].arn
}
