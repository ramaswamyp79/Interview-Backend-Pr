param(
  [string]$ProjectId = "gen-lang-client-0149291660",
  [string]$Region = "asia-south1",
  [string]$Service = "interview-backend",
  [string]$Repository = "cloud-run-source-deploy",
  [string]$EnvFile = (Join-Path $PSScriptRoot "..\.env"),
  [string]$Tag = "",
  [string]$ServiceAccount = "assessmart@gen-lang-client-0149291660.iam.gserviceaccount.com",
  [switch]$SkipSecretUpload,
  [switch]$AllowBlankSecrets,
  [switch]$RequireAuthentication,
  [switch]$UseLocalDocker
)

$ErrorActionPreference = "Stop"

$SecretNames = @(
  "JWT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "CLIENT_ORIGIN",
  "GCS_BUCKET",
  "GEMINI_API_KEY",
  "CLOUDCONVERT_API_KEY",
  "SENDGRID_API_KEY",
  "SENDGRID_MAIL_FROM"
)

function Invoke-GCloud {
  param([string[]]$Arguments)

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"

  try {
    $output = & gcloud.cmd @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw ($output -join [Environment]::NewLine)
    }
    return $output
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

function Test-ArtifactRepositoryExists {
  param(
    [string]$Name,
    [string]$Location,
    [string]$ResolvedProjectId
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"

  try {
    & gcloud.cmd artifacts repositories describe $Name `
      --location $Location `
      --project $ResolvedProjectId *> $null
    return $LASTEXITCODE -eq 0
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

function Get-ProjectId {
  param([string]$ExplicitProjectId)

  if ($ExplicitProjectId) {
    return $ExplicitProjectId
  }

  $configuredProject = (Invoke-GCloud -Arguments @("config", "get-value", "project", "--quiet") | Select-Object -First 1).Trim()
  if (-not $configuredProject -or $configuredProject -eq "(unset)") {
    throw "No GCP project configured. Pass -ProjectId or run: gcloud config set project PROJECT_ID"
  }

  return $configuredProject
}

$ProjectId = Get-ProjectId -ExplicitProjectId $ProjectId

if (-not $Tag) {
  $Tag = Get-Date -Format "yyyyMMdd-HHmmss"
}

$Image = "$Region-docker.pkg.dev/$ProjectId/$Repository/$Service`:$Tag"
$SecretRefs = ($SecretNames | ForEach-Object { "$_=$($_):latest" }) -join ","
$AuthFlag = if ($RequireAuthentication) { "--no-allow-unauthenticated" } else { "--allow-unauthenticated" }

Write-Host "Project: $ProjectId"
Write-Host "Region:  $Region"
Write-Host "Service: $Service"
Write-Host "Image:   $Image"

if (-not $SkipSecretUpload) {
  $secretArgs = @{
    ProjectId = $ProjectId
    EnvFile = $EnvFile
    SecretNames = $SecretNames
  }

  if ($AllowBlankSecrets) {
    $secretArgs.AllowBlank = $true
  }

  & (Join-Path $PSScriptRoot "upsert-gcp-secrets.ps1") @secretArgs
}

if (-not (Test-ArtifactRepositoryExists -Name $Repository -Location $Region -ResolvedProjectId $ProjectId)) {
  Write-Host "Creating Artifact Registry repository $Repository"
  Invoke-GCloud -Arguments @(
    "artifacts", "repositories", "create", $Repository,
    "--repository-format", "docker",
    "--location", $Region,
    "--project", $ProjectId,
    "--description", "Cloud Run images"
  ) | Out-Null
}

if ($UseLocalDocker) {
  Write-Host "Configuring Docker auth for Artifact Registry"
  Invoke-GCloud -Arguments @("auth", "configure-docker", "$Region-docker.pkg.dev", "--quiet") | Out-Null

  Write-Host "Building image with local Docker"
  docker build -t $Image .
  if ($LASTEXITCODE -ne 0) {
    throw "docker build failed"
  }

  Write-Host "Pushing image"
  docker push $Image
  if ($LASTEXITCODE -ne 0) {
    throw "docker push failed"
  }
} else {
  Write-Host "Building and pushing image with Google Cloud Build"
  Invoke-GCloud -Arguments @(
    "builds", "submit", ".",
    "--tag", $Image,
    "--project", $ProjectId
  ) | Write-Output
}

$deployArgs = @(
  "run", "deploy", $Service,
  "--image", $Image,
  "--region", $Region,
  "--platform", "managed",
  $AuthFlag,
  "--project", $ProjectId,
  "--set-env-vars", "NODE_ENV=production,JWT_EXPIRES_IN=7d",
  "--set-secrets", $SecretRefs
)

if ($ServiceAccount) {
  $deployArgs += @("--service-account", $ServiceAccount)
}

Write-Host "Deploying Cloud Run service"
Invoke-GCloud -Arguments $deployArgs | Write-Output

Write-Host "Done."
