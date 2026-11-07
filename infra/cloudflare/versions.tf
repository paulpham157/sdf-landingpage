terraform {
  required_version = ">= 1.11.0, < 2.0.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.28.1"
    }
  }

  # Partial backend. Bucket, key, and region come from a gitignored
  # backend.hcl via `terraform init -backend-config=backend.hcl`.
  # `terraform init -backend=false` skips this for fmt/validate/test.
  # Do not put access keys, tokens, or account ids in this block.
  backend "s3" {}
}

provider "cloudflare" {
  # Reads CLOUDFLARE_API_TOKEN from the environment.
  # There is no token variable, so the token cannot be committed in tfvars
  # or written into the plan as a Terraform variable.
}
