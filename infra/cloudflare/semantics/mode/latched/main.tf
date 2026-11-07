# Same stand-in after the sentinel exists. replace_triggered_by follows
# Terraform's rule: Update or Replace of the sentinel, not its first Create.

terraform {
  required_version = ">= 1.11.0, < 2.0.0"
}

variable "recorded_mode" {
  type = string
}

resource "terraform_data" "mode_sentinel" {
  input = var.recorded_mode
}

resource "terraform_data" "project" {
  input = var.recorded_mode

  lifecycle {
    prevent_destroy = true
    replace_triggered_by = [
      terraform_data.mode_sentinel,
    ]
  }
}
