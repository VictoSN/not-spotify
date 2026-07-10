# Update Google OAuth ClientId + Secret in the live ECS task def and redeploy.
# 1) Paste the client secret below (from Google Console, same client as the ID).
# 2) Run from repo root:  .\backend\update-google-oauth.ps1
# No Docker needed — this reuses the current image and only changes 2 env vars.

$REGION  = "ap-southeast-1"
$CLUSTER = "default"
$SERVICE = "not-spotify-api-f33c"
$FAMILY  = "default-not-spotify-api-f33c"

$ClientId     = "1078819299498-dihhlmqta64o3e6vv7c1ulcdinv67v3f.apps.googleusercontent.com"
$ClientSecret = "PASTE_GOCSPX_SECRET_HERE"

if ($ClientSecret -like "PASTE_*" -or [string]::IsNullOrWhiteSpace($ClientSecret)) {
  Write-Host "ABORT: set `$ClientSecret to the client's GOCSPX- secret first." -ForegroundColor Red; exit 1
}
function Assert-LastExit($step) { if ($LASTEXITCODE -ne 0) { Write-Host "ABORT: $step failed (exit $LASTEXITCODE)." -ForegroundColor Red; exit 1 } }

Write-Host "Cloning live task def..." -ForegroundColor Cyan
$td = (aws ecs describe-task-definition --region $REGION --task-definition $FAMILY --query "taskDefinition" | ConvertFrom-Json)
Assert-LastExit "describe-task-definition"

$envs        = $td.containerDefinitions[0].environment
$idEntry     = $envs | Where-Object { $_.name -eq 'Authentication__Google__ClientId' }
$secretEntry = $envs | Where-Object { $_.name -eq 'Authentication__Google__ClientSecret' }
if (-not $idEntry -or -not $secretEntry) { Write-Host "ABORT: Google env vars not found in task def." -ForegroundColor Red; exit 1 }
$idEntry.value     = $ClientId
$secretEntry.value = $ClientSecret

foreach ($p in @("taskDefinitionArn","revision","status","requiresAttributes","compatibilities","registeredAt","registeredBy","deregisteredAt")) {
  $td.PSObject.Properties.Remove($p) | Out-Null
}
[System.IO.File]::WriteAllText("$PWD\newtd.json", ($td | ConvertTo-Json -Depth 30))   # UTF-8 no BOM

$newArn = (aws ecs register-task-definition --region $REGION --cli-input-json "file://newtd.json" --query "taskDefinition.taskDefinitionArn" --output text)
Assert-LastExit "register-task-definition"
Write-Host "Registered: $newArn"

aws ecs update-service --region $REGION --cluster $CLUSTER --service $SERVICE --task-definition $newArn | Out-Null
Assert-LastExit "update-service"
Remove-Item "$PWD\newtd.json" -ErrorAction SilentlyContinue

Write-Host "Deploy started. Canary bake ~6-10 min (old+new run side by side; not stuck)." -ForegroundColor Green
Write-Host "Check with:  aws ecs describe-services --cluster $CLUSTER --services $SERVICE --region $REGION --query `"services[0].deployments[].{td:taskDefinition,status:status,rollout:rolloutState}`" --output json"
