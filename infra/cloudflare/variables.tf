variable "account_id" {
  description = "Cloudflare account id that will own the Pages project. 32 hex characters. Not a secret, but do not invent one; copy it from the dashboard."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{32}$", var.account_id))
    error_message = "account_id must be a 32 character lowercase hex Cloudflare account id."
  }
}

variable "project_name" {
  description = "Pages project name. Unique in the account. Lowercase letters, digits, and hyphens."
  type        = string
  default     = "sdf-landing"

  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$", var.project_name))
    error_message = "project_name must start with a letter or digit and contain only lowercase letters, digits, and hyphens."
  }
}

variable "production_branch" {
  description = "Git branch Pages treats as production. Direct Upload uses this name to decide which upload is production."
  type        = string
  default     = "main"

  validation {
    condition     = can(regex("^[A-Za-z0-9._/-]+$", var.production_branch))
    error_message = "production_branch must be a non-empty branch name."
  }
}

variable "domain" {
  description = "Apex hostname for the site. Used only when enable_custom_domain is true. This stack does not create the zone."
  type        = string
  default     = "softwaredecisionfabric.tech"

  validation {
    condition     = can(regex("^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,}$", var.domain))
    error_message = "domain must be a lowercase DNS hostname such as softwaredecisionfabric.tech."
  }
}

variable "enable_custom_domain" {
  description = "Attach the apex hostname to the Pages project. Off by default. Does not create or modify DNS."
  type        = bool
  default     = false
}

variable "attach_www" {
  description = "Also attach www.<domain> to the Pages project. Requires enable_custom_domain. Does not create a redirect ruleset."
  type        = bool
  default     = false
}

variable "manage_dns" {
  description = "Create proxied CNAME records for the attached Pages hostnames only. Requires enable_custom_domain and zone_id. Does not create MX, TXT, CAA, or wildcard records and does not adopt the zone."
  type        = bool
  default     = false
}

variable "zone_id" {
  description = "Id of the existing Cloudflare zone for domain. Required only when manage_dns is true. This stack never creates a zone."
  type        = string
  default     = ""

  validation {
    condition     = var.zone_id == "" || can(regex("^[0-9a-f]{32}$", var.zone_id))
    error_message = "zone_id must be empty or the 32 character lowercase hex id of an existing zone."
  }
}

variable "enable_git_source" {
  description = "Attach a GitHub repository to the Pages project. Off by default. Requires the Cloudflare Workers & Pages GitHub App to already be installed. Attaching Git means this project cannot later be switched to Direct Upload."
  type        = bool
  default     = false
}

variable "git_owner" {
  description = "GitHub account or organization that owns the repository. Required when enable_git_source is true."
  type        = string
  default     = ""

  validation {
    condition     = var.git_owner == "" || can(regex("^[A-Za-z0-9_.-]+$", var.git_owner))
    error_message = "git_owner must be empty or a GitHub user or organization name."
  }
}

variable "git_repo_name" {
  description = "GitHub repository name, without the owner. Required when enable_git_source is true."
  type        = string
  default     = ""

  validation {
    condition     = var.git_repo_name == "" || can(regex("^[A-Za-z0-9_.-]+$", var.git_repo_name))
    error_message = "git_repo_name must be empty or a GitHub repository name."
  }
}

variable "git_owner_id" {
  description = "Optional numeric GitHub owner id from the installed Cloudflare GitHub App. Leave null; do not invent it."
  type        = string
  default     = null

  validation {
    condition     = var.git_owner_id == null || can(regex("^[0-9]+$", var.git_owner_id))
    error_message = "git_owner_id must be null or a numeric id."
  }
}

variable "git_repo_id" {
  description = "Optional numeric GitHub repository id from the installed Cloudflare GitHub App. Leave null; do not invent it."
  type        = string
  default     = null

  validation {
    condition     = var.git_repo_id == null || can(regex("^[0-9]+$", var.git_repo_id))
    error_message = "git_repo_id must be null or a numeric id."
  }
}

variable "enable_automatic_deployments" {
  description = "When Git source is enabled, also build on push to the production branch and on other branches. Off by default, including when Git source is enabled. Preview deployments still use *.pages.dev and do not receive this project's custom domains."
  type        = bool
  default     = false
}
