# Valid forget: the resource block is gone, and from has no instance key.

terraform {
  required_version = ">= 1.11.0, < 2.0.0"
}

removed {
  from = terraform_data.record

  lifecycle {
    destroy = false
  }
}
