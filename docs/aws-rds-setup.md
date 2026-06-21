# AWS RDS (PostgreSQL) Setup & Migration Runbook

Move the **database** off Supabase Postgres to **Amazon RDS for PostgreSQL**. Pairs with [`aws-s3-setup.md`](aws-s3-setup.md) (storage) — together they put the whole app on AWS.

**No code changes needed** — the app reads `ConnectionStrings:Postgres` from user-secrets, so this is provisioning + a connection-string swap. And unlike the S3 keys, **RDS uses its own database username/password that does *not* rotate** with the Academy session — so teammates set the connection string **once**.

> ⚠️ **Don't delete your Supabase project.** It's free and always-on — keep it as a fallback (see "Account budget & switching" at the bottom). Pointing the app at RDS is all you need; tearing Supabase down buys you nothing and removes your safety net.

---

## 1. Create the RDS instance

1. AWS Console (Learner Lab → `us-east-1`) → **RDS** → **Create database**.
2. **Standard create** → Engine **PostgreSQL**.
3. **Templates**: Free tier (if shown) or Dev/Test.
4. **DB instance identifier**: `not-spotify-db`.
5. **Master username**: `postgres`. **Master password**: set a strong one — **write it down** (this is stable; you'll reuse it).
6. **Instance configuration**: `db.t3.micro` (Learner-Lab-friendly, cheap).
7. **Storage**: 20 GB gp3 (default is fine).
8. **Connectivity** → **Public access: Yes** (so you + teammates can connect from your laptops).
9. **Additional configuration** → **Initial database name**: `postgres` (otherwise RDS creates no database and the app has nothing to connect to).
10. **Create database** → wait ~5–10 min until **Status: Available**.

## 2. Open the firewall (security group)

1. Open the instance → **Connectivity & security** → click the **VPC security group**.
2. **Inbound rules** → **Edit inbound rules** → **Add rule**:
   - Type **PostgreSQL** (port **5432**)
   - Source: **My IP** (just you) or **Anywhere-IPv4 `0.0.0.0/0`** (easiest for a 3-person team; fine for a demo DB) → **Save**.

## 3. Get the endpoint

Instance → **Connectivity & security** → copy the **Endpoint** (e.g. `not-spotify-db.abc123.us-east-1.rds.amazonaws.com`) and **Port** (`5432`).

## 4. Point the app at RDS

From `backend/src/NotSpotify.Api` — **each teammate runs this with the same values** (it's stable, no rotation):
```powershell
dotnet user-secrets set "ConnectionStrings:Postgres" "Host=YOUR-ENDPOINT;Port=5432;Database=postgres;Username=postgres;Password=YOUR-MASTER-PASSWORD;SSL Mode=Require;Trust Server Certificate=true"
```

## 5. Get the data in

Pick one:

**5a — Fresh start (simplest).** Just run the backend (`dotnet run`). On startup it runs EF migrations + the idempotent table guards + `DbSeeder`, so all tables and seed data (artists, tracks, demo admin) are **created automatically** in the empty RDS. Watch the console — you'll see it migrate and seed. Done.

**5b — Keep your current Supabase data** (users, playlists, uploads). Needs the Postgres client tools (`pg_dump`/`pg_restore`):
```bash
# dump from Supabase (use your Session Pooler connection string)
pg_dump "postgresql://postgres.<ref>:<pw>@aws-1-...pooler.supabase.com:5432/postgres" \
  --no-owner --no-privileges -Fc -f notspotify.dump

# restore into RDS
pg_restore --no-owner --no-privileges \
  -d "postgresql://postgres:<pw>@YOUR-ENDPOINT:5432/postgres" notspotify.dump
```

## 6. Storage too

If you haven't already, move media to S3 as well — see [`aws-s3-setup.md`](aws-s3-setup.md). RDS (database) + S3 (files) = fully off Supabase.

## 7. Verify

`dotnet run` → the console connects to RDS (no Supabase). Log in as the seed admin (`alex@example.com` / `Password123!`), browse, and play a track.

---

## Each lab session (Learner Lab reminder)

When you **Start Lab**, the RDS instance is usually **stopped**. RDS → select `not-spotify-db` → **Actions → Start**, wait for **Available** (~5 min). **Stop it** (Actions → Stop temporarily) when you're done to save budget. (AWS auto-starts a stopped instance after 7 days regardless.)

## Cost

`db.t3.micro` ≈ **$0.017/hr** (~$12/month if left on 24/7) + ~$2/month for 20 GB. **Stop the instance when idle** and a 2-week project costs a few dollars — well inside the lab budget.

## Account budget & switching

- Each Learner Lab account has its **own** credit (commonly ~$50 — confirm yours) and budgets **cannot be pooled** across accounts. Three accounts = three separate buckets, not one shared $150.
- "Moving to a teammate's account" is a **re-provision**, not a live move: create a new RDS there and `pg_dump` → `pg_restore` (a few minutes); recreate the S3 bucket and re-sync the files. **Keep a recent `pg_dump` backup** so this is quick if you ever need it — and this is exactly why keeping Supabase as a fallback is worth it.

## Troubleshooting

- **Connection times out** → security-group inbound 5432 isn't open to your IP, or **Public access = No**.
- **Password authentication failed** → wrong master user/password in the connection string.
- **SSL/cert error** → keep `SSL Mode=Require;Trust Server Certificate=true`.
- **App shows no data on a fresh start** → the seeder runs on first launch; give it a moment and check the backend console for the migrate/seed logs.
- **`database "postgres" does not exist`** → you skipped step 1.9 (Initial database name); either recreate or `psql … -c 'CREATE DATABASE postgres;'`.
