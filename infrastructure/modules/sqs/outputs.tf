output "queue_url" {
  value = aws_sqs_queue.messages.url
}

output "queue_arn" {
  value = aws_sqs_queue.messages.arn
}

output "dlq_arn" {
  value = aws_sqs_queue.dlq.arn
}
