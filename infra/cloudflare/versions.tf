terraform {
  required_version = ">= 1.11.0, < 2.0.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.28.1"
    }
  }

  # Partial backend. Bucket, key, and endpoints.s3 come from a gitignored
  # backend.hcl (`terraform init -backend-config=backend.hcl`). A
  # -backend-config value overrides the same argument here, including
  # use_lockfile and encrypt. Do not override them.
  #
  # use_lockfile stays on. Terraform 1.17.1 writes <key>.tflock with
  # If-None-Match: *. encrypt is false so the client does not send
  # x-amz-server-side-encryption. R2 encrypts objects at rest without that
  # header, and its PutObject table marks the header unsupported.
  # skip_s3_checksum does not remove the SDK's x-amz-checksum-crc32 header;
  # the shell sets AWS_REQUEST_CHECKSUM_CALCULATION=when_required for that.
  # region "auto" is rejected unless skip_region_validation is true.
  #
  # These flags do not create the bucket and do not enforce the R2 token
  # scope or public access. `terraform init -backend=false` skips backend
  # init. plan and apply then fail with "Backend initialization required"
  # and do not write state.
  # Do not put access keys, tokens, or account ids in this block.
  backend "s3" {
    region                      = "auto"
    use_lockfile                = true
    encrypt                     = false
    use_path_style              = true
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
  }
}

provider "cloudflare" {
  # Reads CLOUDFLARE_API_TOKEN from the environment.
  # There is no token variable, so the token cannot be committed in tfvars
  # or written into the plan as a Terraform variable.
  # This token is not the R2 S3 access key. The backend reads
  # AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY from the environment.
}
