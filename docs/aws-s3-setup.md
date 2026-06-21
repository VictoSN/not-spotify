# AWS S3 Setup & Migration Runbook

Move the media catalogue (audio, cover art, avatars, uploads) off Supabase Storage onto **AWS S3**. The backend code is already done — this is the AWS console + config + one migration command. Budget ~30 minutes.

The app picks its storage provider by priority **S3 → Supabase → Local**, each keyed off its own config. Setting `S3Storage:BucketName` is what flips it to S3; the console prints `[Storage] Using S3: …` on startup.

---

## 0. Which AWS account do you have?

The steps fork once, here. Figure out which you have before starting:

| | **Path A — Regular AWS account** | **Path B — AWS Academy Learner Lab** |
|---|---|---|
| You log in at | `console.aws.amazon.com` (your own account) | The Academy course → "AWS Academy Learner Lab" → **Start Lab** → AWS |
| Credentials | A **permanent** IAM access key you create | **Temporary** keys under **AWS Details → AWS CLI** (incl. a **session token**); they reset every time you start the lab |
| Region | Any (pick one near you, e.g. `ap-southeast-1` Singapore) | Usually **locked to `us-east-1`** |
| Extra config | none | `S3Storage:SessionToken`, and you re-set the keys each lab session |

If you're not sure: if your course gave you a "Learner Lab" you start/stop, it's **Path B**.

---

## 1. Create the S3 bucket

1. AWS Console → **S3** → **Create bucket**.
2. **Bucket name**: globally unique, e.g. `not-spotify-media-<yourname>`.
3. **Region**: Path A → pick one near you (`ap-southeast-1`). Path B → **`us-east-1`**.
4. **Block Public Access**: **leave all four boxes checked (ON)**. The app serves audio via short-lived **presigned URLs**, so the bucket stays private — that's the secure, rubric-friendly setup. Don't disable this.
5. Leave the rest as default → **Create bucket**.

> Write the exact bucket name + region down — you'll need both in step 4.

---

## 2. Add the bucket CORS policy

The browser fetches audio cross-origin (for playback *and* the "identify a song" recognition feature), so the bucket needs CORS.

1. Open the bucket → **Permissions** tab → scroll to **Cross-origin resource sharing (CORS)** → **Edit**.
2. Paste this and **Save changes**:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

(Add your deployed frontend origin to `AllowedOrigins` later if you host it somewhere.)

---

## 3. Get credentials

> **AWS Academy (Path B)? Skip straight to "Path B" below.** You **cannot** create an IAM user (the `voclabs` lab role blocks `iam:CreateUser` — that error is expected, not your fault) and you don't need one: the lab credentials already have S3 access. The IAM-user steps are **Path A only**.

### Path A — create an IAM user (permanent key)

1. AWS Console → **IAM** → **Users** → **Create user**. Name it e.g. `not-spotify-app`. Do **not** give console access.
2. **Permissions** → **Attach policies directly** → **Create inline policy** → **JSON** tab → paste this (replace **both** `YOUR_BUCKET_NAME`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "NotSpotifyObjectRW",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    },
    {
      "Sid": "NotSpotifyListBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME"
    }
  ]
}
```

3. Finish creating the user → open it → **Security credentials** → **Create access key** → choose **Application running outside AWS** → copy the **Access key ID** and **Secret access key**. (The secret is shown once.)

### Path B — copy the lab's temporary keys

1. In the Learner Lab page, click **AWS Details** → **AWS CLI** → **Show**.
2. Copy the three values: `aws_access_key_id`, `aws_secret_access_key`, `aws_session_token`.
3. (No IAM user needed — the lab role already has S3 access.) **These expire when the lab stops** — you'll re-paste them (step 4) each new lab session.

---

## 4. Configure the backend (user-secrets)

From `backend/src/NotSpotify.Api`. Keep your existing **Supabase** secrets in place — the migration reads *from* Supabase and writes *to* S3, so both must be set at once.

**Path A:**
```powershell
cd backend/src/NotSpotify.Api
dotnet user-secrets set "S3Storage:BucketName" "not-spotify-media-yourname"
dotnet user-secrets set "S3Storage:Region" "ap-southeast-1"
dotnet user-secrets set "S3Storage:AccessKeyId" "AKIA..."
dotnet user-secrets set "S3Storage:SecretAccessKey" "your-secret"
```

**Path B (Academy)** — same, but `us-east-1` and add the session token:
```powershell
dotnet user-secrets set "S3Storage:BucketName" "not-spotify-media-yourname"
dotnet user-secrets set "S3Storage:Region" "us-east-1"
dotnet user-secrets set "S3Storage:AccessKeyId" "ASIA..."
dotnet user-secrets set "S3Storage:SecretAccessKey" "your-secret"
dotnet user-secrets set "S3Storage:SessionToken" "the-long-aws_session_token-value"
```

Verify with `dotnet user-secrets list`.

---

## 5. Migrate the catalogue

From `backend/src/NotSpotify.Api`:

```powershell
dotnet run -- migrate-storage --dry-run   # lists every object it WOULD copy; writes nothing
dotnet run -- migrate-storage             # actually copies Supabase -> S3 (idempotent; safe to re-run)
```

You'll see one line per object (`copied audio/<guid>.mp3 (… bytes)`) and a final summary (`copied N, missing M, failed F`). `missing` = a DB row pointing at an object that isn't in Supabase (usually fine — external/seeded URLs that were never uploaded). Any `failed` rows can be fixed and re-run safely.

---

## 6. Verify it's live on S3

1. Start the backend normally: `dotnet run`. The console should print **`[Storage] Using S3: bucket … (endpoint: AWS …)`**.
2. Start the frontend (`npm run dev`), log in, and:
   - **Play a track** — audio streams from a `…amazonaws.com/…?X-Amz-…` presigned URL (check the Network tab).
   - **Download an album** (as a premium user) — the ZIP builds from S3.
3. No CORS errors in the browser console = step 2 is correct.

That's the migration done — you're submitting on AWS S3.

---

## Troubleshooting

- **Console still says `Using Supabase`** → `S3Storage:BucketName` isn't set (or you ran from the wrong folder). `dotnet user-secrets list` to confirm.
- **`Access Denied` during migration** → the IAM policy bucket name/ARN is wrong, the region doesn't match the bucket, or (Path B) the lab token expired — re-copy the three values.
- **Audio won't play / CORS error in console** → the bucket CORS (step 2) is missing or doesn't list `http://localhost:5173`.
- **404 on a specific track** → that object wasn't copied; re-run `migrate-storage` (it's idempotent).
- **`SignatureDoesNotMatch`** → wrong secret key, or your PC clock is skewed.
- **(Path B) Everything breaks next day** → Academy creds rotated; re-run the step-4 `AccessKeyId`/`SecretAccessKey`/`SessionToken` commands with fresh values.

## Cost

Demo-scale traffic (graders + teammates, a few GB) sits comfortably inside the **AWS Free Tier** (S3 free tier + the account-wide 100 GB/month data-transfer-out allowance); beyond that, egress is ~$0.09/GB — a couple of GB is cents. Student-account credits cover it either way.
