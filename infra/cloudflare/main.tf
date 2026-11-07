locals {
  # Pages build image v3 reads NODE_VERSION. "22" is the major the site requires.
  # plain_text only. Preview gets the same public pin and no other variables.
  pages_env_vars = {
    NODE_VERSION = {
      type  = "plain_text"
      value = "22"
    }
  }

  # v1 build images are retired. v3 is the image whose default Node line is 22.
  deployment_configs = {
    production = {
      build_image_major_version = 3
      env_vars                  = local.pages_env_vars
    }
    preview = {
      build_image_major_version = 3
      env_vars                  = local.pages_env_vars
    }
  }

  # Chosen once, at create. "direct_upload" sends source = null.
  pages_source_mode = var.enable_git_source ? "github" : "direct_upload"

  zone_ready      = var.manage_dns && can(regex("^[0-9a-f]{32}$", var.zone_id))
  zone_name       = local.zone_ready && length(data.cloudflare_zone.dns) == 1 ? lower(trimsuffix(trimspace(data.cloudflare_zone.dns[0].name), ".")) : ""
  zone_account_id = local.zone_ready && length(data.cloudflare_zone.dns) == 1 ? data.cloudflare_zone.dns[0].account.id : ""

  domain_in_zone = local.zone_name != "" && (
    lower(var.domain) == local.zone_name || endswith(lower(var.domain), ".${local.zone_name}")
  )
  www_in_zone = !var.attach_www || (
    local.zone_name != "" && endswith(lower("www.${var.domain}"), ".${local.zone_name}")
  )

  git_source = {
    type = "github"
    config = merge(
      {
        owner                          = var.git_owner
        repo_name                      = var.git_repo_name
        production_branch              = var.production_branch
        pr_comments_enabled            = false
        deployments_enabled            = var.enable_automatic_deployments
        production_deployments_enabled = var.enable_automatic_deployments
        preview_deployment_setting     = var.enable_automatic_deployments ? "all" : "none"
      },
      var.git_owner_id == null ? {} : { owner_id = var.git_owner_id },
      var.git_repo_id == null ? {} : { repo_id = var.git_repo_id },
    )
  }
}

resource "terraform_data" "pages_source_mode" {
  input = local.pages_source_mode
}

resource "terraform_data" "dns_requires_domain_and_zone" {
  lifecycle {
    precondition {
      condition     = !var.manage_dns || (var.enable_custom_domain && can(regex("^[0-9a-f]{32}$", var.zone_id)))
      error_message = "manage_dns requires enable_custom_domain and the 32 hex zone_id of an existing zone. DNS stays unmanaged until both are set."
    }
  }
}

resource "terraform_data" "www_requires_custom_domain" {
  lifecycle {
    precondition {
      condition     = !var.attach_www || var.enable_custom_domain
      error_message = "attach_www requires enable_custom_domain."
    }
  }
}

resource "terraform_data" "git_requires_repository" {
  lifecycle {
    precondition {
      condition     = !var.enable_git_source || (var.git_owner != "" && var.git_repo_name != "")
      error_message = "enable_git_source requires git_owner and git_repo_name. Choose it before the first apply. Terraform does not install the Cloudflare GitHub App."
    }
  }
}

resource "terraform_data" "automatic_deployments_require_git" {
  lifecycle {
    precondition {
      condition     = !var.enable_automatic_deployments || var.enable_git_source
      error_message = "enable_automatic_deployments requires enable_git_source. Automatic production and preview builds stay off unless Git source is explicitly enabled at create."
    }
  }
}

# Read only when DNS is opted in, so a default plan does not call the zone API.
# The precondition rejects a zone whose name does not contain every hostname
# this stack would publish. Tests mock this data source; a live plan reads it.
data "cloudflare_zone" "dns" {
  count = local.zone_ready ? 1 : 0

  zone_id = var.zone_id
}

resource "terraform_data" "zone_name_covers_hostnames" {
  lifecycle {
    precondition {
      condition     = !var.manage_dns || !local.zone_ready || (local.domain_in_zone && local.www_in_zone)
      error_message = "zone_id resolved to a zone that does not contain domain (and www.domain when attach_www is set). Refusing to write DNS in that zone. domain may be the zone name or a subdomain of it."
    }
  }
}

resource "terraform_data" "zone_account_matches" {
  lifecycle {
    precondition {
      condition     = !var.manage_dns || !local.zone_ready || lower(local.zone_account_id) == var.account_id
      error_message = "zone_id is not in account_id. Refusing to write DNS against that zone."
    }
  }
}

resource "cloudflare_pages_project" "site" {
  account_id        = var.account_id
  name              = var.project_name
  production_branch = var.production_branch

  build_config = {
    build_command   = "npm run build"
    destination_dir = "dist"
  }

  deployment_configs = local.deployment_configs

  # Null is Direct Upload. Provider 5.28.1 does not mark source RequiresReplace,
  # so toggling it would otherwise plan an in-place update. replace_triggered_by
  # turns a mode change into replacement, which prevent_destroy rejects.
  # That is a plan safeguard in this configuration. It does not prove the API.
  source = var.enable_git_source ? local.git_source : null

  lifecycle {
    prevent_destroy = true
    replace_triggered_by = [
      terraform_data.pages_source_mode,
    ]

    postcondition {
      condition     = endswith(self.subdomain, ".pages.dev")
      error_message = "Cloudflare did not return a pages.dev subdomain for this project."
    }
  }
}

resource "cloudflare_pages_domain" "apex" {
  count = var.enable_custom_domain ? 1 : 0

  account_id   = var.account_id
  project_name = cloudflare_pages_project.site.name
  name         = var.domain

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_pages_domain" "www" {
  count = var.enable_custom_domain && var.attach_www ? 1 : 0

  account_id   = var.account_id
  project_name = cloudflare_pages_project.site.name
  name         = "www.${var.domain}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_dns_record" "apex" {
  count = local.zone_ready && var.enable_custom_domain ? 1 : 0

  zone_id = var.zone_id
  name    = var.domain
  type    = "CNAME"
  content = cloudflare_pages_project.site.subdomain
  proxied = true
  ttl     = 1
  comment = "SDF landing hostname. Pages CNAME only."

  depends_on = [cloudflare_pages_domain.apex]

  lifecycle {
    prevent_destroy = true

    postcondition {
      condition     = self.type == "CNAME" && self.proxied && !strcontains(self.name, "*") && endswith(self.content, ".pages.dev")
      error_message = "The Pages record must be a proxied, non-wildcard CNAME aimed at pages.dev."
    }
  }
}

resource "cloudflare_dns_record" "www" {
  count = local.zone_ready && var.enable_custom_domain && var.attach_www ? 1 : 0

  zone_id = var.zone_id
  name    = "www.${var.domain}"
  type    = "CNAME"
  content = cloudflare_pages_project.site.subdomain
  proxied = true
  ttl     = 1
  comment = "SDF landing www. Pages CNAME only."

  depends_on = [cloudflare_pages_domain.www]

  lifecycle {
    prevent_destroy = true

    postcondition {
      condition     = self.type == "CNAME" && self.proxied && !strcontains(self.name, "*") && endswith(self.content, ".pages.dev")
      error_message = "The www Pages record must be a proxied, non-wildcard CNAME aimed at pages.dev."
    }
  }
}
