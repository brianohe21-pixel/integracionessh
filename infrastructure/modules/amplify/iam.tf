data "aws_iam_policy_document" "amplify_assume" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["amplify.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "amplify_service" {
  name               = "${var.project}-${var.environment}-amplify-svc"
  assume_role_policy = data.aws_iam_policy_document.amplify_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "amplify_console_access" {
  role       = aws_iam_role.amplify_service.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess-Amplify"
}
