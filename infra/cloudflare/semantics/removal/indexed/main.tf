# Invalid: Terraform rejects an instance key in removed.from.

terraform {
  required_version = ">= 1.11.0, < 2.0.0"
}

removed {
  from = terraform_data.record[0]

  lifecycle {
    destroy = false
  }
}
