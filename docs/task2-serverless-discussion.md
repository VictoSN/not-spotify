# Task 2 — Part 2 discussion notes (serverless upload path)

Draft material for the report's "changes between Task 1 and Task 2" section, written
against what is actually deployed and in the repo rather than the generic tutorial
version. Edit freely — the point is that every claim here is checkable in the code.

Cross-references: [`aws-lambda-setup.md`](aws-lambda-setup.md) is the runbook;
[`aws-s3-setup.md`](aws-s3-setup.md) and [`aws-rds-setup.md`](aws-rds-setup.md) cover the
Task 1 services this builds on.

---

## 1. What moved, and what stayed

**Task 1 (server-based).** A user uploading personal audio POSTed the file as
`multipart/form-data` to `POST /me/uploads` on the ASP.NET Core API running on ECS
Fargate. The container read the whole stream, forwarded it to S3 through
`IStorageService`, and wrote the `UserUpload` row to RDS. Every byte crossed the ALB and
sat in container memory. The endpoint carried `[RequestSizeLimit(50_000_000)]` — a 50 MB
cap that existed because of the container, not because of anything about the product.

**Task 2 (serverless).** One responsibility — *deciding where a file may be written and
authorising that write* — was extracted into API Gateway + Lambda:

1. The browser calls `POST /presign` on the HTTP API. The Lambda authenticates the user,
   validates the request, derives an S3 object key, and returns a presigned POST policy.
2. The browser sends the file **directly to S3**. No application server is involved.
3. The browser calls `POST /me/uploads/complete` on the ECS API, which verifies the object
   with `HeadObject` and writes the RDS row.

The database write stayed on ECS deliberately. It needs the EF `AppDbContext`, the
`UserUpload` entity and the RDS connection; moving it would have meant either duplicating
the data layer in the Lambda or putting the Lambda inside the VPC, both of which cost more
than they return at this scale. **The split is along a real seam** — authorisation and
placement are stateless and bursty (a good fit for Lambda), persistence is stateful and
already well served by the monolith.

## 2. Why this is a genuine improvement, not a relocation

- **The container is out of the data path.** A 100 MB upload no longer occupies container
  memory or an ALB connection for its whole duration, so concurrent uploads stop competing
  with ordinary API traffic for the same fixed Fargate CPU/memory allocation.
- **The size ceiling became a policy decision.** It is now 100 MB, enforced by S3 through
  the POST policy's `content-length-range` condition, and changing it does not require
  re-sizing the container.
- **The new component scales to zero.** The presign function runs for a few milliseconds
  per upload and costs nothing when idle, whereas the Fargate task is always on.
- **It is independently deployable.** `serverless\deploy-lambda.ps1` ships the function in
  seconds without touching the ECS service — a step toward microservices, without a rewrite.

## 3. Design decisions worth defending

Each of these was a choice with a rejected alternative, which is usually what a discussion
section is being marked on.

**Authentication is done inside the Lambda, not by API Gateway.**
The first console implementation had no authentication at all: anyone with the invoke URL
could mint an upload URL of any size and content type into the bucket. The obvious fix is
API Gateway's built-in JWT authorizer, but it only validates OIDC/OAuth2 tokens via a JWKS
endpoint, and the application issues **symmetric HS256** tokens from ASP.NET Identity with
no JWKS to publish. So the function verifies the token itself using `hmac` and `hashlib` —
signature, `exp`/`nbf` with 30 seconds of clock skew, `iss`, `aud`, and a UUID `sub` —
with an explicit algorithm allowlist that rejects anything other than HS256. That
allowlist is what defeats the classic `alg: none` forgery, and there is a unit test for it.
*Cost:* the signing key now exists in two places (the ECS task definition and the Lambda's
environment) and must be rotated in both. The alternative — minting a separate short-lived
upload token in the monolith — would have put the monolith back in the request path.

**A presigned POST, not a presigned PUT.**
The tutorial pattern (`generate_presigned_url` for `put_object`) cannot constrain the body
size: a client is free to ignore the size it declared and stream gigabytes into the bucket.
`generate_presigned_post` carries a policy document, so `["content-length-range", 1, max]`
and an exact `Content-Type` condition are enforced by **S3 itself**, not by client
good behaviour. *Cost:* a slightly more involved client (form fields must be appended
before the file part) and a response shape that is no longer a single URL.

**The client never chooses the object key.**
The key is built server-side as `uploads/{sub}/{uuid4}{ext}` from the *token's* subject, so
it is inherently scoped to the authenticated user and two uploads of the same filename
cannot collide. A `key` supplied in the request body is ignored. Compare the initial
version's `uploads/{uuid}-{filename}`, which is collision-safe but not attributable to a
user — it could not have backed a per-user private locker.

**Least privilege is load-bearing here, not decorative.**
Generating a presigned URL makes no call to S3, but **the URL inherits the signing role's
permissions**. The execution role therefore has exactly `s3:PutObject` on
`arn:aws:s3:::<bucket>/uploads/*`: no `GetObject`, no `DeleteObject`, nothing outside the
prefix. The role's scope *is* the blast radius of a bug in the key builder — with a wider
role, a malformed key could hand out a URL that overwrites catalogue audio.

**The server re-derives what it can rather than trusting the client.**
`POST /me/uploads/complete` receives a key the browser claims to have written, so it
re-checks everything: ownership from the key's own prefix (plus an explicit check that the
remainder is a flat filename — otherwise `uploads/{me}/../{them}/x.mp3` passes a naive
`StartsWith`), existence and real size from `HeadObject`, and a repeat call returns `409`
rather than creating a duplicate row. The browser's claim that the upload succeeded is not
evidence.

**The bucket stays private throughout.** Block Public Access remains on. Presigned URLs
are the mechanism that makes a private bucket usable from a browser, and their TTL is 15
minutes for the upload policy.

## 4. Integration cost (the part tutorials leave out)

Bolting a serverless path onto a running system was not free, and these are the concrete
places it touched:

- **Two CORS configurations, not one.** API Gateway's CORS covers the `POST /presign` call.
  The file upload goes to `bucket.s3.amazonaws.com`, a *different origin* governed by the
  **bucket's** CORS — without a `POST` rule there, the preflight fails before a byte moves.
  The bucket rule now lives in code (`S3StorageService.EnsureBrowserCorsAsync`) because
  `PutCORSConfiguration` replaces the bucket's entire configuration, so anything set by
  hand in the console is silently destroyed the next time that command runs.
- **A graceful fallback.** The frontend uses the serverless path only when
  `VITE_UPLOADS_API_URL` is set, and falls back to the original multipart endpoint if the
  presign service is unreachable or returns 5xx. It deliberately does **not** fall back on a
  4xx: a rejection about the file itself (too large, wrong type, not signed in) is shown to
  the user, because retrying it through the API would either fail again or quietly bypass
  the limit the Lambda just enforced.
- **A duplicated allowlist.** The accepted audio extensions and the size cap now exist in
  both the Lambda and `MeUploadsController`. Accepting something in one that the other
  rejects would leave orphaned objects in the bucket. This is real coupling introduced by
  the split and is worth naming as such.

## 5. Trade-offs and limitations (state these; they read as rigour)

- **Cold start.** An idle function adds roughly a couple of hundred milliseconds to the
  first presign call. It is paid once per burst and is invisible next to the upload itself,
  but it is a real regression against an always-warm container.
- **Orphaned objects.** If the browser uploads to S3 and never calls `/complete` (tab
  closed, crash), the object stays in the bucket with no database row. An S3 lifecycle rule
  or a scheduled reconciliation function would close this; neither is implemented.
- **Shared secret across two services** — see the authentication decision above.
- **No resumable/multipart upload**, so a dropped connection on a large file starts over.
- **No content scanning.** Only the extension and size are checked; the bytes are never
  inspected.
- **Operational surface grew.** Two deployment paths, two log groups, and a failure mode
  ("uploads broken, everything else fine") that did not exist when one container did
  everything.

## 6. Evidence

| Claim | How it was checked |
|---|---|
| Handler logic (auth, validation, key scoping) | 31 offline unit tests, `py -m unittest discover -s serverless/uploads-presign` — real HS256 tokens, stubbed boto3 |
| Fallback rules + S3 form-field ordering | 10 Vitest tests, `npx vitest run src/services/uploadService.test.ts` |
| Ownership / traversal / replay checks on completion | 9 xUnit tests in `MeUploadsControllerTests` (301 backend tests pass overall) |
| End-to-end upload | Browser devtools Network tab: the large request goes to `*.s3.amazonaws.com`, not to `api.not-spotify.lol` |
| Runtime behaviour | CloudWatch `/aws/lambda/generatePresignedUrl`; X-Ray service map shows client → API Gateway → Lambda → S3 |

**Monitoring note for Part 3.** Lambda gives Invocations, Duration, Errors and Throttles,
but not CPU/memory utilisation in the form the brief asks for — Lambda bills on
memory-time and does not expose per-task CPU the way Fargate does. Use ECS Container
Insights for the CPU/Memory graphs and the Lambda Monitor tab for the serverless side, and
say explicitly that the two components are measured differently *because* one is
provisioned and the other is not. That contrast is itself a finding.
