# Counted stand-in. prevent_destroy applies only while this block exists.

terraform {
  required_version = ">= 1.11.0, < 2.0.0"
}

resource "terraform_data" "record" {
  count = 1
  input = "cname"

  lifecycle {
    prevent_destroy = true
  }
}
