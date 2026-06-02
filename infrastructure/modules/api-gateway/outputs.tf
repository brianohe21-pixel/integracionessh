output "api_id" {
  value = aws_apigatewayv2_api.main.id
}

output "api_endpoint" {
  value = local.api_public_base_url
}

output "api_invoke_url" {
  value       = aws_apigatewayv2_stage.default.invoke_url
  description = "Default execute-api URL (always available)."
}

output "api_custom_domain_enabled" {
  value = local.api_custom_domain_enabled
}

output "api_gateway_domain_target" {
  value       = local.api_custom_domain_enabled ? aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].target_domain_name : null
  description = "CNAME target for api_custom_domain (add in cPanel/Namecheap: Name=api, Record=this value)."
}

output "acm_dns_validation" {
  value = local.api_custom_domain_enabled ? {
    name   = one(aws_acm_certificate.api[0].domain_validation_options).resource_record_name
    record = one(aws_acm_certificate.api[0].domain_validation_options).resource_record_value
    type   = one(aws_acm_certificate.api[0].domain_validation_options).resource_record_type
  } : null
  description = "Add this CNAME in cPanel before custom domain can finish (ACM certificate validation)."
}

output "execution_arn" {
  value = aws_apigatewayv2_api.main.execution_arn
}
