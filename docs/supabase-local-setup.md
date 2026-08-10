# Supabase Local Setup

This branch runs the React frontend and ASP.NET API on localhost while using Supabase for PostgreSQL and media storage.

Supabase is still a hosted service, so the app needs an internet connection to reach the database and storage bucket.

## 1. Create the storage bucket

In the Supabase dashboard:

1. Open **Storage**.
2. Create a bucket named `not-spotify-media`.
3. Make the bucket **Public**.
4. Set the bucket file-size limit to at least 50 MB.

The local branch uses public object URLs so browser audio playback, image loading, and offline caching work without a signed-URL service. Do not use this bucket for sensitive files.

## 2. Save backend secrets

From `backend/src/NotSpotify.Api` in PowerShell:

```powershell
dotnet user-secrets set "ConnectionStrings:Postgres" "Host=<session-pooler-host>;Port=5432;Database=postgres;Username=<session-pooler-user>;Password=<database-password>;SSL Mode=Require;Trust Server Certificate=true"
dotnet user-secrets set "Jwt:SigningKey" "<random-string-at-least-32-characters>"
dotnet user-secrets set "SupabaseStorage:ProjectUrl" "https://msounbcyosxzypmewacy.supabase.co"
dotnet user-secrets set "SupabaseStorage:BucketName" "not-spotify-media"
dotnet user-secrets set "SupabaseStorage:ServiceRoleKey" "sb_secret_your_server_only_key"
```

Open the [Supabase Session pooler connection view](https://supabase.com/dashboard/project/msounbcyosxzypmewacy?showConnect=true&method=session) and copy its exact host and username. Use port `5432`, not the transaction pooler port `6543`. The direct `db.<project-ref>.supabase.co` endpoint may be IPv6-only and fail on an IPv4-only network.

The `sb_secret_...` or legacy `service_role` key is server-only. Never put it in `frontend/.env*`, source control, or browser code. The `sb_publishable_...` key shown in the frontend integration wizard is not a database password and is not used by this backend.

If the database password was not saved, reset it under **Project Settings → Database**.

## 3. Start the app

Trust the local HTTPS certificate once:

```powershell
dotnet dev-certs https --trust
```

Run the full local stack from the repository root:

```powershell
.\dev.cmd
```

The API applies EF migrations and seeds the new Supabase database on startup. It listens at `https://localhost:7045`; Swagger is at `https://localhost:7045/swagger`.

Personal uploads stream through the local API and are written to Supabase Storage. There is no separate upload service.

## 4. Upload frontend assets

The Circular font files and static app assets are not committed. Upload them to Supabase Storage when those files are available:

```powershell
cd backend/src/NotSpotify.Api
dotnet run -- upload-app-assets
```

The frontend reads these files through the local API storage proxy.
