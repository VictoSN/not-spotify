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

Write-Host "Zipping bundle (forward-slash paths for Linux)..." -ForegroundColor Cyan
# NOTE: Do NOT use Compress-Archive here. Windows PowerShell 5.1 writes ZIP
# entries with backslash path separators, which Amazon Linux's `unzip` rejects
# ("appears to use backslashes as path separators" -> deployment fails). Build
# the archive manually so every entry name uses '/'.
if (Test-Path $zip) { Remove-Item $zip -Force }
Add-Type -AssemblyName System.IO.Compression | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
$publishFull = (Resolve-Path $publish).Path.TrimEnd('\')
$fs = [System.IO.File]::Open($zip, [System.IO.FileMode]::CreateNew)
$archive = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    Get-ChildItem -Path $publish -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($publishFull.Length + 1).Replace('\', '/')
        $entry = $archive.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
        $entryStream.Write($bytes, 0, $bytes.Length)
        $entryStream.Dispose()
    }
} finally {
    $archive.Dispose()
    $fs.Dispose()
}

Write-Host "Done -> $zip" -ForegroundColor Green
