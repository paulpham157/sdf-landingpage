# Plans against a mocked provider. The subdomain and zone name below are stubs.
# A passing DNS plan shows that the CNAME content is wired to the project
# subdomain attribute and that the zone precondition accepted the stub.
# It does not show that Cloudflare returned that hostname or that zone.

mock_provider "cloudflare" {
  mock_resource "cloudflare_pages_project" {
    defaults = {
      subdomain = "sdf-landing.pages.dev"
    }
    override_during = plan
  }

  mock_data "cloudflare_zone" {
    defaults = {
      name = "softwaredecisionfabric.tech"
      account = {
        id = "00000000000000000000000000000000"
      }
    }
    override_during = plan
  }
}

variables {
  account_id = "00000000000000000000000000000000"
}

run "default_creates_no_domain_dns_zone_read_or_git" {
  command = plan

  assert {
    condition     = cloudflare_pages_project.site.name == var.project_name && cloudflare_pages_project.site.production_branch == var.production_branch
    error_message = "Project name and production branch must follow the variables."
  }

  assert {
    condition     = cloudflare_pages_project.site.build_config.build_command == "npm run build" && cloudflare_pages_project.site.build_config.destination_dir == "dist"
    error_message = "Build command and dist output must match the Astro site."
  }

  assert {
    condition     = cloudflare_pages_project.site.deployment_configs.production.build_image_major_version == 3 && cloudflare_pages_project.site.deployment_configs.preview.build_image_major_version == 3 && cloudflare_pages_project.site.deployment_configs.production.env_vars["NODE_VERSION"].type == "plain_text" && cloudflare_pages_project.site.deployment_configs.production.env_vars["NODE_VERSION"].value == "22" && cloudflare_pages_project.site.deployment_configs.preview.env_vars["NODE_VERSION"].value == "22" && length(keys(cloudflare_pages_project.site.deployment_configs.production.env_vars)) == 1 && length(keys(cloudflare_pages_project.site.deployment_configs.preview.env_vars)) == 1
    error_message = "Both environments must pin Node 22 as the only plain-text variable, on build image v3."
  }

  assert {
    condition     = cloudflare_pages_project.site.source == null && output.pages_source_mode == "direct_upload" && output.git_source_enabled == false && output.automatic_deployments_enabled == false
    error_message = "The default source mode must be Direct Upload, with no Git source and no automatic builds."
  }

  assert {
    condition     = length(cloudflare_pages_domain.apex) == 0 && length(cloudflare_pages_domain.www) == 0 && length(cloudflare_dns_record.apex) == 0 && length(cloudflare_dns_record.www) == 0 && length(data.cloudflare_zone.dns) == 0 && length(output.managed_dns_types) == 0
    error_message = "The default plan must not attach a domain, write DNS, or read a zone."
  }
}

run "custom_domain_does_not_touch_dns_or_zone" {
  command = plan

  variables {
    enable_custom_domain = true
  }

  assert {
    condition     = length(cloudflare_pages_domain.apex) == 1 && cloudflare_pages_domain.apex[0].name == var.domain && length(cloudflare_pages_domain.www) == 0 && length(cloudflare_dns_record.apex) == 0 && length(data.cloudflare_zone.dns) == 0
    error_message = "Attaching the hostname must not create www, DNS, or a zone read."
  }
}

run "dns_cname_uses_project_subdomain_and_reads_zone" {
  command = plan

  variables {
    enable_custom_domain = true
    manage_dns           = true
    zone_id              = "11111111111111111111111111111111"
  }

  assert {
    condition     = length(data.cloudflare_zone.dns) == 1 && data.cloudflare_zone.dns[0].zone_id == var.zone_id
    error_message = "DNS opt-in must read the supplied zone id and no other zone."
  }

  assert {
    condition     = length(cloudflare_dns_record.apex) == 1 && cloudflare_dns_record.apex[0].type == "CNAME" && cloudflare_dns_record.apex[0].name == var.domain && cloudflare_dns_record.apex[0].proxied && cloudflare_dns_record.apex[0].ttl == 1 && cloudflare_dns_record.apex[0].content == cloudflare_pages_project.site.subdomain && length(cloudflare_dns_record.www) == 0 && toset(output.managed_dns_types) == toset(["CNAME"])
    error_message = "DNS opt-in must be one proxied CNAME whose content is the project subdomain attribute."
  }
}

run "subdomain_hostname_is_allowed_under_the_zone" {
  command = plan

  variables {
    domain               = "docs.softwaredecisionfabric.tech"
    enable_custom_domain = true
    attach_www           = true
    manage_dns           = true
    zone_id              = "11111111111111111111111111111111"
  }

  assert {
    condition     = cloudflare_pages_domain.apex[0].name == var.domain && cloudflare_dns_record.apex[0].name == var.domain && cloudflare_dns_record.www[0].name == "www.${var.domain}" && toset(output.managed_dns_types) == toset(["CNAME"])
    error_message = "A hostname under the zone must be manageable, including www in front of it."
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
    condition     = cloudflare_pages_domain.www[0].name == "www.${var.domain}" && cloudflare_dns_record.www[0].type == "CNAME" && cloudflare_dns_record.www[0].name == "www.${var.domain}" && cloudflare_dns_record.www[0].content == cloudflare_pages_project.site.subdomain && length(output.managed_dns_names) == 2 && toset(output.managed_dns_types) == toset(["CNAME"])
    error_message = "www opt-in must add one proxied CNAME and no other type."
  }
}

run "git_source_on_create_does_not_auto_deploy_or_touch_dns" {
  command = plan

  variables {
    enable_git_source = true
    git_owner         = "paulpham157"
    git_repo_name     = "sdf-landingpage"
  }

  assert {
    condition     = output.pages_source_mode == "github" && cloudflare_pages_project.site.source.type == "github" && cloudflare_pages_project.site.source.config.owner == var.git_owner && cloudflare_pages_project.site.source.config.repo_name == var.git_repo_name
    error_message = "Git mode on a fresh plan must record the repository variables."
  }

  assert {
    condition     = cloudflare_pages_project.site.source.config.production_deployments_enabled == false && cloudflare_pages_project.site.source.config.deployments_enabled == false && cloudflare_pages_project.site.source.config.preview_deployment_setting == "none" && cloudflare_pages_project.site.source.config.pr_comments_enabled == false && output.automatic_deployments_enabled == false && length(cloudflare_pages_domain.apex) == 0 && length(cloudflare_dns_record.apex) == 0
    error_message = "Git mode must not enable builds, attach the production domain, or write DNS."
  }
}

run "automatic_previews_do_not_receive_the_production_domain" {
  command = plan

  variables {
    enable_git_source            = true
    git_owner                    = "paulpham157"
    git_repo_name                = "sdf-landingpage"
    enable_automatic_deployments = true
    enable_custom_domain         = true
  }

  assert {
    condition     = cloudflare_pages_project.site.source.config.preview_deployment_setting == "all" && cloudflare_pages_project.site.source.config.production_deployments_enabled == true && cloudflare_pages_domain.apex[0].name == var.domain && length(cloudflare_dns_record.apex) == 0 && length(keys(cloudflare_pages_project.site.deployment_configs.preview.env_vars)) == 1 && cloudflare_pages_project.site.deployment_configs.preview.env_vars["NODE_VERSION"].type == "plain_text"
    error_message = "Automatic previews must keep the custom domain off pages.dev and must not add preview secrets or DNS."
  }
}

run "unrelated_pages_suffix_remains_valid" {
  command = plan

  variables {
    domain = "pages.dev.example.com"
  }

  assert {
    condition     = var.domain == "pages.dev.example.com" && length(cloudflare_pages_domain.apex) == 0
    error_message = "A hostname that merely contains the pages.dev labels, but is not under pages.dev, must stay valid."
  }
}

run "manage_dns_without_custom_domain_fails" {
  command = plan

  variables {
    manage_dns = true
    zone_id    = "11111111111111111111111111111111"
  }

  expect_failures = [
    terraform_data.dns_requires_domain_and_zone,
  ]
}

run "manage_dns_without_zone_fails" {
  command = plan

  variables {
    enable_custom_domain = true
    manage_dns           = true
  }

  expect_failures = [
    terraform_data.dns_requires_domain_and_zone,
  ]
}

run "git_without_owner_fails" {
  command = plan

  variables {
    enable_git_source = true
    git_repo_name     = "sdf-landingpage"
  }

  expect_failures = [
    terraform_data.git_requires_repository,
  ]
}

run "git_without_repo_fails" {
  command = plan

  variables {
    enable_git_source = true
    git_owner         = "paulpham157"
  }

  expect_failures = [
    terraform_data.git_requires_repository,
  ]
}

run "automatic_deployments_without_git_fail" {
  command = plan

  variables {
    enable_automatic_deployments = true
  }

  expect_failures = [
    terraform_data.automatic_deployments_require_git,
  ]
}

run "www_without_custom_domain_fails" {
  command = plan

  variables {
    attach_www = true
  }

  expect_failures = [
    terraform_data.www_requires_custom_domain,
  ]
}

run "zone_for_a_different_name_is_rejected" {
  command = plan

  variables {
    enable_custom_domain = true
    manage_dns           = true
    zone_id              = "11111111111111111111111111111111"
  }

  override_data {
    target = data.cloudflare_zone.dns[0]
    values = {
      name = "example.com"
      account = {
        id = "00000000000000000000000000000000"
      }
    }
  }

  expect_failures = [
    terraform_data.zone_name_covers_hostnames,
  ]
}

run "zone_in_another_account_is_rejected" {
  command = plan

  variables {
    enable_custom_domain = true
    manage_dns           = true
    zone_id              = "11111111111111111111111111111111"
  }

  override_data {
    target = data.cloudflare_zone.dns[0]
    values = {
      name = "softwaredecisionfabric.tech"
      account = {
        id = "22222222222222222222222222222222"
      }
    }
  }

  expect_failures = [
    terraform_data.zone_account_matches,
  ]
}

run "pages_dev_apex_is_rejected" {
  command = plan

  variables {
    domain = "pages.dev"
  }

  expect_failures = [
    var.domain,
  ]
}

run "pages_dev_subdomain_is_rejected" {
  command = plan

  variables {
    domain = "foo.pages.dev"
  }

  expect_failures = [
    var.domain,
  ]
}

run "pages_dev_is_rejected_regardless_of_case" {
  command = plan

  variables {
    domain = "Foo.PAGES.DEV"
  }

  expect_failures = [
    var.domain,
  ]
}

run "uppercase_domain_is_rejected" {
  command = plan

  variables {
    domain = "SoftwareDecisionFabric.tech"
  }

  expect_failures = [
    var.domain,
  ]
}

run "malformed_domain_is_rejected" {
  command = plan

  variables {
    domain = "not a host"
  }

  expect_failures = [
    var.domain,
  ]
}

run "uppercase_account_id_is_rejected" {
  command = plan

  variables {
    account_id = "0000000000000000000000000000000A"
  }

  expect_failures = [
    var.account_id,
  ]
}

run "uppercase_zone_id_is_rejected" {
  command = plan

  variables {
    zone_id = "1111111111111111111111111111111A"
  }

  expect_failures = [
    var.zone_id,
  ]
}

run "short_zone_id_is_rejected" {
  command = plan

  variables {
    zone_id = "1111111111111111111111111111111"
  }

  expect_failures = [
    var.zone_id,
  ]
}
