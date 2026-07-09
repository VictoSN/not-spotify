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
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $REGISTRY
Assert-LastExit "ECR login"

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

foreach ($p in @("taskDefinitionArn","revision","status","requiresAttributes","compatibilities","registeredAt","registeredBy","deregisteredAt")) {
  $td.PSObject.Properties.Remove($p) | Out-Null
}
$json = $td | ConvertTo-Json -Depth 30
[System.IO.File]::WriteAllText("$PWD\newtd.json", $json)   # UTF-8 without BOM

Write-Host "== 5/6 register new revision ==" -ForegroundColor Cyan
$newArn = (aws ecs register-task-definition --region $REGION --cli-input-json "file://newtd.json" --query "taskDefinition.taskDefinitionArn" --output text)
Write-Host "Registered: $newArn"

Write-Host "== 6/6 update service + wait for stable ==" -ForegroundColor Cyan
aws ecs update-service --region $REGION --cluster $CLUSTER --service $SERVICE --task-definition $newArn | Out-Null
aws ecs wait services-stable --region $REGION --cluster $CLUSTER --services $SERVICE

Remove-Item "$PWD\newtd.json" -ErrorAction SilentlyContinue
Write-Host "DONE. Backend now running: $IMAGE" -ForegroundColor Green
