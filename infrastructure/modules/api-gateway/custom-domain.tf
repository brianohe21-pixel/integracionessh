locals {
  api_custom_domain_enabled = trimspace(var.api_custom_domain) != ""
}

resource "aws_acm_certificate" "api" {
  count = local.api_custom_domain_enabled ? 1 : 0

  domain_name       = trimspace(var.api_custom_domain)
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = var.tags
}

resource "aws_acm_certificate_validation" "api" {
  count = local.api_custom_domain_enabled ? 1 : 0

  certificate_arn = aws_acm_certificate.api[0].arn
  validation_record_fqdns = [
    one(aws_acm_certificate.api[0].domain_validation_options).resource_record_name,
  ]
}

resource "aws_apigatewayv2_domain_name" "api" {
  count = local.api_custom_domain_enabled ? 1 : 0

  domain_name = trimspace(var.api_custom_domain)

  domain_name_configuration {
    certificate_arn = aws_acm_certificate_validation.api[0].certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = var.tags

  depends_on = [aws_acm_certificate_validation.api]
}

resource "aws_apigatewayv2_api_mapping" "api" {
  count = local.api_custom_domain_enabled ? 1 : 0

  api_id      = aws_apigatewayv2_api.main.id
  domain_name = aws_apigatewayv2_domain_name.api[0].id
  stage       = aws_apigatewayv2_stage.default.id
}

locals {
  api_public_base_url = local.api_custom_domain_enabled ? "https://${trimspace(var.api_custom_domain)}" : trimsuffix(aws_apigatewayv2_stage.default.invoke_url, "/")
}
