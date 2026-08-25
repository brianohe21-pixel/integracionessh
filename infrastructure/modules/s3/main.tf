resource "aws_s3_bucket" "media" {
  bucket = "${var.project}-${var.environment}-media-${var.account_id}"

  tags = var.tags
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = false
  ignore_public_acls      = true
  restrict_public_buckets = false
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    id     = "expire-knowledge-docs"
    status = "Enabled"

    filter {
      prefix = "tenants/"
    }

    expiration {
      days = 90
    }
  }

  rule {
    id     = "expire-coexistence-webhook-payloads"
    status = "Enabled"

    filter {
      prefix = "coexistence/"
    }

    expiration {
      days = 7
    }
  }
}

resource "aws_s3_bucket_policy" "media_platform_email" {
  bucket = aws_s3_bucket.media.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadPlatformEmailAssets"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.media.arn}/platform/email/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.media]
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT"]
    allowed_origins = var.allowed_origins
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket" "artifacts" {
  bucket = "${var.project}-${var.environment}-artifacts-${var.account_id}"

  tags = var.tags
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
