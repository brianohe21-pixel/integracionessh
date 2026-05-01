locals {
  api_public_url = trimsuffix(var.api_endpoint, "/")
}

resource "aws_amplify_app" "frontend" {
  name       = "${var.project}-${var.environment}"
  repository = var.repository_url

  access_token = var.github_access_token
  platform     = "WEB_COMPUTE"

  build_spec = <<-EOT
    version: 1
    applications:
      - appRoot: frontend
        frontend:
          buildPath: /
          phases:
            preBuild:
              commands:
                - cd frontend && npm ci
            build:
              commands:
                - cd frontend && npm run build
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
    AMPLIFY_MONOREPO_APP_ROOT    = "frontend"
    NEXT_PUBLIC_API_URL          = local.api_public_url
    NEXT_PUBLIC_COGNITO_REGION   = var.aws_region
    NEXT_PUBLIC_USER_POOL_ID     = var.cognito_user_pool_id
    NEXT_PUBLIC_USER_POOL_CLIENT = var.cognito_client_id
    NEXT_PUBLIC_ENV              = var.environment
    NODE_VERSION                 = "20"
  }

  tags = var.tags
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = var.branch_name

  enable_auto_build = true

  environment_variables = {
    NEXT_PUBLIC_ENV = var.environment
  }

  tags = var.tags
}
