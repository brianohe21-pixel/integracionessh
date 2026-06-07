locals {
  custom_domain_trimmed = trimspace(var.custom_domain)
  custom_domain_enabled = length(local.custom_domain_trimmed) > 0

  custom_domain_labels = local.custom_domain_enabled ? split(".", local.custom_domain_trimmed) : []
  domain_prefix        = local.custom_domain_enabled ? local.custom_domain_labels[0] : ""
  domain_root          = local.custom_domain_enabled ? join(".", slice(local.custom_domain_labels, 1, length(local.custom_domain_labels))) : ""
}

resource "aws_amplify_domain_association" "frontend" {
  count = local.custom_domain_enabled ? 1 : 0

  app_id      = aws_amplify_app.frontend.id
  domain_name = local.domain_root

  sub_domain {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = local.domain_prefix
  }

  wait_for_verification = false
}
