# Deploy the presigned-upload Lambda + its HTTP API Gateway front door.
# Run from the repo root:  .\serverless\deploy-lambda.ps1
#
# Idempotent: every step checks whether the resource already exists and only creates
# what is missing, so re-running it is the normal way to ship a code change.
#   .\serverless\deploy-lambda.ps1 -CodeOnly     # skip all infra, just push new code
#
# KEEP THIS FILE PURE ASCII. PowerShell 5.1 reads a BOM-less UTF-8 .ps1 as CP1252, so a
# stray em dash decodes to a byte that PS treats as a smart QUOTE and the whole script
# stops parsing - with errors pointing a dozen lines away from the real cause.
#
# NOTE: like backend\deploy-backend.ps1 we deliberately do NOT set
# $ErrorActionPreference = "Stop" - the aws CLI writes normal progress to stderr, which
# PowerShell 5.1 would treat as fatal. Exit codes are checked explicitly instead.
#
# IAM WARNING: creating the role/function/API needs provisioning rights. The
# `not-spotify-app` IAM user only has ECR permissions - run the first deploy signed in
# as `not-spotify-admin`, or pass -RoleArn to reuse a role somebody else made.

# The defaults deliberately match the resources created by hand in the console
# (generatePresignedUrl / serverless-upload-api / POST /presign) so this script UPDATES
# them rather than standing up a second copy. Change them only if you want a parallel
# deployment - and remember the account then has two Lambdas writing to the same bucket.
param(
  [string]$Region         = "ap-southeast-1",
  [string]$Bucket         = "not-spotify-media-bucket",
  [string]$FunctionName   = "generatePresignedUrl",
  [string]$ApiName        = "serverless-upload-api",
  [string]$RoleName       = "not-spotify-uploads-lambda-role",
  [string]$RoleArn        = "",
  [string]$AllowedOrigins = "https://not-spotify.lol,https://www.not-spotify.lol,http://localhost:5173",
  [int]$MaxUploadMb       = 100,
  [switch]$CodeOnly
)

$SRC_DIR  = Join-Path $PSScriptRoot "uploads-presign"
$WORK_DIR = Join-Path ([System.IO.Path]::GetTempPath()) "ns-lambda-deploy"
$ZIP_PATH = Join-Path $WORK_DIR "uploads-presign.zip"

function Assert-LastExit($step) {
  if ($LASTEXITCODE -ne 0) {
    Write-Host "ABORT: '$step' failed (exit $LASTEXITCODE)." -ForegroundColor Red
    exit 1
  }
}

# The aws CLI rejects file:// JSON that starts with a UTF-8 BOM, and PowerShell 5.1's
# `Out-File -Encoding utf8` always writes one. Write the bytes ourselves instead.
function Write-JsonFile($name, $json) {
  $path = Join-Path $WORK_DIR $name
  [System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding($false)))
  return $path
}

# `aws ... --query "X | [0]"` prints the literal string "None" (not empty) when nothing
# matches, which is the single easiest way to create a duplicate resource by accident.
function Resolve-AwsValue($value) {
  if ([string]::IsNullOrWhiteSpace($value) -or $value -eq "None") { return $null }
  return $value.Trim()
}

New-Item -ItemType Directory -Force -Path $WORK_DIR | Out-Null

Write-Host "== 0/6 preflight ==" -ForegroundColor Cyan
$account = Resolve-AwsValue (aws sts get-caller-identity --query "Account" --output text)
Assert-LastExit "sts get-caller-identity"
if (-not $account) { Write-Host "ABORT: could not resolve the AWS account id." -ForegroundColor Red; exit 1 }
if (-not (Test-Path (Join-Path $SRC_DIR "lambda_function.py"))) {
  Write-Host "ABORT: $SRC_DIR\lambda_function.py not found." -ForegroundColor Red; exit 1
}
# Without the signing key the function deploys fine and then 401s every single request,
# which is a miserable thing to debug. Fail loudly on the first deploy instead.
if (-not $CodeOnly -and -not $env:JWT_SIGNING_KEY) {
  $deployedKey = Resolve-AwsValue (aws lambda get-function-configuration --region $Region `
    --function-name $FunctionName --query "Environment.Variables.JWT_SIGNING_KEY" --output text 2>$null)
  if (-not $deployedKey) {
    Write-Host "ABORT: `$env:JWT_SIGNING_KEY is not set and none is deployed yet." -ForegroundColor Red
    Write-Host "It must equal the backend's Jwt__SigningKey exactly, or every upload 401s." -ForegroundColor Red
    Write-Host '  $env:JWT_SIGNING_KEY = "<the same value the ECS task def uses>"' -ForegroundColor Yellow
    exit 1
  }
}
aws s3api head-bucket --bucket $Bucket 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "ABORT: bucket '$Bucket' is not reachable with these credentials." -ForegroundColor Red
  exit 1
}
Write-Host "account $account, region $Region, bucket $Bucket"

$functionArn = "arn:aws:lambda:${Region}:${account}:function:$FunctionName"

aws lambda get-function --region $Region --function-name $FunctionName 2>$null | Out-Null
$functionExists = ($LASTEXITCODE -eq 0)

if (-not $CodeOnly) {
  Write-Host "== 1/6 IAM execution role ==" -ForegroundColor Cyan
  if ($functionExists) {
    # The function already has a role (the console named it something like
    # generatePresignedUrl-role-abc123). Creating another one here would leave an unused
    # role lying around and, worse, imply the function is using it. Leave it alone.
    $liveRole = Resolve-AwsValue (aws lambda get-function-configuration --region $Region `
      --function-name $FunctionName --query "Role" --output text)
    Write-Host "function exists; keeping its current role"
    Write-Host "  $liveRole"
    Write-Host "  it needs s3:PutObject on arn:aws:s3:::$Bucket/uploads/* - verify in IAM if uploads 403" -ForegroundColor DarkYellow
  } elseif ($RoleArn) {
    Write-Host "using supplied role $RoleArn"
  } else {
    $RoleArn = Resolve-AwsValue (aws iam get-role --role-name $RoleName --query "Role.Arn" --output text 2>$null)
    if (-not $RoleArn) {
      Write-Host "creating role $RoleName ..."
      $trust = Write-JsonFile "trust.json" (@'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
'@)
      $RoleArn = Resolve-AwsValue (aws iam create-role --role-name $RoleName `
        --assume-role-policy-document "file://$trust" --query "Role.Arn" --output text)
      Assert-LastExit "iam create-role"
      aws iam attach-role-policy --role-name $RoleName `
        --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" | Out-Null
      Assert-LastExit "iam attach-role-policy"
      # Least privilege, and it matters more than usual here: this role's permissions are
      # what a presigned URL inherits. Scoped to PutObject under uploads/ only - no
      # GetObject, no Delete, and nothing outside that prefix, so a bug in the key
      # builder cannot hand out a URL that overwrites catalogue audio or cover art.
      $inline = Write-JsonFile "inline.json" (@"
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject"],
    "Resource": "arn:aws:s3:::$Bucket/uploads/*"
  }]
}
"@)
      aws iam put-role-policy --role-name $RoleName --policy-name "uploads-presign-put" `
        --policy-document "file://$inline" | Out-Null
      Assert-LastExit "iam put-role-policy"
      Write-Host "role created"
    } else {
      Write-Host "role $RoleName already exists"
    }
  }
}

Write-Host "== 2/6 package ==" -ForegroundColor Cyan
# One flat file at the zip root. That is not just tidiness: PowerShell 5.1's
# Compress-Archive writes Windows backslashes into *nested* entry names, which Lambda's
# Linux unpacker then treats as one long filename (the same trap hit during the Elastic
# Beanstalk deploys). No subdirectories here means no way to hit it. The handler needs
# nothing beyond the stdlib and boto3, which the python3.13 runtime already provides -
# the JWT is verified with hmac/hashlib rather than PyJWT precisely to keep it that way.
if (Test-Path $ZIP_PATH) { Remove-Item $ZIP_PATH -Force }
Compress-Archive -Path (Join-Path $SRC_DIR "lambda_function.py") -DestinationPath $ZIP_PATH -Force
if (-not (Test-Path $ZIP_PATH)) { Write-Host "ABORT: packaging failed." -ForegroundColor Red; exit 1 }
Write-Host ("zipped {0:N1} KB" -f ((Get-Item $ZIP_PATH).Length / 1KB))

Write-Host "== 3/6 Lambda function ==" -ForegroundColor Cyan
if ($functionExists) {
  aws lambda update-function-code --region $Region --function-name $FunctionName `
    --zip-file "fileb://$ZIP_PATH" | Out-Null
  Assert-LastExit "lambda update-function-code"
  aws lambda wait function-updated --region $Region --function-name $FunctionName
  Assert-LastExit "lambda wait function-updated"
  Write-Host "code updated"
} else {
  if ($CodeOnly) {
    Write-Host "ABORT: -CodeOnly was passed but $FunctionName does not exist yet." -ForegroundColor Red
    exit 1
  }
  # A freshly created IAM role is not yet visible to Lambda's assume-role check, and the
  # failure ("The role defined for the function cannot be assumed by Lambda") is
  # transient. Retry rather than guessing a sleep long enough to cover it.
  $created = $false
  for ($i = 1; $i -le 6; $i++) {
    aws lambda create-function --region $Region --function-name $FunctionName `
      --runtime python3.13 --handler lambda_function.handler --role $RoleArn `
      --zip-file "fileb://$ZIP_PATH" --timeout 10 --memory-size 256 `
      --description "Not Spotify presigned S3 upload URLs" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $created = $true; break }
    Write-Host "  role not propagated yet, retry $i/6 ..." -ForegroundColor DarkYellow
    Start-Sleep -Seconds 5
  }
  if (-not $created) { Write-Host "ABORT: lambda create-function failed." -ForegroundColor Red; exit 1 }
  aws lambda wait function-active --region $Region --function-name $FunctionName
  Assert-LastExit "lambda wait function-active"
  Write-Host "function created"
}

if (-not $CodeOnly) {
  Write-Host "== 4/6 environment ==" -ForegroundColor Cyan
  # The signing key stays out of git: it is read from your shell, and Lambda keeps
  # whatever was set last, so you only re-export it when it changes.
  # BUCKET_NAME and URL_TTL_SECONDS keep the names the console version used, so the
  # deployed configuration carries over. Note update-function-configuration REPLACES the
  # whole environment map - anything not listed here is dropped.
  $vars = [ordered]@{
    BUCKET_NAME      = $Bucket
    MEDIA_REGION     = $Region
    URL_TTL_SECONDS  = "900"
    JWT_ISSUER       = "not-spotify"
    JWT_AUDIENCE     = "not-spotify-frontend"
    MAX_UPLOAD_BYTES = ($MaxUploadMb * 1024 * 1024).ToString()
  }
  $existing = (aws lambda get-function-configuration --region $Region --function-name $FunctionName `
    --query "Environment.Variables" --output json | ConvertFrom-Json)
  if ($env:JWT_SIGNING_KEY) {
    $vars["JWT_SIGNING_KEY"] = $env:JWT_SIGNING_KEY
  } elseif ($existing -and $existing.PSObject.Properties.Name -contains "JWT_SIGNING_KEY") {
    $vars["JWT_SIGNING_KEY"] = $existing.JWT_SIGNING_KEY   # preserve what is already deployed
  }
  $envJson = Write-JsonFile "env.json" (@{ Variables = $vars } | ConvertTo-Json -Compress -Depth 3)
  aws lambda update-function-configuration --region $Region --function-name $FunctionName `
    --environment "file://$envJson" | Out-Null
  Assert-LastExit "lambda update-function-configuration"
  aws lambda wait function-updated --region $Region --function-name $FunctionName
  Assert-LastExit "lambda wait function-updated"
  Write-Host ("env set: {0}" -f (($vars.Keys | Where-Object { $_ -ne "JWT_SIGNING_KEY" }) -join ", ") + ", JWT_SIGNING_KEY (hidden)")

  Write-Host "== 5/6 HTTP API Gateway ==" -ForegroundColor Cyan
  $apiId = Resolve-AwsValue (aws apigatewayv2 get-apis --region $Region `
    --query "Items[?Name=='$ApiName'].ApiId | [0]" --output text)
  Assert-LastExit "apigatewayv2 get-apis"

  # CORS is owned by the gateway, not the handler. If both emitted Access-Control-*
  # headers the browser would see duplicates and block the response; the gateway also
  # answers the OPTIONS preflight itself, so no extra route or Lambda call is needed.
  # NOTE this covers the /uploads/presign call ONLY. The file upload itself goes
  # straight to S3, which is governed by the BUCKET's CORS config - maintained by
  # S3StorageService.EnsureBrowserCorsAsync (`dotnet run -- ensure-s3-cors`).
  $originList = @($AllowedOrigins.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  if ($originList.Count -eq 0) { Write-Host "ABORT: -AllowedOrigins is empty." -ForegroundColor Red; exit 1 }
  # Built by hand because ConvertTo-Json unwraps a one-element array into a bare string,
  # which would make a single-origin deploy emit invalid CORS config.
  $originsJson = "[" + (($originList | ForEach-Object { $_ | ConvertTo-Json -Compress }) -join ",") + "]"
  $cors = Write-JsonFile "cors.json" (@"
{
  "AllowOrigins": $originsJson,
  "AllowMethods": ["GET","POST","OPTIONS"],
  "AllowHeaders": ["content-type","authorization"],
  "MaxAge": 300
}
"@)

  if (-not $apiId) {
    $apiId = Resolve-AwsValue (aws apigatewayv2 create-api --region $Region --name $ApiName `
      --protocol-type HTTP --cors-configuration "file://$cors" --query "ApiId" --output text)
    Assert-LastExit "apigatewayv2 create-api"
    Write-Host "api created ($apiId)"
  } else {
    aws apigatewayv2 update-api --region $Region --api-id $apiId --cors-configuration "file://$cors" | Out-Null
    Assert-LastExit "apigatewayv2 update-api"
    Write-Host "api $apiId already exists (CORS refreshed)"
  }

  $integrationId = Resolve-AwsValue (aws apigatewayv2 get-integrations --region $Region --api-id $apiId `
    --query "Items[?IntegrationUri=='$functionArn'].IntegrationId | [0]" --output text)
  if (-not $integrationId) {
    $integrationId = Resolve-AwsValue (aws apigatewayv2 create-integration --region $Region --api-id $apiId `
      --integration-type AWS_PROXY --integration-uri $functionArn --integration-method POST `
      --payload-format-version "2.0" --query "IntegrationId" --output text)
    Assert-LastExit "apigatewayv2 create-integration"
    Write-Host "integration created ($integrationId)"
  }

  $existingRoutes = (aws apigatewayv2 get-routes --region $Region --api-id $apiId `
    --query "Items[].RouteKey" --output json | ConvertFrom-Json)
  foreach ($routeKey in @("GET /health", "POST /presign")) {
    if ($existingRoutes -contains $routeKey) {
      Write-Host "  route ok: $routeKey"
    } else {
      aws apigatewayv2 create-route --region $Region --api-id $apiId `
        --route-key $routeKey --target "integrations/$integrationId" | Out-Null
      Assert-LastExit "apigatewayv2 create-route '$routeKey'"
      Write-Host "  route added: $routeKey" -ForegroundColor Green
    }
  }

  # '$default' is single-quoted everywhere on purpose: PowerShell would expand "$default"
  # to an empty string and silently create a stage literally named "".
  $stage = Resolve-AwsValue (aws apigatewayv2 get-stages --region $Region --api-id $apiId `
    --query "Items[?StageName=='`$default'].StageName | [0]" --output text)
  if (-not $stage) {
    # The route is authenticated, but throttling still bounds how fast a valid token can
    # mint URLs, which is the thing worth rate-limiting here.
    aws apigatewayv2 create-stage --region $Region --api-id $apiId --stage-name '$default' `
      --auto-deploy --default-route-settings "ThrottlingBurstLimit=20,ThrottlingRateLimit=10" | Out-Null
    Assert-LastExit "apigatewayv2 create-stage"
    Write-Host "stage `$default created (auto-deploy, 10 rps / burst 20)"
  } else {
    Write-Host "stage `$default already exists"
  }

  Write-Host "== 6/6 invoke permission ==" -ForegroundColor Cyan
  # Without this the gateway gets a 500 on every call: routes alone do not grant invoke.
  aws lambda add-permission --region $Region --function-name $FunctionName `
    --statement-id "apigw-$apiId" --action "lambda:InvokeFunction" `
    --principal apigateway.amazonaws.com `
    --source-arn "arn:aws:execute-api:${Region}:${account}:$apiId/*/*" 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Host "permission granted" } else { Write-Host "permission already present" }

  $endpoint = Resolve-AwsValue (aws apigatewayv2 get-api --region $Region --api-id $apiId `
    --query "ApiEndpoint" --output text)
  Write-Host ""
  Write-Host "DONE - endpoint: $endpoint" -ForegroundColor Green
  Write-Host "Health check:  curl $endpoint/health"
  Write-Host ""
  Write-Host "Put this in frontend\.env.production (and .env.development) then rebuild the SPA:" -ForegroundColor Cyan
  Write-Host "  VITE_UPLOADS_API_URL=$endpoint"
  Write-Host ""
  Write-Host "NOTE: this updated the EXISTING generatePresignedUrl function. Its runtime and" -ForegroundColor Cyan
  Write-Host "execution role are whatever the console set - only the code and environment" -ForegroundColor Cyan
  Write-Host "changed. The response is now a presigned POST policy, not a single uploadUrl." -ForegroundColor Cyan
  Write-Host ""
  Write-Host "REMINDER: the browser POSTs the file to S3 directly, so the BUCKET needs POST" -ForegroundColor Yellow
  Write-Host "in its CORS rules. Apply it with:  dotnet run -- ensure-s3-cors" -ForegroundColor Yellow
  Write-Host "(that command REPLACES the whole bucket CORS config, so any rule added by hand" -ForegroundColor Yellow
  Write-Host "in the console is lost - keep the rules in EnsureBrowserCorsAsync instead.)" -ForegroundColor Yellow
} else {
  Write-Host ""
  Write-Host "DONE - code updated (infra untouched)." -ForegroundColor Green
}
