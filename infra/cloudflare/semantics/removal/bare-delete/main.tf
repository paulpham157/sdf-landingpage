# The resource block is gone and there is no removed block.
# prevent_destroy left with the block, so Terraform can plan a real destroy.

terraform {
  required_version = ">= 1.11.0, < 2.0.0"
}
