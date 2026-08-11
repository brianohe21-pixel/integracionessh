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

resource "aws_sqs_queue" "integration_dlq" {
  name                        = "${var.project}-${var.environment}-integration-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = 1209600
  tags                        = var.tags
}

resource "aws_sqs_queue" "integration_events" {
  name                        = "${var.project}-${var.environment}-integration-events.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  visibility_timeout_seconds  = 60
  message_retention_seconds   = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.integration_dlq.arn
    maxReceiveCount     = 3
  })

  tags = var.tags
}

resource "aws_sqs_queue_policy" "integration_events" {
  queue_url = aws_sqs_queue.integration_events.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { AWS = var.lambda_role_arns }
        Action    = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource  = aws_sqs_queue.integration_events.arn
      }
    ]
  })
}

resource "aws_sqs_queue" "automation_dlq" {
  name                        = "${var.project}-${var.environment}-automation-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = 1209600
  tags                        = var.tags
}

resource "aws_sqs_queue" "automation_run" {
  name                        = "${var.project}-${var.environment}-automation-run.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  visibility_timeout_seconds  = 120
  message_retention_seconds   = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.automation_dlq.arn
    maxReceiveCount     = 3
  })

  tags = var.tags
}

resource "aws_sqs_queue_policy" "automation_run" {
  queue_url = aws_sqs_queue.automation_run.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { AWS = var.lambda_role_arns }
        Action    = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource  = aws_sqs_queue.automation_run.arn
      }
    ]
  })
}

resource "aws_sqs_queue" "knowledge_dlq" {
  name                        = "${var.project}-${var.environment}-knowledge-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = 1209600
  tags                        = var.tags
}

resource "aws_sqs_queue" "knowledge_index" {
  name                        = "${var.project}-${var.environment}-knowledge-index.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  visibility_timeout_seconds  = 300
  message_retention_seconds   = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.knowledge_dlq.arn
    maxReceiveCount     = 3
  })

  tags = var.tags
}

resource "aws_sqs_queue_policy" "knowledge_index" {
  queue_url = aws_sqs_queue.knowledge_index.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { AWS = var.lambda_role_arns }
        Action    = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource  = aws_sqs_queue.knowledge_index.arn
      }
    ]
  })
}

resource "aws_sqs_queue" "flow_run_dlq" {
  name                        = "${var.project}-${var.environment}-flow-run-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = 1209600
  tags                        = var.tags
}

resource "aws_sqs_queue" "flow_run" {
  name                        = "${var.project}-${var.environment}-flow-run.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  visibility_timeout_seconds  = 120
  message_retention_seconds   = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.flow_run_dlq.arn
    maxReceiveCount     = 3
  })

  tags = var.tags
}

resource "aws_sqs_queue_policy" "flow_run" {
  queue_url = aws_sqs_queue.flow_run.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { AWS = var.lambda_role_arns }
        Action    = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource  = aws_sqs_queue.flow_run.arn
      }
    ]
  })
}

resource "aws_sqs_queue" "flow_event_dlq" {
  name                        = "${var.project}-${var.environment}-flow-event-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = 1209600
  tags                        = var.tags
}

resource "aws_sqs_queue" "flow_event" {
  name                        = "${var.project}-${var.environment}-flow-event.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  visibility_timeout_seconds  = 300
  message_retention_seconds   = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.flow_event_dlq.arn
    maxReceiveCount     = 3
  })

  tags = var.tags
}

resource "aws_sqs_queue_policy" "flow_event" {
  queue_url = aws_sqs_queue.flow_event.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { AWS = var.lambda_role_arns }
        Action    = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource  = aws_sqs_queue.flow_event.arn
      }
    ]
  })
}

resource "aws_sqs_queue" "call_events_dlq" {
  name                        = "${var.project}-${var.environment}-call-events-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = 1209600
  tags                        = var.tags
}

resource "aws_sqs_queue" "call_events" {
  name                        = "${var.project}-${var.environment}-call-events.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  visibility_timeout_seconds  = 60
  message_retention_seconds   = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.call_events_dlq.arn
    maxReceiveCount     = 3
  })

  tags = var.tags
}

resource "aws_sqs_queue_policy" "call_events" {
  queue_url = aws_sqs_queue.call_events.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { AWS = var.lambda_role_arns }
        Action    = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource  = aws_sqs_queue.call_events.arn
      }
    ]
  })
}

resource "aws_sqs_queue" "telephony_cdr_dlq" {
  name                        = "${var.project}-${var.environment}-telephony-cdr-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = 1209600
  tags                        = var.tags
}

resource "aws_sqs_queue" "telephony_cdr" {
  name                        = "${var.project}-${var.environment}-telephony-cdr.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  visibility_timeout_seconds  = 120
  message_retention_seconds   = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.telephony_cdr_dlq.arn
    maxReceiveCount     = 3
  })

  tags = var.tags
}

resource "aws_sqs_queue_policy" "telephony_cdr" {
  queue_url = aws_sqs_queue.telephony_cdr.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { AWS = var.lambda_role_arns }
        Action    = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource  = aws_sqs_queue.telephony_cdr.arn
      }
    ]
  })
}

resource "aws_sqs_queue" "mailrelay_sync_dlq" {
  name                        = "${var.project}-${var.environment}-mailrelay-sync-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = 1209600
  tags                        = var.tags
}

resource "aws_sqs_queue" "mailrelay_sync" {
  name                        = "${var.project}-${var.environment}-mailrelay-sync.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  visibility_timeout_seconds  = 300
  message_retention_seconds   = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.mailrelay_sync_dlq.arn
    maxReceiveCount     = 3
  })

  tags = var.tags
}

resource "aws_sqs_queue_redrive_allow_policy" "mailrelay_sync_dlq" {
  queue_url = aws_sqs_queue.mailrelay_sync_dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.mailrelay_sync.arn]
  })
}

resource "aws_sqs_queue_policy" "mailrelay_sync" {
  queue_url = aws_sqs_queue.mailrelay_sync.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { AWS = var.lambda_role_arns }
        Action    = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource  = aws_sqs_queue.mailrelay_sync.arn
      }
    ]
  })
}

resource "aws_sqs_queue" "whatsapp_sync_dlq" {
  name                        = "${var.project}-${var.environment}-whatsapp-sync-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = 1209600
  tags                        = var.tags
}

resource "aws_sqs_queue" "whatsapp_sync" {
  name                        = "${var.project}-${var.environment}-whatsapp-sync.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  visibility_timeout_seconds  = 300
  message_retention_seconds   = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.whatsapp_sync_dlq.arn
    maxReceiveCount     = 3
  })

  tags = var.tags
}

resource "aws_sqs_queue_redrive_allow_policy" "whatsapp_sync_dlq" {
  queue_url = aws_sqs_queue.whatsapp_sync_dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.whatsapp_sync.arn]
  })
}

resource "aws_sqs_queue_policy" "whatsapp_sync" {
  queue_url = aws_sqs_queue.whatsapp_sync.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { AWS = var.lambda_role_arns }
        Action    = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource  = aws_sqs_queue.whatsapp_sync.arn
      }
    ]
  })
}
