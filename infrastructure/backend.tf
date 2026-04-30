terraform {
  backend "s3" {
    bucket       = "chatbot-platform-tfstate-979054355542"
    key          = "terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
