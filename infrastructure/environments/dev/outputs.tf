output "api_endpoint" {
  value = module.api_gateway.api_endpoint
}

output "api_invoke_url" {
  value       = module.api_gateway.api_invoke_url
  description = "Default execute-api URL (unchanged when custom domain is enabled)."
}

output "api_gateway_domain_target" {
  value       = module.api_gateway.api_gateway_domain_target
  description = "cPanel CNAME for api: Name=api, Record=this hostname."
}

output "acm_dns_validation" {
  value       = module.api_gateway.acm_dns_validation
  description = "cPanel CNAME for ACM certificate validation (required before custom domain works)."
}

output "websocket_url" {
  value = module.lambda.websocket_url
}

output "cognito_user_pool_id" {
  value = module.cognito.user_pool_id
}

output "cognito_client_id" {
  value = module.cognito.client_id
}

output "dynamodb_table_name" {
  value = module.dynamodb.table_name
}

output "sqs_queue_url" {
  value = module.sqs.queue_url
}

output "media_bucket_name" {
  value = module.s3.media_bucket_name
}

output "amplify_url" {
  value = module.amplify.branch_url
}

output "amplify_oauth_followup" {
  value       = "After first apply: terraform output amplify_url. Put that URL in extra_logout_urls and extra_allowed_origins; append /api/auth/callback/cognito to the same host for extra_callback_urls; apply again."
  description = "Second apply wires Cognito OAuth and CORS to Amplify without a Terraform dependency cycle."
}
