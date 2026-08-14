moved {
  from = aws_apigatewayv2_route.routes["public_api_templates_list"]
  to   = aws_apigatewayv2_route.routes["public_api_proxy_get"]
}
