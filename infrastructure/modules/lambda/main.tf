data "aws_iam_policy_document" "assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.project}-${var.environment}-lambda"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_permissions" {
  name = "${var.project}-${var.environment}-lambda-permissions"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchWriteItem",
          "dynamodb:BatchGetItem",
        ]
        Resource = [
          var.dynamodb_table_arn,
          "${var.dynamodb_table_arn}/index/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
        ]
        Resource = [
          var.sqs_queue_arn,
          var.bulk_sqs_queue_arn,
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
        ]
        Resource = "arn:aws:secretsmanager:*:*:secret:/${var.environment}/tenants/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
        ]
        Resource = "${var.media_bucket_arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
    ]
  })
}

locals {
  lambda_zip_effective = (
    var.lambda_zip_path != "" && fileexists(var.lambda_zip_path)
    ) ? var.lambda_zip_path : "${path.module}/bootstrap/functions.zip"

  functions = {
    webhook = {
      handler     = "webhook/index.handler"
      description = "Receives and validates WhatsApp webhooks from Meta"
      timeout     = 30
      memory      = 256
      environment = {
        WHATSAPP_VERIFY_TOKEN = var.whatsapp_verify_token
        SQS_QUEUE_URL         = var.sqs_queue_url
        TABLE_NAME            = var.dynamodb_table_name
      }
    }
    process_message = {
      handler     = "process-message/index.handler"
      description = "Processes incoming messages via OpenAI and replies on WhatsApp"
      timeout     = 300
      memory      = 512
      environment = {
        TABLE_NAME   = var.dynamodb_table_name
        OPENAI_MODEL = "gpt-4o"
        ENVIRONMENT  = var.environment
      }
    }
    tenants = {
      handler     = "tenants/index.handler"
      description = "CRUD API for tenants management"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    bots = {
      handler     = "bots/index.handler"
      description = "CRUD API for chatbot configurations"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    conversations = {
      handler     = "conversations/index.handler"
      description = "API for reading conversation history"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    templates = {
      handler     = "templates/index.handler"
      description = "CRUD and send WhatsApp message templates"
      timeout     = 30
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    bulk_send = {
      handler     = "bulk-send/index.handler"
      description = "Enqueues bulk template send campaigns"
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME          = var.dynamodb_table_name
        BULK_SQS_QUEUE_URL  = var.bulk_sqs_queue_url
        ENVIRONMENT         = var.environment
      }
    }
    process_bulk_send = {
      handler     = "process-bulk-send/index.handler"
      description = "Processes bulk template send messages from SQS"
      timeout     = 60
      memory      = 256
      environment = {
        TABLE_NAME  = var.dynamodb_table_name
        ENVIRONMENT = var.environment
      }
    }
    authorizer = {
      handler     = "authorizer/index.handler"
      description = "Cognito JWT authorizer for API Gateway"
      timeout     = 10
      memory      = 128
      environment = {
        COGNITO_USER_POOL_ID = var.cognito_user_pool_id
        COGNITO_CLIENT_ID    = var.cognito_client_id
      }
    }
  }
}

resource "aws_lambda_function" "functions" {
  for_each = local.functions

  function_name = "${var.project}-${var.environment}-${replace(each.key, "_", "-")}"
  description   = each.value.description
  role          = aws_iam_role.lambda.arn
  handler       = each.value.handler
  runtime       = "nodejs20.x"
  timeout       = each.value.timeout
  memory_size   = each.value.memory

  filename         = local.lambda_zip_effective
  source_code_hash = filebase64sha256(local.lambda_zip_effective)

  environment {
    variables = each.value.environment
  }

  tags = var.tags
}

resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = var.sqs_queue_arn
  function_name    = aws_lambda_function.functions["process_message"].arn
  batch_size       = 1
  enabled          = true
}

resource "aws_lambda_event_source_mapping" "bulk_sqs_trigger" {
  event_source_arn                   = var.bulk_sqs_queue_arn
  function_name                      = aws_lambda_function.functions["process_bulk_send"].arn
  batch_size                         = 1
  enabled                            = true
  maximum_batching_window_in_seconds = 0
}

resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each          = local.functions
  name              = "/aws/lambda/${var.project}-${var.environment}-${replace(each.key, "_", "-")}"
  retention_in_days = var.environment == "prod" ? 30 : 7
  tags              = var.tags
}
