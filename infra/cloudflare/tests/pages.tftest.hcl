mock_provider "cloudflare" {
  mock_resource "cloudflare_pages_project" {
    defaults = {
      subdomain = "sdf-landing.pages.dev"
    }
    override_during = plan
  }
}

variables {
  account_id = "00000000000000000000000000000000"
}

run "default_is_pages_project_only" {
  command = plan

  assert {
    condition     = cloudflare_pages_project.site.name == "sdf-landing"
    error_message = "Default project name drifted."
  }

  assert {
    condition     = cloudflare_pages_project.site.production_branch == "main"
    error_message = "Production branch must stay main."
  }

  assert {
    condition     = cloudflare_pages_project.site.build_config.build_command == "npm run build" && cloudflare_pages_project.site.build_config.destination_dir == "dist"
    error_message = "Build command and dist output must match the Astro site."
  }

  assert {
    condition     = cloudflare_pages_project.site.deployment_configs.production.build_image_major_version == 3 && cloudflare_pages_project.site.deployment_configs.preview.build_image_major_version == 3
    error_message = "Build image must be v3."
  }

  assert {
    condition     = cloudflare_pages_project.site.deployment_configs.production.env_vars["NODE_VERSION"].type == "plain_text" && cloudflare_pages_project.site.deployment_configs.production.env_vars["NODE_VERSION"].value == "22" && cloudflare_pages_project.site.deployment_configs.preview.env_vars["NODE_VERSION"].type == "plain_text" && cloudflare_pages_project.site.deployment_configs.preview.env_vars["NODE_VERSION"].value == "22"
    error_message = "Production and preview may only carry the public Node 22 pin."
  }

  assert {
    condition     = length(keys(cloudflare_pages_project.site.deployment_configs.production.env_vars)) == 1 && length(keys(cloudflare_pages_project.site.deployment_configs.preview.env_vars)) == 1
    error_message = "No environment variables besides NODE_VERSION."
  }

  assert {
    condition     = cloudflare_pages_project.site.source == null
    error_message = "Git source must stay off by default so automatic deployments stay off."
  }

  assert {
    condition     = length(cloudflare_pages_domain.apex) == 0 && length(cloudflare_pages_domain.www) == 0
    error_message = "Custom domains must stay off by default."
  }

  assert {
    condition     = length(cloudflare_dns_record.apex) == 0 && length(cloudflare_dns_record.www) == 0 && length(output.managed_dns_types) == 0
    error_message = "DNS records must stay off by default."
  }

  assert {
    condition     = output.git_source_enabled == false && output.automatic_deployments_enabled == false
    error_message = "Git and automatic deployments must report as disabled."
  }
}

run "custom_domain_does_not_touch_dns" {
  command = plan

  variables {
    enable_custom_domain = true
  }

  assert {
    condition     = length(cloudflare_pages_domain.apex) == 1 && cloudflare_pages_domain.apex[0].name == "softwaredecisionfabric.tech" && !endswith(cloudflare_pages_domain.apex[0].name, ".pages.dev")
    error_message = "The only default custom domain is the apex, not a pages.dev preview host."
  }

  assert {
    condition     = length(cloudflare_pages_domain.www) == 0 && length(cloudflare_dns_record.apex) == 0 && length(cloudflare_dns_record.www) == 0
    error_message = "Attaching the apex must not create www or any DNS record."
  }
}

run "dns_is_apex_cname_only" {
  command = plan

  variables {
    enable_custom_domain = true
    manage_dns           = true
    zone_id              = "11111111111111111111111111111111"
  }

  assert {
    condition     = length(cloudflare_dns_record.apex) == 1 && cloudflare_dns_record.apex[0].type == "CNAME" && cloudflare_dns_record.apex[0].name == "softwaredecisionfabric.tech" && cloudflare_dns_record.apex[0].proxied && cloudflare_dns_record.apex[0].ttl == 1 && cloudflare_dns_record.apex[0].content == cloudflare_pages_project.site.subdomain && endswith(cloudflare_dns_record.apex[0].content, ".pages.dev")
    error_message = "Apex DNS must be one proxied CNAME at the apex, aimed at pages.dev."
  }

  assert {
    condition     = length(cloudflare_dns_record.www) == 0 && toset(output.managed_dns_types) == toset(["CNAME"])
    error_message = "Managing DNS without attach_www must not create a www record or any non-CNAME."
  }
}

run "www_opt_in_is_still_cname_only" {
  command = plan

  variables {
    enable_custom_domain = true
    attach_www           = true
    manage_dns           = true
    zone_id              = "11111111111111111111111111111111"
  }

  assert {
    condition     = cloudflare_pages_domain.www[0].name == "www.softwaredecisionfabric.tech" && cloudflare_dns_record.www[0].type == "CNAME" && cloudflare_dns_record.www[0].name == "www.softwaredecisionfabric.tech" && cloudflare_dns_record.www[0].proxied && cloudflare_dns_record.www[0].content == cloudflare_pages_project.site.subdomain && endswith(cloudflare_dns_record.www[0].content, ".pages.dev")
    error_message = "www opt-in must be a proxied CNAME and nothing else."
  }

  assert {
    condition     = toset(output.managed_dns_types) == toset(["CNAME"]) && length(output.managed_dns_names) == 2
    error_message = "www opt-in must still manage exactly two CNAME records."
  }
}

run "git_source_does_not_auto_deploy" {
  command = plan

  variables {
    enable_git_source = true
    git_owner         = "paulpham157"
    git_repo_name     = "sdf-landingpage"
  }

  assert {
    condition     = cloudflare_pages_project.site.source.type == "github" && cloudflare_pages_project.site.source.config.owner == "paulpham157" && cloudflare_pages_project.site.source.config.repo_name == "sdf-landingpage"
    error_message = "Git opt-in must record the GitHub repository."
  }

  assert {
    condition     = cloudflare_pages_project.site.source.config.production_deployments_enabled == false && cloudflare_pages_project.site.source.config.deployments_enabled == false && cloudflare_pages_project.site.source.config.preview_deployment_setting == "none" && cloudflare_pages_project.site.source.config.pr_comments_enabled == false
    error_message = "Git opt-in must not enable production builds, preview builds, or PR comments."
  }

  assert {
    condition     = output.automatic_deployments_enabled == false && length(cloudflare_pages_domain.apex) == 0
    error_message = "Git opt-in must not attach the production domain or enable automatic deployments."
  }
}

run "automatic_previews_stay_off_the_production_domain" {
  command = plan

  variables {
    enable_git_source            = true
    git_owner                    = "paulpham157"
    git_repo_name                = "sdf-landingpage"
    enable_automatic_deployments = true
    enable_custom_domain         = true
  }

  assert {
    condition     = cloudflare_pages_project.site.source.config.preview_deployment_setting == "all" && cloudflare_pages_project.site.source.config.production_deployments_enabled == true
    error_message = "The automatic-deployment opt-in must be explicit in the Git source config."
  }

  assert {
    condition     = cloudflare_pages_domain.apex[0].name == "softwaredecisionfabric.tech" && !endswith(cloudflare_pages_domain.apex[0].name, ".pages.dev") && length(cloudflare_dns_record.apex) == 0
    error_message = "Automatic previews must not retarget the custom domain onto pages.dev or create DNS."
  }

  assert {
    condition     = cloudflare_pages_project.site.deployment_configs.preview.env_vars["NODE_VERSION"].type == "plain_text" && cloudflare_pages_project.site.deployment_configs.preview.env_vars["NODE_VERSION"].value == "22" && length(keys(cloudflare_pages_project.site.deployment_configs.preview.env_vars)) == 1
    error_message = "Preview environment must stay the public Node pin, with no secrets and no production hostname."
  }
}

run "manage_dns_without_custom_domain_fails" {
  command = plan

  variables {
    manage_dns = true
    zone_id    = "11111111111111111111111111111111"
  }

  expect_failures = [
    terraform_data.guards,
  ]
}

run "manage_dns_without_zone_fails" {
  command = plan

  variables {
    enable_custom_domain = true
    manage_dns           = true
  }

  expect_failures = [
    terraform_data.guards,
  ]
}

run "git_without_repository_fails" {
  command = plan

  variables {
    enable_git_source = true
  }

  expect_failures = [
    terraform_data.guards,
  ]
}

run "automatic_deployments_without_git_fail" {
  command = plan

  variables {
    enable_automatic_deployments = true
  }

  expect_failures = [
    terraform_data.guards,
  ]
}

run "www_without_custom_domain_fails" {
  command = plan

  variables {
    attach_www = true
  }

  expect_failures = [
    terraform_data.guards,
  ]
}
