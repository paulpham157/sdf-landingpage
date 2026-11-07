output "project_name" {
  description = "Pages project name Terraform owns."
  value       = cloudflare_pages_project.site.name
}

output "production_branch" {
  description = "Branch name Pages treats as production."
  value       = cloudflare_pages_project.site.production_branch
}

output "pages_subdomain" {
  description = "Hostname Cloudflare assigned, such as sdf-landing.pages.dev. Custom-domain CNAMEs target this value."
  value       = cloudflare_pages_project.site.subdomain
}

output "custom_domains" {
  description = "Hostnames attached to the Pages project. Empty unless enable_custom_domain is true."
  value = concat(
    cloudflare_pages_domain.apex[*].name,
    cloudflare_pages_domain.www[*].name,
  )
}

output "managed_dns_names" {
  description = "DNS names this configuration manages. Empty unless manage_dns is true."
  value = concat(
    cloudflare_dns_record.apex[*].name,
    cloudflare_dns_record.www[*].name,
  )
}

output "managed_dns_types" {
  description = "Record types this configuration manages. CNAME only, and empty when DNS is off."
  value = concat(
    cloudflare_dns_record.apex[*].type,
    cloudflare_dns_record.www[*].type,
  )
}

output "pages_source_mode" {
  description = "direct_upload or github. The mode this configuration would send. It is not a lock by itself. A later flip is tied to replacement only after the mode sentinel is already in state with the project."
  value       = local.pages_source_mode
}

output "git_source_enabled" {
  description = "Whether a GitHub repository is attached to the project."
  value       = var.enable_git_source
}

output "automatic_deployments_enabled" {
  description = "Whether pushes trigger Pages production and preview builds."
  value       = var.enable_git_source && var.enable_automatic_deployments
}
