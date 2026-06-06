output "api_endpoint" {
  value = module.api_gateway.api_endpoint
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
