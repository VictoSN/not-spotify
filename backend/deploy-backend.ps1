# Deploy NotSpotify API to ECR + ECS.
# Clones the live task definition and swaps ONLY the image (all env vars,
# including the already-correct Stripe price IDs, are preserved).
# Run from the repo root:  .\backend\deploy-backend.ps1
#
# NOTE: we deliberately do NOT set $ErrorActionPreference = "Stop". docker/aws
# write normal progress to stderr, which PowerShell 5.1 would otherwise treat as
# fatal errors and abort the build. We check $LASTEXITCODE explicitly instead.

$REGION  = "ap-southeast-1"
$ACCOUNT = "890606434556"
$REGISTRY = "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
$REPO    = "$REGISTRY/not-spotify-api"
$TAG     = "deploy-" + (Get-Date -Format "yyyyMMdd-HHmmss")
$IMAGE   = "${REPO}:${TAG}"
$CLUSTER = "default"
$SERVICE = "not-spotify-api-f33c"
$FAMILY  = "default-not-spotify-api-f33c"

# Native exes (docker/aws) don't trigger -ErrorAction Stop, so check exit codes.
function Assert-LastExit($step) {
  if ($LASTEXITCODE -ne 0) { Write-Host "ABORT: '$step' failed (exit $LASTEXITCODE). Nothing was deployed." -ForegroundColor Red; exit 1 }
}

Write-Host "== 0/6 check Docker is running ==" -ForegroundColor Cyan
$serverVersion = (docker version --format '{{.Server.Version}}' 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $serverVersion) { Write-Host "ABORT: Docker Desktop engine is not reachable. Start it, wait for 'Engine running', then re-run." -ForegroundColor Red; exit 1 }
Write-Host "Docker engine OK (server $serverVersion)"

Write-Host "== 1/6 ECR login ==" -ForegroundColor Cyan
# Don't pipe `get-login-password | docker login` directly: PowerShell 5.1 re-encodes
# native-to-native pipeline text and mangles the token, so ECR rejects it with a
# 400. Capture the token first, then hand it to docker via -p. It's a short-lived
# ECR token on the user's own machine; clear it right after.
$ecrPassword = (aws ecr get-login-password --region $REGION)
Assert-LastExit "ECR get-login-password"
docker login --username AWS --password $ecrPassword $REGISTRY
Assert-LastExit "ECR login"
$ecrPassword = $null

Write-Host "== 2/6 docker build ==" -ForegroundColor Cyan
docker build -t $IMAGE backend/src/NotSpotify.Api
Assert-LastExit "docker build"

Write-Host "== 3/6 docker push ==" -ForegroundColor Cyan
docker push $IMAGE
Assert-LastExit "docker push"

Write-Host "== 4/6 clone live task def, swap image ==" -ForegroundColor Cyan
$td = (aws ecs describe-task-definition --region $REGION --task-definition $FAMILY --query "taskDefinition" | ConvertFrom-Json)
$td.containerDefinitions[0].image = $IMAGE

# Upsert the Resend API key from the local RESEND_API_KEY env var so the secret
# stays out of git. Once set on the task def, later deploys preserve it (this
# clone carries all existing env vars forward), so you only need it the first time.
if ($env:RESEND_API_KEY) {
  $envList = [System.Collections.Generic.List[object]]::new()
  $found = $false
  foreach ($e in $td.containerDefinitions[0].environment) {
    if ($e.name -eq "Email__Resend__ApiKey") { $e.value = $env:RESEND_API_KEY; $found = $true }
    $envList.Add($e)
  }
  if (-not $found) { $envList.Add([pscustomobject]@{ name = "Email__Resend__ApiKey"; value = $env:RESEND_API_KEY }) }
  $td.containerDefinitions[0].environment = $envList.ToArray()
  Write-Host "Injected Email__Resend__ApiKey into task def." -ForegroundColor Green
} else {
  Write-Host "NOTE: RESEND_API_KEY not set in this shell; task def env preserved as-is." -ForegroundColor Yellow
}

# Chat messages cannot be decrypted if this key is lost or rotated accidentally.
# Supply CHAT_ENCRYPTION_KEY_BASE64 for the first encrypted-chat deployment; once
# present, later task-definition clones preserve ChatEncryption__KeyBase64.
if ($env:CHAT_ENCRYPTION_KEY_BASE64) {
  $envList = [System.Collections.Generic.List[object]]::new()
  $found = $false
  foreach ($e in $td.containerDefinitions[0].environment) {
    if ($e.name -eq "ChatEncryption__KeyBase64") {
      $e.value = $env:CHAT_ENCRYPTION_KEY_BASE64
      $found = $true
    }
    $envList.Add($e)
  }
  if (-not $found) {
    $envList.Add([pscustomobject]@{
      name = "ChatEncryption__KeyBase64"
      value = $env:CHAT_ENCRYPTION_KEY_BASE64
    })
  }
  $td.containerDefinitions[0].environment = $envList.ToArray()
  Write-Host "Injected ChatEncryption__KeyBase64 into task def." -ForegroundColor Green
} elseif (-not ($td.containerDefinitions[0].environment | Where-Object { $_.name -eq "ChatEncryption__KeyBase64" })) {
  Write-Host "ABORT: set CHAT_ENCRYPTION_KEY_BASE64 for the first encrypted-chat deployment." -ForegroundColor Red
  exit 1
}

# Optional one-deployment fallback used to rotate an encryption key without
# making rows written by the old key unreadable. The app rewrites all messages
# with the active key during startup; remove this setting after that rollout.
if ($env:CHAT_ENCRYPTION_PREVIOUS_KEY_BASE64) {
  $envList = [System.Collections.Generic.List[object]]::new()
  $found = $false
  foreach ($e in $td.containerDefinitions[0].environment) {
    if ($e.name -eq "ChatEncryption__PreviousKeyBase64") {
      $e.value = $env:CHAT_ENCRYPTION_PREVIOUS_KEY_BASE64
      $found = $true
    }
    $envList.Add($e)
  }
  if (-not $found) {
    $envList.Add([pscustomobject]@{
      name = "ChatEncryption__PreviousKeyBase64"
      value = $env:CHAT_ENCRYPTION_PREVIOUS_KEY_BASE64
    })
  }
  $td.containerDefinitions[0].environment = $envList.ToArray()
  Write-Host "Injected temporary ChatEncryption__PreviousKeyBase64 into task def." -ForegroundColor Green
}

# Toggle Cors:AllowLocalhostDev so `tauri dev` / Vite dev on localhost:5173 can hit
# the deployed API (see Program.cs). Set CORS_ALLOW_LOCALHOST_DEV=true|false in the
# shell before deploying to flip it; leave it unset to preserve the current value.
if ($env:CORS_ALLOW_LOCALHOST_DEV) {
  $envList = [System.Collections.Generic.List[object]]::new()
  $found = $false
  foreach ($e in $td.containerDefinitions[0].environment) {
    if ($e.name -eq "Cors__AllowLocalhostDev") { $e.value = $env:CORS_ALLOW_LOCALHOST_DEV; $found = $true }
    $envList.Add($e)
  }
  if (-not $found) { $envList.Add([pscustomobject]@{ name = "Cors__AllowLocalhostDev"; value = $env:CORS_ALLOW_LOCALHOST_DEV }) }
  $td.containerDefinitions[0].environment = $envList.ToArray()
  Write-Host "Set Cors__AllowLocalhostDev=$($env:CORS_ALLOW_LOCALHOST_DEV) on task def." -ForegroundColor Green
}

foreach ($p in @("taskDefinitionArn","revision","status","requiresAttributes","compatibilities","registeredAt","registeredBy","deregisteredAt")) {
  $td.PSObject.Properties.Remove($p) | Out-Null
}
$json = $td | ConvertTo-Json -Depth 30
# Write the rendered task definition OUTSIDE the repo. It embeds every task-def
# env var (Stripe secret key, Google OAuth id/secret), so it must never live in
# the working tree where it could be committed. Use a unique temp file and always
# clean it up, even on error.
$tdFile = Join-Path $env:TEMP ("notspotify-td-" + [Guid]::NewGuid().ToString("N") + ".json")
$tdUri  = "file://" + ($tdFile -replace '\\', '/')
try {
  [System.IO.File]::WriteAllText($tdFile, $json)   # UTF-8 without BOM

  Write-Host "== 5/6 register new revision ==" -ForegroundColor Cyan
  $newArn = (aws ecs register-task-definition --region $REGION --cli-input-json $tdUri --query "taskDefinition.taskDefinitionArn" --output text)
  Write-Host "Registered: $newArn"

  Write-Host "== 6/6 update service + wait for stable ==" -ForegroundColor Cyan
  aws ecs update-service --region $REGION --cluster $CLUSTER --service $SERVICE --task-definition $newArn | Out-Null
  aws ecs wait services-stable --region $REGION --cluster $CLUSTER --services $SERVICE
}
finally {
  Remove-Item $tdFile -ErrorAction SilentlyContinue
}
Write-Host "DONE. Backend now running: $IMAGE" -ForegroundColor Green
