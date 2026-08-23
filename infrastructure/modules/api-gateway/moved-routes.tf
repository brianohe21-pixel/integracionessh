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

moved {
  from = aws_apigatewayv2_route.routes["catalog_config_get"]
  to   = aws_apigatewayv2_route.routes["catalog_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["catalog_config_put"]
  to   = aws_apigatewayv2_route.routes["catalog_proxy_put"]
}

moved {
  from = aws_apigatewayv2_route.routes["catalog_enable"]
  to   = aws_apigatewayv2_route.routes["catalog_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["catalog_disable"]
  to   = aws_apigatewayv2_route.routes["catalog_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["catalog_meta_catalogs"]
  to   = aws_apigatewayv2_route.routes["catalog_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["catalog_link"]
  to   = aws_apigatewayv2_route.routes["catalog_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["catalog_sync"]
  to   = aws_apigatewayv2_route.routes["catalog_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["catalog_products_list"]
  to   = aws_apigatewayv2_route.routes["catalog_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["catalog_products_create"]
  to   = aws_apigatewayv2_route.routes["catalog_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["catalog_products_get"]
  to   = aws_apigatewayv2_route.routes["catalog_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["catalog_products_put"]
  to   = aws_apigatewayv2_route.routes["catalog_proxy_put"]
}

moved {
  from = aws_apigatewayv2_route.routes["catalog_products_delete"]
  to   = aws_apigatewayv2_route.routes["catalog_proxy_delete"]
}

moved {
  from = aws_apigatewayv2_route.routes["catalog_products_image"]
  to   = aws_apigatewayv2_route.routes["catalog_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["catalog_products_image_finalize"]
  to   = aws_apigatewayv2_route.routes["catalog_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["catalog_orders_list"]
  to   = aws_apigatewayv2_route.routes["catalog_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["catalog_orders_get"]
  to   = aws_apigatewayv2_route.routes["catalog_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["catalog_orders_patch"]
  to   = aws_apigatewayv2_route.routes["catalog_proxy_patch"]
}

moved {
  from = aws_apigatewayv2_route.routes["metrics_leads"]
  to   = aws_apigatewayv2_route.routes["metrics_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["metrics_marketing"]
  to   = aws_apigatewayv2_route.routes["metrics_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["metrics_calling"]
  to   = aws_apigatewayv2_route.routes["metrics_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["metrics_sales"]
  to   = aws_apigatewayv2_route.routes["metrics_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["metrics_inbox_sla"]
  to   = aws_apigatewayv2_route.routes["metrics_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["metrics_advisor_workload"]
  to   = aws_apigatewayv2_route.routes["metrics_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["metrics_export"]
  to   = aws_apigatewayv2_route.routes["metrics_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["conversations_bulk_handoff"]
  to   = aws_apigatewayv2_route.routes["conversations_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["conversations_get"]
  to   = aws_apigatewayv2_route.routes["conversations_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["conversations_handoff"]
  to   = aws_apigatewayv2_route.routes["conversations_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["conversations_claim"]
  to   = aws_apigatewayv2_route.routes["conversations_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["conversations_release"]
  to   = aws_apigatewayv2_route.routes["conversations_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["conversations_send_message"]
  to   = aws_apigatewayv2_route.routes["conversations_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["conversations_copilot"]
  to   = aws_apigatewayv2_route.routes["conversations_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["conversations_quotations_list"]
  to   = aws_apigatewayv2_route.routes["conversations_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["conversations_quotations_create"]
  to   = aws_apigatewayv2_route.routes["conversations_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["conversations_wa_link"]
  to   = aws_apigatewayv2_route.routes["conversations_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["conversations_status"]
  to   = aws_apigatewayv2_route.routes["conversations_proxy_patch"]
}

moved {
  from = aws_apigatewayv2_route.routes["conversations_note"]
  to   = aws_apigatewayv2_route.routes["conversations_proxy_patch"]
}

moved {
  from = aws_apigatewayv2_route.routes["conversations_resolve"]
  to   = aws_apigatewayv2_route.routes["conversations_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["conversations_delete"]
  to   = aws_apigatewayv2_route.routes["conversations_proxy_delete"]
}

moved {
  from = aws_apigatewayv2_route.routes["conversations_message_attachment"]
  to   = aws_apigatewayv2_route.routes["conversations_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["conversations_message_html"]
  to   = aws_apigatewayv2_route.routes["conversations_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["flows_get"]
  to   = aws_apigatewayv2_route.routes["flows_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["flows_update"]
  to   = aws_apigatewayv2_route.routes["flows_proxy_put"]
}

moved {
  from = aws_apigatewayv2_route.routes["flows_delete"]
  to   = aws_apigatewayv2_route.routes["flows_proxy_delete"]
}

moved {
  from = aws_apigatewayv2_route.routes["flows_enable"]
  to   = aws_apigatewayv2_route.routes["flows_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["flows_disable"]
  to   = aws_apigatewayv2_route.routes["flows_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["flows_validate"]
  to   = aws_apigatewayv2_route.routes["flows_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["flows_hook_get"]
  to   = aws_apigatewayv2_route.routes["flows_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["flows_hook_rotate"]
  to   = aws_apigatewayv2_route.routes["flows_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["flows_runs"]
  to   = aws_apigatewayv2_route.routes["flows_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["flows_events"]
  to   = aws_apigatewayv2_route.routes["flows_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["flows_template_taxi"]
  to   = aws_apigatewayv2_route.routes["flows_proxy_post"]
}

moved {
  from = aws_apigatewayv2_route.routes["flows_secrets_get"]
  to   = aws_apigatewayv2_route.routes["flows_proxy_get"]
}

moved {
  from = aws_apigatewayv2_route.routes["flows_secrets_put"]
  to   = aws_apigatewayv2_route.routes["flows_proxy_put"]
}

moved {
  from = aws_apigatewayv2_route.routes["flows_secrets_delete"]
  to   = aws_apigatewayv2_route.routes["flows_proxy_delete"]
}
