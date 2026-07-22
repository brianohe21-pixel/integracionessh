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

output "leads_invoke_arn" {
  value = aws_lambda_function.functions["leads"].invoke_arn
}

output "leads_function_arn" {
  value = aws_lambda_function.functions["leads"].arn
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

output "instagram_connect_invoke_arn" {
  value = aws_lambda_function.functions["instagram_connect"].invoke_arn
}

output "instagram_connect_function_arn" {
  value = aws_lambda_function.functions["instagram_connect"].arn
}

output "webchat_invoke_arn" {
  value = aws_lambda_function.functions["webchat"].invoke_arn
}

output "webchat_function_arn" {
  value = aws_lambda_function.functions["webchat"].arn
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

output "macros_invoke_arn" {
  value = aws_lambda_function.functions["macros"].invoke_arn
}

output "macros_function_arn" {
  value = aws_lambda_function.functions["macros"].arn
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

output "calling_invoke_arn" {
  value = aws_lambda_function.functions["calling"].invoke_arn
}

output "calling_function_arn" {
  value = aws_lambda_function.functions["calling"].arn
}

output "realtime_invoke_arn" {
  value = aws_lambda_function.functions["realtime"].invoke_arn
}

output "realtime_function_arn" {
  value = aws_lambda_function.functions["realtime"].arn
}

output "realtime_ws_invoke_arn" {
  value = aws_lambda_function.functions["realtime_ws"].invoke_arn
}

output "realtime_ws_function_arn" {
  value = aws_lambda_function.functions["realtime_ws"].arn
}

output "websocket_url" {
  value = local.websocket_url
}

output "websocket_management_endpoint" {
  value = local.websocket_management_endpoint
}

output "calendar_invoke_arn" {
  value = aws_lambda_function.functions["calendar"].invoke_arn
}

output "calendar_function_arn" {
  value = aws_lambda_function.functions["calendar"].arn
}

output "public_calendar_invoke_arn" {
  value = aws_lambda_function.functions["public_calendar"].invoke_arn
}

output "public_calendar_function_arn" {
  value = aws_lambda_function.functions["public_calendar"].arn
}

output "payments_invoke_arn" {
  value = try(aws_lambda_function.functions["payments"].invoke_arn, null)
}

output "payments_function_arn" {
  value = try(aws_lambda_function.functions["payments"].arn, null)
}

output "catalog_invoke_arn" {
  value = try(aws_lambda_function.functions["catalog"].invoke_arn, null)
}

output "catalog_function_arn" {
  value = try(aws_lambda_function.functions["catalog"].arn, null)
}

output "lambda_log_group_ids" {
  value = {
    for k, _ in local.functions : k => "/aws/lambda/${var.project}-${var.environment}-${replace(k, "_", "-")}"
  }
}

output "lambda_log_group_ids_for_import" {
  value = {
    for k, id in {
      for fn, _ in local.functions : fn => "/aws/lambda/${var.project}-${var.environment}-${replace(fn, "_", "-")}"
    } : k => id if !contains(var.cloudwatch_log_group_import_exclude, k)
  }
}
