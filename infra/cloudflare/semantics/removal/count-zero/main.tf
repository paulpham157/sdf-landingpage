# Invalid: count = 0 still declares the resource, so removed cannot target it.

terraform {
  required_version = ">= 1.11.0, < 2.0.0"
}

resource "terraform_data" "record" {
  count = 0
  input = "cname"

  lifecycle {
    prevent_destroy = true
  }
}

removed {
  from = terraform_data.record

  lifecycle {
    destroy = false
  }
}
