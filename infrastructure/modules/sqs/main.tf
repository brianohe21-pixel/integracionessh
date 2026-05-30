resource "aws_sqs_queue" "dlq" {
  name                        = "${var.project}-${var.environment}-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = 1209600

  tags = var.tags
}

resource "aws_sqs_queue" "messages" {
  name                        = "${var.project}-${var.environment}-messages.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  visibility_timeout_seconds  = 300
  message_retention_seconds   = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })

  tags = var.tags
}

resource "aws_sqs_queue_policy" "messages" {
  queue_url = aws_sqs_queue.messages.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { AWS = var.lambda_role_arns }
        Action    = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource  = aws_sqs_queue.messages.arn
      }
    ]
  })
}

resource "aws_sqs_queue" "bulk_dlq" {
  name                        = "${var.project}-${var.environment}-bulk-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = 1209600

  tags = var.tags
}

resource "aws_sqs_queue" "bulk_send" {
  name                        = "${var.project}-${var.environment}-bulk-send.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  visibility_timeout_seconds  = 120
  message_retention_seconds   = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.bulk_dlq.arn
    maxReceiveCount     = 3
  })

  tags = var.tags
}

resource "aws_sqs_queue_policy" "bulk_send" {
  queue_url = aws_sqs_queue.bulk_send.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { AWS = var.lambda_role_arns }
        Action    = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource  = aws_sqs_queue.bulk_send.arn
      }
    ]
  })
}

resource "aws_sqs_queue" "campaign_dlq" {
  name                        = "${var.project}-${var.environment}-campaign-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = 1209600

  tags = var.tags
}

resource "aws_sqs_queue" "campaign_send" {
  name                        = "${var.project}-${var.environment}-campaign-send.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  visibility_timeout_seconds  = 120
  message_retention_seconds   = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.campaign_dlq.arn
    maxReceiveCount     = 3
  })

  tags = var.tags
}

resource "aws_sqs_queue_policy" "campaign_send" {
  queue_url = aws_sqs_queue.campaign_send.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { AWS = var.lambda_role_arns }
        Action    = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource  = aws_sqs_queue.campaign_send.arn
      }
    ]
  })
}
