# Installer release workflow

The public `/download` page uses a native Windows installer and the installable PWA for macOS, Linux, iOS, and Android. The PWA is intentional on those platforms: it opens in its own window, updates with the deployed frontend, and does not advertise a package that the project does not publish.

## Build and stage the native installer

From `frontend/` on Windows:

```powershell
npm run tauri:build
```

The command builds the production frontend, creates NSIS (`.exe`) and MSI installers, and stages stable copies in:

```text
backend/src/NotSpotify.Api/wwwroot/downloads/
```

The backend publishes `wwwroot` automatically. Its static-file middleware serves installer extensions as attachments with CDN-friendly cache headers. In production, the existing CloudFront API origin therefore exposes:

```text
https://<api-or-cdn>/downloads/not-spotify-windows-x64-setup.exe
https://<api-or-cdn>/downloads/not-spotify-windows-x64.msi
```

`VITE_INSTALLER_BASE_URL` can point the frontend at a separate S3/CloudFront distribution. If it is unset, the download page uses `VITE_API_URL`.

## Optional separate S3 upload

After building, teams that keep release artifacts in a dedicated bucket can sync the staged directory with their normal deployment credentials:

```powershell
aws s3 sync ..\backend\src\NotSpotify.Api\wwwroot\downloads s3://<bucket>/downloads --cache-control "public,max-age=86400" --content-disposition "attachment"
```

Set `VITE_INSTALLER_BASE_URL` to that bucket's CloudFront origin before building the frontend. Do not commit AWS credentials.

## Release checks

1. Run `npm test` and `npm run build` in `frontend/`.
2. Open `/download` and verify the EXE and MSI links return a file, not the SPA shell.
3. Run the EXE on a Windows 10/11 x64 machine and launch not-spotify.
4. On macOS/iOS use Safari's **Add to Dock/Home Screen** action; on Android/Linux use Chrome's **Install app** action.
5. Windows SmartScreen may show **Unknown publisher** until the team signs the binaries with a trusted code-signing certificate.
