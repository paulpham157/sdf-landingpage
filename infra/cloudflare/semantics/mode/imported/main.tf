# Stand-in for a Pages project already in state, with no mode sentinel yet.
# This is not the Cloudflare configuration and does not call a provider.

terraform {
  required_version = ">= 1.11.0, < 2.0.0"
}

variable "recorded_mode" {
  type = string
}

resource "terraform_data" "project" {
  input = var.recorded_mode

  lifecycle {
    prevent_destroy = true
  }
}
