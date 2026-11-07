terraform {
  required_version = ">= 1.11.0, < 2.0.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.28.1"
    }
  }

  # Bucket, key, and region come from a gitignored backend.hcl
  # (`terraform init -backend-config=backend.hcl`). A -backend-config value
  # overrides the same argument here, including encrypt and use_lockfile.
  # Those two flags do not create the bucket and do not enforce IAM,
  # versioning, Block Public Access, or bucket-default encryption.
  # `terraform init -backend=false` skips backend init. plan and apply then
  # fail with "Backend initialization required" and do not write state.
  # Do not put access keys, tokens, or account ids in this block.
  backend "s3" {
    encrypt      = true
    use_lockfile = true
  }
}

provider "cloudflare" {
  # Reads CLOUDFLARE_API_TOKEN from the environment.
  # There is no token variable, so the token cannot be committed in tfvars
  # or written into the plan as a Terraform variable.
}
