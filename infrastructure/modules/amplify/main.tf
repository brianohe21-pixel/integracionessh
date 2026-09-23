locals {
  api_public_url = trimsuffix(var.api_endpoint, "/")
}

resource "aws_amplify_app" "frontend" {
  name       = "${var.project}-${var.environment}"
  repository = var.repository_url

  access_token         = var.github_access_token
  iam_service_role_arn = aws_iam_role.amplify_service.arn
  platform             = "WEB_COMPUTE"

  build_spec = <<-EOT
    version: 1
    applications:
      - appRoot: frontend
        frontend:
          buildPath: /
          phases:
            preBuild:
              commands:
                - corepack enable
                - corepack prepare pnpm@9.15.9 --activate
                - pnpm install --frozen-lockfile
            build:
              commands:
                - |
                  env | grep '^NEXT_PUBLIC_' > frontend/.env.production || true
                  if grep -q '^NEXT_PUBLIC_WS_URL=' frontend/.env.production; then
                    ws=$(grep '^NEXT_PUBLIC_WS_URL=' frontend/.env.production | cut -d= -f2- | tr -d "'\"")
                    ws=${ws%/}
                    ws=${ws%/\$default}
                    ws=${ws%/$default}
                    if [[ "$ws" == *".execute-api."*".amazonaws.com" ]]; then
                      export NEXT_PUBLIC_WS_URL="${ws}/\$default"
                      grep -v '^NEXT_PUBLIC_WS_URL=' frontend/.env.production > /tmp/next_public_env || true
                      echo "NEXT_PUBLIC_WS_URL='${NEXT_PUBLIC_WS_URL}'" >> /tmp/next_public_env
                      mv /tmp/next_public_env frontend/.env.production
                    fi
                  fi
                  pnpm --filter frontend run build
          artifacts:
            baseDirectory: frontend/.next
            files:
              - '**/*'
          cache:
            paths:
              - frontend/node_modules/**/*
              - frontend/.next/cache/**/*
  EOT

  environment_variables = {
    AMPLIFY_MONOREPO_APP_ROOT                  = "frontend"
    NEXT_PUBLIC_API_URL                        = local.api_public_url
    NEXT_PUBLIC_WS_URL                         = var.websocket_url
    NEXT_PUBLIC_COGNITO_REGION                 = var.aws_region
    NEXT_PUBLIC_USER_POOL_ID                   = var.cognito_user_pool_id
    NEXT_PUBLIC_USER_POOL_CLIENT               = var.cognito_client_id
    NEXT_PUBLIC_COGNITO_DOMAIN                 = var.cognito_hosted_ui_domain
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED            = var.google_auth_enabled ? "true" : "false"
    NEXT_PUBLIC_ENV                            = var.environment
    NEXT_PUBLIC_DEMO_EMAIL                     = var.demo_account_email
    NEXT_PUBLIC_DEMO_PASSWORD                  = var.demo_account_password
    NEXT_PUBLIC_META_APP_ID                    = var.meta_app_id
    NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID = var.meta_embedded_signup_config_id
    NODE_VERSION                               = "20"
  }

  lifecycle {
    ignore_changes = [access_token]
  }

  tags = var.tags
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = var.branch_name

  enable_auto_build = false

  environment_variables = {
    NEXT_PUBLIC_API_URL                        = local.api_public_url
    NEXT_PUBLIC_WS_URL                         = var.websocket_url
    NEXT_PUBLIC_COGNITO_REGION                 = var.aws_region
    NEXT_PUBLIC_USER_POOL_ID                   = var.cognito_user_pool_id
    NEXT_PUBLIC_USER_POOL_CLIENT               = var.cognito_client_id
    NEXT_PUBLIC_COGNITO_DOMAIN                 = var.cognito_hosted_ui_domain
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED            = var.google_auth_enabled ? "true" : "false"
    NEXT_PUBLIC_ENV                            = var.environment
    NEXT_PUBLIC_DEMO_EMAIL                     = var.demo_account_email
    NEXT_PUBLIC_DEMO_PASSWORD                  = var.demo_account_password
    NEXT_PUBLIC_META_APP_ID                    = var.meta_app_id
    NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID = var.meta_embedded_signup_config_id
  }

  tags = var.tags
}
