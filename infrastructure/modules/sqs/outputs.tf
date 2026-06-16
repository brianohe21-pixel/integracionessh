output "queue_url" {
  value = aws_sqs_queue.messages.url
}

output "queue_arn" {
  value = aws_sqs_queue.messages.arn
}

output "dlq_arn" {
  value = aws_sqs_queue.dlq.arn
}

output "dlq_arns" {
  value = {
    messages    = aws_sqs_queue.dlq.arn
    bulk        = aws_sqs_queue.bulk_dlq.arn
    campaign    = aws_sqs_queue.campaign_dlq.arn
    integration = aws_sqs_queue.integration_dlq.arn
    automation  = aws_sqs_queue.automation_dlq.arn
    knowledge   = aws_sqs_queue.knowledge_dlq.arn
    flow_run    = aws_sqs_queue.flow_run_dlq.arn
    call_events = aws_sqs_queue.call_events_dlq.arn
  }
}

output "queue_arns" {
  value = {
    messages    = aws_sqs_queue.messages.arn
    bulk_send   = aws_sqs_queue.bulk_send.arn
    campaign    = aws_sqs_queue.campaign_send.arn
    integration = aws_sqs_queue.integration_events.arn
    automation  = aws_sqs_queue.automation_run.arn
    knowledge   = aws_sqs_queue.knowledge_index.arn
    flow_run    = aws_sqs_queue.flow_run.arn
    call_events = aws_sqs_queue.call_events.arn
  }
}

output "bulk_queue_url" {
  value = aws_sqs_queue.bulk_send.url
}

output "bulk_queue_arn" {
  value = aws_sqs_queue.bulk_send.arn
}

output "campaign_queue_url" {
  value = aws_sqs_queue.campaign_send.url
}

output "campaign_queue_arn" {
  value = aws_sqs_queue.campaign_send.arn
}

output "integration_queue_url" {
  value = aws_sqs_queue.integration_events.url
}

output "integration_queue_arn" {
  value = aws_sqs_queue.integration_events.arn
}

output "automation_queue_url" {
  value = aws_sqs_queue.automation_run.url
}

output "automation_queue_arn" {
  value = aws_sqs_queue.automation_run.arn
}

output "knowledge_queue_url" {
  value = aws_sqs_queue.knowledge_index.url
}

output "knowledge_queue_arn" {
  value = aws_sqs_queue.knowledge_index.arn
}

output "flow_run_queue_url" {
  value = aws_sqs_queue.flow_run.url
}

output "flow_run_queue_arn" {
  value = aws_sqs_queue.flow_run.arn
}

output "call_events_queue_url" {
  value = aws_sqs_queue.call_events.url
}

output "call_events_queue_arn" {
  value = aws_sqs_queue.call_events.arn
}
