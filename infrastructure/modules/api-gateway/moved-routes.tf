moved {
  from = aws_apigatewayv2_route.routes["public_api_messages"]
  to   = aws_apigatewayv2_route.routes["public_api_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["public_api_templates_list"]
  to   = aws_apigatewayv2_route.routes["public_api_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["public_api_templates_update"]
  to   = aws_apigatewayv2_route.routes["public_api_proxy_put"]
}

moved {
  from = aws_apigatewayv2_route.routes["public_api_templates_delete"]
  to   = aws_apigatewayv2_route.routes["public_api_proxy_delete"]
}
