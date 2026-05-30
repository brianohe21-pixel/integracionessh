output "queue_url" {
  value = aws_sqs_queue.messages.url
}

output "queue_arn" {
  value = aws_sqs_queue.messages.arn
}

output "dlq_arn" {
  value = aws_sqs_queue.dlq.arn
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
