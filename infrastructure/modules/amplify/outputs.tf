output "app_id" {
  value = aws_amplify_app.frontend.id
}

output "default_domain" {
  value = aws_amplify_app.frontend.default_domain
}

output "branch_url" {
  value = "https://${var.branch_name}.${aws_amplify_app.frontend.default_domain}"
}

output "custom_domain_url" {
  value       = trimspace(var.custom_domain) != "" ? "https://${trimspace(var.custom_domain)}" : null
  description = "Custom frontend URL when custom_domain is set."
}

output "amplify_domain_dns" {
  value = length(aws_amplify_domain_association.frontend) > 0 ? {
    certificate_verification = aws_amplify_domain_association.frontend[0].certificate_verification_dns_record
    subdomain_records = {
      for s in aws_amplify_domain_association.frontend[0].sub_domain : s.prefix => s.dns_record
    }
  } : null
  description = "Add these CNAME records in Namecheap (Host = prefix, Value = target)."
}

output "amplify_service_role_arn" {
  value = aws_iam_role.amplify_service.arn
}
