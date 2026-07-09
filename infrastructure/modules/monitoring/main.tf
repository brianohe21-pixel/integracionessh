variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "alert_emails" {
  type        = list(string)
  description = "Email addresses for operational alerts"
  default     = []
}

variable "lambda_function_names" {
  type        = list(string)
  description = "Lambda function names to monitor for errors"
}

variable "api_id" {
  type = string
}

variable "dlq_arns" {
  type        = map(string)
  description = "DLQ ARNs keyed by logical name"
}

variable "sqs_queue_arns" {
  type        = map(string)
  description = "Main queue ARNs to monitor for message age"
  default     = {}
}

variable "sqs_queue_age_threshold_seconds" {
  type        = number
  description = "Alert when oldest message age exceeds this value"
  default     = 600
}

locals {
  sns_actions = [aws_sns_topic.alerts.arn]
}

resource "aws_sns_topic" "alerts" {
  name = "${var.project}-${var.environment}-ops-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  for_each  = toset(compact(var.alert_emails))
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "${var.project}-${var.environment}-${each.value}-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_description   = "Lambda ${each.value} reported errors"
  alarm_actions       = local.sns_actions
  ok_actions          = local.sns_actions

  dimensions = {
    FunctionName = each.value
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "${var.project}-${var.environment}-${each.value}-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_description   = "Lambda ${each.value} was throttled"
  alarm_actions       = local.sns_actions
  ok_actions          = local.sns_actions

  dimensions = {
    FunctionName = each.value
  }
}

resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  for_each = var.dlq_arns

  alarm_name          = "${var.project}-${var.environment}-${each.key}-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_description   = "Messages visible in DLQ ${each.key}"
  alarm_actions       = local.sns_actions
  ok_actions          = local.sns_actions

  dimensions = {
    QueueName = split(":", each.value)[5]
  }
}

resource "aws_cloudwatch_metric_alarm" "sqs_queue_age" {
  for_each = var.sqs_queue_arns

  alarm_name          = "${var.project}-${var.environment}-${each.key}-queue-age"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = var.sqs_queue_age_threshold_seconds
  treat_missing_data  = "notBreaching"
  alarm_description   = "Oldest message in queue ${each.key} exceeds ${var.sqs_queue_age_threshold_seconds}s"
  alarm_actions       = local.sns_actions
  ok_actions          = local.sns_actions

  dimensions = {
    QueueName = split(":", each.value)[5]
  }
}

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${var.project}-${var.environment}-api-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5xx"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  alarm_description   = "API Gateway 5xx errors"
  alarm_actions       = local.sns_actions
  ok_actions          = local.sns_actions

  dimensions = {
    ApiId = var.api_id
  }
}
