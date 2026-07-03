# Thumbnail Lambda (Task 2 serverless microservice)

On-demand + event-driven cover-art thumbnails: **API Gateway → Lambda → S3**, plus an
**S3 `ObjectCreated` trigger** that pre-generates thumbnails when artists upload covers.
This is the serverless component documented in the Task 2 report (sections 3.1–3.6).

## Deploy (AWS console, Learner Lab friendly)

1. **Function** — Lambda → Create function → `thumbnail-service`, runtime **Python 3.12**,
   role `LabRole` (or a role with `s3:GetObject`/`s3:PutObject` on the media bucket +
   CloudWatch Logs + X-Ray, see report Listing 2). Paste `lambda_function.py`, handler
   `lambda_function.handler`.
2. **Pillow layer** — Pillow must be built for Amazon Linux. Easiest: use a public
   Pillow layer ARN for your region/runtime, or build one:
   `pip install pillow -t python/ --platform manylinux2014_x86_64 --only-binary=:all:`
   then zip `python/` and publish as a layer. Attach it to the function.
3. **Env vars** — `MEDIA_BUCKET=not-spotify-media`, `THUMB_SIZE=300`.
   Memory 512 MB, timeout 30 s.
4. **API Gateway** — Create **HTTP API** `notspotify-thumbs`, route
   `GET /thumbnail/{key+}` → Lambda proxy integration (payload v2.0), `$default`
   stage auto-deploy. Enable CORS for the app origins and stage throttling.
5. **S3 trigger** — bucket → Properties → Event notifications → `covers-uploaded`:
   event `s3:ObjectCreated:*`, **prefix `covers/`**, destination = the function.
   ⚠️ Output goes to `thumbs/…` — keep the prefix filter or the function loops on
   its own writes.
6. **X-Ray** — enable Active tracing on the function and tracing on the API stage.

## Frontend

`frontend/src/services/thumbs.ts` builds thumbnail URLs when `VITE_THUMB_API`
(the API invoke URL) is set; otherwise components fall back to the original
presigned cover URLs, so this is safe to deploy/roll back independently.

## Test

```bash
curl -i "https://{api-id}.execute-api.us-east-1.amazonaws.com/thumbnail/covers/{guid}.jpg"
# first call: slower (generates thumbs/300/covers/{guid}.jpg), 302 to presigned URL
# second call: fast cache hit, same 302
```
