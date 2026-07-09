# Installer release workflow

The public `/download` page uses a native Windows installer and the installable PWA for macOS, Linux, iOS, and Android. The PWA is intentional on those platforms: it opens in its own window, updates with the deployed frontend, and does not advertise a package that the project does not publish.

## Build and stage the native installer

From `frontend/` on Windows:

```powershell
$env:INSTALLER_S3_BUCKET = "<bucket>"
npm run tauri:build
```

The command builds the production frontend, creates NSIS (`.exe`) and MSI installers, and uploads both versioned public filenames and stable compatibility copies to S3 under `downloads/`. In production, the existing CloudFront/API origin exposes versioned names such as:

```text
https://<api-or-cdn>/downloads/not-spotify_0.7.8_x64-setup.exe
https://<api-or-cdn>/downloads/not-spotify_0.7.8_x64_en-US.msi
```

The legacy stable URLs continue to work for older deployed frontends and external links:

```text
https://<api-or-cdn>/downloads/not-spotify-windows-x64-setup.exe
https://<api-or-cdn>/downloads/not-spotify-windows-x64.msi
```

`VITE_INSTALLER_BASE_URL` can point the frontend at a separate S3/CloudFront distribution. If it is unset, the download page uses `VITE_API_URL`.

## Upload options

The release helper reads these optional environment variables:

- `INSTALLER_S3_BUCKET`: bucket to upload to.
- `INSTALLER_S3_PREFIX`: object prefix, default `downloads`.

Set `VITE_INSTALLER_BASE_URL` to the bucket's CloudFront origin before building the frontend when installers are served outside the API domain. Do not commit AWS credentials or installer binaries.

## Release checks

1. Run `npm test` and `npm run build` in `frontend/`.
2. Open `/download` and verify the EXE and MSI links return a file, not the SPA shell.
3. Run the EXE on a Windows 10/11 x64 machine and launch not-spotify.
4. On macOS/iOS use Safari's **Add to Dock/Home Screen** action; on Android/Linux use Chrome's **Install app** action.
5. Windows SmartScreen may show **Unknown publisher** until the team signs the binaries with a trusted code-signing certificate.
