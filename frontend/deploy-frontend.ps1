# Build and deploy the SPA to S3 + CloudFront.
# Run from the repo root:  .\frontend\deploy-frontend.ps1
#
# KEEP THIS FILE PURE ASCII (see serverless\deploy-lambda.ps1 for why - a stray em dash
# makes PowerShell 5.1 stop parsing, with errors pointing nowhere near the cause).
#
# The Cache-Control headers below are the whole point of this script. Plain
# `aws s3 sync` sets NO Cache-Control at all, which means:
#   - browsers fall back to heuristic caching (~10% of the file's age), so an old
#     index.html and an old sw.js can be served for hours after a deploy, and
#   - a stale service worker then keeps serving its own cached bundle, so users see
#     old UI no matter how many times they refresh.
# That cost real debugging time on 2026-07-23. Deploy through this script, not by hand.

param(
  [string]$Bucket         = "not-spotify-web-890606434556-ap-southeast-1-an",
  [string]$DistributionId = "E27J84V5MFALHE",
  [string]$SiteUrl        = "https://not-spotify.lol",
  [switch]$SkipBuild
)

function Assert-LastExit($step) {
  if ($LASTEXITCODE -ne 0) {
    Write-Host "ABORT: '$step' failed (exit $LASTEXITCODE)." -ForegroundColor Red
    exit 1
  }
}

$dist = Join-Path $PSScriptRoot "dist"

if (-not $SkipBuild) {
  Write-Host "== 1/4 build ==" -ForegroundColor Cyan
  Push-Location $PSScriptRoot
  npm run build
  $buildExit = $LASTEXITCODE
  Pop-Location
  if ($buildExit -ne 0) { Write-Host "ABORT: build failed." -ForegroundColor Red; exit 1 }
}

if (-not (Test-Path (Join-Path $dist "index.html"))) {
  Write-Host "ABORT: $dist\index.html not found - build first (drop -SkipBuild)." -ForegroundColor Red
  exit 1
}

# Guard against shipping a bundle that lost its env vars. A missing VITE_ value fails
# silently at runtime (the feature just never activates), so check at deploy time.
$bundle = Get-ChildItem (Join-Path $dist "assets") -Filter "index-*.js" | Select-Object -First 1
if ($bundle) {
  $content = Get-Content $bundle.FullName -Raw
  foreach ($marker in @("api.not-spotify.lol", "execute-api")) {
    if ($content -notmatch [regex]::Escape($marker)) {
      Write-Host "WARNING: '$marker' is not in the bundle - check frontend\.env.production" -ForegroundColor Yellow
    }
  }
}

Write-Host "== 2/4 upload hashed assets (immutable) ==" -ForegroundColor Cyan
# Safe to cache forever: every build emits new filenames, so a changed file is never
# served from an old URL.
aws s3 cp (Join-Path $dist "assets") "s3://$Bucket/assets/" --recursive `
  --cache-control "public,max-age=31536000,immutable" | Out-Null
Assert-LastExit "upload assets"

Write-Host "== 3/4 upload entry points (no-cache) ==" -ForegroundColor Cyan
# These keep stable names, so they must be revalidated on every load or a deploy is
# invisible to anyone who already has them cached. `no-cache` still allows a 304 - it
# means "revalidate", not "do not store".
aws s3 cp (Join-Path $dist "index.html") "s3://$Bucket/index.html" `
  --cache-control "no-cache" --content-type "text/html; charset=utf-8" | Out-Null
Assert-LastExit "upload index.html"

aws s3 cp (Join-Path $dist "sw.js") "s3://$Bucket/sw.js" `
  --cache-control "no-cache" --content-type "application/javascript; charset=utf-8" | Out-Null
Assert-LastExit "upload sw.js"

$manifest = Join-Path $dist "manifest.webmanifest"
if (Test-Path $manifest) {
  aws s3 cp $manifest "s3://$Bucket/manifest.webmanifest" `
    --cache-control "no-cache" --content-type "application/manifest+json" | Out-Null
  Assert-LastExit "upload manifest"
}

# Deliberately NOT using `aws s3 sync --delete`: the service worker precaches hashed
# assets, so deleting the previous build's files 404s anyone mid-session. Old assets
# accumulate instead - clear them out manually every so often.

Write-Host "== 4/4 invalidate CloudFront ==" -ForegroundColor Cyan
$invalidationId = (aws cloudfront create-invalidation --distribution-id $DistributionId `
  --paths "/*" --query "Invalidation.Id" --output text)
Assert-LastExit "create-invalidation"
Write-Host "invalidation $invalidationId submitted; waiting ..."
aws cloudfront wait invalidation-completed --distribution-id $DistributionId --id $invalidationId
if ($LASTEXITCODE -ne 0) {
  Write-Host "NOTE: the waiter timed out. The invalidation usually still completes -" -ForegroundColor DarkYellow
  Write-Host "check with: aws cloudfront get-invalidation --distribution-id $DistributionId --id $invalidationId" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "DONE - $SiteUrl is serving $($bundle.Name)" -ForegroundColor Green
Write-Host ""
Write-Host "If someone still sees the old UI after this, their service worker is holding" -ForegroundColor Cyan
Write-Host "the previous bundle. It updates when every tab of the site is closed and" -ForegroundColor Cyan
Write-Host "reopened, or immediately via DevTools > Application > Service Workers >" -ForegroundColor Cyan
Write-Host "Unregister, then reload." -ForegroundColor Cyan
