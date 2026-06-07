param(
  [string]$ProjectId = "gen-lang-client-0149291660",
  [string]$Region = "asia-south1",
  [string]$Service = "interview-backend",
  [string]$EnvFile = (Join-Path $PSScriptRoot "..\.env"),
  [switch]$AllowBlank
)

$ErrorActionPreference = "Stop"

$secretName = "CLIENT_ORIGIN"

$secretArgs = @{
  ProjectId = $ProjectId
  EnvFile = $EnvFile
  SecretNames = @($secretName)
}

if ($AllowBlank) {
  $secretArgs.AllowBlank = $true
}

Write-Host "Uploading $secretName from $EnvFile"
& (Join-Path $PSScriptRoot "upsert-gcp-secrets.ps1") @secretArgs

Write-Host "Updating Cloud Run service $Service to use $secretName`:latest"
gcloud.cmd run services update $Service `
  --project $ProjectId `
  --region $Region `
  --update-secrets "$secretName=$secretName`:latest"

if ($LASTEXITCODE -ne 0) {
  throw "Failed to update Cloud Run service $Service"
}

Write-Host "Done."
