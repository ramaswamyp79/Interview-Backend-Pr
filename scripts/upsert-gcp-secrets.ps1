param(
  [string]$ProjectId = "",
  [string]$EnvFile = (Join-Path $PSScriptRoot "..\.env"),
  [string[]]$SecretNames = @(
    "JWT_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "CLIENT_ORIGIN",
    "GCS_BUCKET",
    "GEMINI_API_KEY",
    "CLOUDCONVERT_API_KEY",
    "SENDGRID_API_KEY",
    "SENDGRID_MAIL_FROM"
  ),
  [switch]$AllowBlank
)

$ErrorActionPreference = "Stop"

function Read-DotEnv {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Env file not found: $Path"
  }

  $values = @{}

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()

    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $match = [regex]::Match($trimmed, "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$")
    if (-not $match.Success) {
      continue
    }

    $name = $match.Groups[1].Value
    $value = $match.Groups[2].Value.Trim()

    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $values[$name] = $value
  }

  return $values
}

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

function Test-SecretExists {
  param(
    [string]$Name,
    [string[]]$ProjectArgs
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"

  try {
    & gcloud.cmd secrets describe $Name @ProjectArgs *> $null
    return $LASTEXITCODE -eq 0
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

$envValues = Read-DotEnv -Path $EnvFile
$projectArgs = @()

if ($ProjectId) {
  $projectArgs = @("--project", $ProjectId)
}

foreach ($name in $SecretNames) {
  if (-not $envValues.ContainsKey($name)) {
    Write-Warning "Skipping $name because it is not present in $EnvFile"
    continue
  }

  $value = [string]$envValues[$name]
  if (-not $AllowBlank -and [string]::IsNullOrWhiteSpace($value)) {
    Write-Warning "Skipping $name because it is blank. Pass -AllowBlank to upload blank values."
    continue
  }

  if (-not (Test-SecretExists -Name $name -ProjectArgs $projectArgs)) {
    Write-Host "Creating secret $name"
    Invoke-GCloud -Arguments (@("secrets", "create", $name, "--replication-policy", "automatic") + $projectArgs) | Out-Null
  } else {
    Write-Host "Secret $name exists"
  }

  Write-Host "Adding new latest version for $name"
  $tempFile = [System.IO.Path]::GetTempFileName()

  try {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($tempFile, $value, $utf8NoBom)

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & gcloud.cmd secrets versions add $name --data-file=$tempFile @projectArgs
    $ErrorActionPreference = $previousErrorActionPreference

    if ($LASTEXITCODE -ne 0) {
      throw "Failed to add secret version for $name"
    }
  } finally {
    if ($previousErrorActionPreference) {
      $ErrorActionPreference = $previousErrorActionPreference
    }
    Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Done."
