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

resource "terraform_data" "guards" {
  lifecycle {
    precondition {
      condition     = !var.manage_dns || (var.enable_custom_domain && can(regex("^[0-9a-f]{32}$", var.zone_id)))
      error_message = "manage_dns requires enable_custom_domain and the 32 hex zone_id of an existing zone. DNS stays unmanaged until both are set."
    }

    precondition {
      condition     = !var.attach_www || var.enable_custom_domain
      error_message = "attach_www requires enable_custom_domain."
    }

    precondition {
      condition     = !var.enable_git_source || (var.git_owner != "" && var.git_repo_name != "")
      error_message = "enable_git_source requires git_owner and git_repo_name. It also requires the Cloudflare GitHub App to already be installed; Terraform does not install it."
    }

    precondition {
      condition     = !var.enable_automatic_deployments || var.enable_git_source
      error_message = "enable_automatic_deployments requires enable_git_source. Automatic production and preview builds stay off unless Git source is explicitly enabled."
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

  # Null keeps this a Direct Upload project. Omitting Git avoids automatic
  # deployments and leaves the project able to accept Direct Upload later.
  source = var.enable_git_source ? local.git_source : null

  lifecycle {
    prevent_destroy = true

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
  count = var.manage_dns && var.enable_custom_domain && can(regex("^[0-9a-f]{32}$", var.zone_id)) ? 1 : 0

  zone_id = var.zone_id
  name    = var.domain
  type    = "CNAME"
  content = cloudflare_pages_project.site.subdomain
  proxied = true
  ttl     = 1
  comment = "SDF landing apex. Pages CNAME only."

  depends_on = [cloudflare_pages_domain.apex]

  lifecycle {
    prevent_destroy = true

    postcondition {
      condition     = self.type == "CNAME" && self.proxied && !strcontains(self.name, "*") && endswith(self.content, ".pages.dev")
      error_message = "The apex Pages record must be a proxied, non-wildcard CNAME aimed at pages.dev."
    }
  }
}

resource "cloudflare_dns_record" "www" {
  count = var.manage_dns && var.enable_custom_domain && var.attach_www && can(regex("^[0-9a-f]{32}$", var.zone_id)) ? 1 : 0

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
