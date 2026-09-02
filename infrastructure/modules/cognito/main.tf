data "aws_region" "current" {}

locals {
  google_enabled = trimspace(var.google_client_id) != "" && trimspace(var.google_client_secret) != ""

  lambda_zip_effective = (
    var.lambda_zip_path != "" && fileexists(var.lambda_zip_path)
  ) ? var.lambda_zip_path : "${path.module}/bootstrap/functions.zip"

  hosted_ui_domain = "${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"

  supported_identity_providers = concat(
    ["COGNITO"],
    local.google_enabled ? ["Google"] : []
  )
}

data "aws_iam_policy_document" "cognito_trigger_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "cognito_trigger" {
  name               = "${var.project}-${var.environment}-cognito-trigger"
  assume_role_policy = data.aws_iam_policy_document.cognito_trigger_assume_role.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "cognito_trigger_basic" {
  role       = aws_iam_role.cognito_trigger.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "cognito_trigger" {
  name = "${var.project}-${var.environment}-cognito-trigger"
  role = aws_iam_role.cognito_trigger.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:ListUsers",
          "cognito-idp:AdminLinkProviderForUser",
          "cognito-idp:AdminUpdateUserAttributes",
        ]
        Resource = aws_cognito_user_pool.main.arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
        ]
        Resource = var.dynamodb_table_arn
      },
    ]
  })
}

resource "aws_lambda_function" "cognito_pre_signup" {
  function_name = "${var.project}-${var.environment}-cognito-pre-signup"
  description   = "Cognito Pre Sign-Up and Post Confirmation triggers for social login"
  role          = aws_iam_role.cognito_trigger.arn
  handler       = "cognito-pre-signup/index.handler"
  runtime       = "nodejs20.x"
  timeout       = 10
  memory_size   = 128

  filename         = local.lambda_zip_effective
  source_code_hash = filebase64sha256(local.lambda_zip_effective)

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash,
    ]
  }

  tags = var.tags
}

resource "aws_lambda_permission" "cognito_pre_signup" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cognito_pre_signup.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

resource "aws_cognito_user_pool" "main" {
  name = "${var.project}-${var.environment}"

  auto_verified_attributes = ["email"]

  username_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  schema {
    name                     = "tenantId"
    attribute_data_type      = "String"
    mutable                  = true
    required                 = false
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 1
      max_length = 128
    }
  }

  schema {
    name                     = "role"
    attribute_data_type      = "String"
    mutable                  = true
    required                 = false
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 1
      max_length = 32
    }
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  lambda_config {
    pre_sign_up       = aws_lambda_function.cognito_pre_signup.arn
    post_confirmation = aws_lambda_function.cognito_pre_signup.arn
  }

  tags = var.tags
}

resource "aws_cognito_identity_provider" "google" {
  count = local.google_enabled ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    authorize_scopes = "email openid profile"
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
  }

  attribute_mapping = {
    email    = "email"
    name     = "name"
    username = "sub"
  }

  lifecycle {
    ignore_changes = [provider_details]
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project}-${var.environment}-web"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
  ]

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  read_attributes = [
    "email",
    "name",
    "custom:tenantId",
    "custom:role",
  ]

  write_attributes = [
    "email",
    "name",
    "custom:tenantId",
    "custom:role",
  ]

  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  lifecycle {
    ignore_changes = [callback_urls, logout_urls]
  }

  allowed_oauth_flows_user_pool_client = length(var.callback_urls) > 0
  allowed_oauth_flows                  = length(var.callback_urls) > 0 ? ["code"] : []
  allowed_oauth_scopes                 = length(var.callback_urls) > 0 ? ["email", "openid", "profile"] : []
  supported_identity_providers         = local.supported_identity_providers

  depends_on = [aws_cognito_identity_provider.google]
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.project}-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id
}
