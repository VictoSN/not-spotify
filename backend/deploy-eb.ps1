# Builds a Beanstalk-ready source bundle for the NotSpotify API (.NET on Linux).
# Run from anywhere:  ./backend/deploy-eb.ps1
# Output: backend/notspotify-backend.zip  -> upload this in the EB "Upload your code" step.

$ErrorActionPreference = 'Stop'
$proj    = Join-Path $PSScriptRoot 'src/NotSpotify.Api'
$publish = Join-Path $proj 'publish'
$zip     = Join-Path $PSScriptRoot 'notspotify-backend.zip'

Write-Host "Publishing (Release)..." -ForegroundColor Cyan
if (Test-Path $publish) { Remove-Item $publish -Recurse -Force }
dotnet publish $proj -c Release -o $publish

# Procfile tells Beanstalk how to start the app; it must sit at the zip root.
Copy-Item (Join-Path $proj 'Procfile') (Join-Path $publish 'Procfile') -Force

Write-Host "Zipping bundle..." -ForegroundColor Cyan
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $publish '*') -DestinationPath $zip

Write-Host "Done -> $zip" -ForegroundColor Green
