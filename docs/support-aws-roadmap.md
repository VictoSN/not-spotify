# Support on AWS — Roadmap & Checklist

This roadmap answers three questions that came up while planning the help center:

1. **Can `/support` become its own `support.<domain>` like real Spotify?** — and is it worth it.
2. **Where does support live once the backend moves to AWS?** — grounded in our actual topology (ASP.NET monolith + RDS + S3 + SignalR), not generic advice.
3. **Implement Spotify's "basic search"** — the instant suggestions dropdown shown in the reference screenshots.

It is a companion to [`support-page-roadmap.md`](support-page-roadmap.md) (ticket flow, helpfulness feedback, article CMS) and [`support-content-roadmap.md`](support-content-roadmap.md) (article content, follow-along checklists, "Download your data"). This doc deliberately stays on **domain + AWS topology + search** and does not repeat those.

> **Reality check up front.** Everything here is sized for *our* project: a 3-person student cloud submission running an AWS-Academy-friendly stack. Where a "real Spotify" answer would mean Zendesk + a separate org, we pick the version that meets the rubric without a second product. Each item says whether it needs backend work, infra, or is pure frontend.

---

## Current state (what we actually have)

| Layer | Today | Relevant to support? |
|---|---|---|
| Frontend | React/Vite SPA, one bundle. `/support` is a client-side route ([`SupportPage.tsx`](../frontend/src/pages/SupportPage.tsx)). Also shipped as PWA + Tauri. | Article content + search UI all live here, **static, no backend call**. |
| Backend | One ASP.NET Core 8 monolith (`NotSpotify.Api`), `https://localhost:7045`. SignalR hubs, JWT + refresh cookie, rate limiter. | A support API would be **new controllers in the same monolith** — no new service. |
| DB | Postgres (→ RDS per [`aws-rds-setup.md`](aws-rds-setup.md)). EF migrations auto-apply on startup. | Ticket tables = **new EF entities in the same DbContext**. |
| Storage | `IStorageService`, priority S3 → Local ([`aws-s3-setup.md`](aws-s3-setup.md)). | Ticket screenshot attachments = **reuse `IStorageService`**, new key prefix. |
| Search | Catalogue search is server-side ([`SearchController.cs`](../backend/src/NotSpotify.Api/Controllers/SearchController.cs)). **Support search is client-side substring match** over the hardcoded article index. | "Basic search" = enrich the client index; no backend needed for v1. |

**Key fact that shapes the whole plan:** the support page today is **100% static and self-contained**. It needs no API, no DB, no auth. That's why the subdomain question is cheap to answer and why basic-search is a frontend-only first step.

---

## Part 1 — `support.<domain>`: subdomain vs route

### The question
Real Spotify serves help at `support.spotify.com` — a separate property. Ours is `/support` inside the main SPA. Can/should we split it onto its own subdomain when we go to AWS?

### Short answer
**Yes, it's possible and it's the "real Spotify" pattern — but for our scope, keep `/support` as a route and only promote it to a subdomain if we want the demo to *look* like Spotify's split.** It's a DNS + CloudFront exercise, not an architecture change. Decide based on how much we want to mirror Spotify vs. how much infra we want to babysit.

### The three options, concretely

- [ ] **Option A — Keep `/support` route (recommended default).**
  - Zero new infra. Already works. One CloudFront distribution, one S3 bucket for the SPA.
  - Trade-off: URL is `notspotify.com/support`, not `support.notspotify.com`.

- [ ] **Option B — `support.<domain>` as a separate static deployment (the "looks like Spotify" option).**
  - Build the support center to its own `dist`, push to a **second S3 bucket**, front it with a **second CloudFront distribution**, add an **ACM cert** (must be in `us-east-1` for CloudFront) and a **Route 53** record for `support.<domain>`.
  - The support site still calls the **same** backend at `api.<domain>` for any dynamic bits (tickets, status). It is just a separate static origin.
  - Trade-off: a second build + deploy pipeline, and the support build either becomes its own tiny Vite entry or a `--mode support` build of the same repo.

- [ ] **Option C — `support.<domain>` pointing at the *same* SPA, rendering support at `/`.**
  - One bucket/distribution; Route 53 `support.<domain>` → same CloudFront. The SPA detects host `support.*` and renders the support home at path `/`.
  - Cheapest way to get the subdomain URL. Trade-off: a host-based branch in the router, and the full app bundle still ships under the support hostname.

### Recommendation for this project
Ship **Option A** now (it's done), and treat **Option C** as the low-effort "make it a real subdomain for the demo" upgrade. **Option B** only if a grader specifically rewards a separate deployable — it's the most realistic but the most moving parts.

### Subdomain checklist (only if doing B or C)
- [ ] Register/confirm an apex domain in **Route 53** (or delegate from an existing one).
- [ ] Request an **ACM certificate in `us-east-1`** covering `support.<domain>` (CloudFront only reads certs from `us-east-1`).
- [ ] **Option C:** add `support.<domain>` as an **alternate domain (CNAME)** on the existing CloudFront distribution; add a host check in the SPA router to render support at `/`.
- [ ] **Option B:** new S3 bucket (`support-<domain>`, Block Public Access ON) + new CloudFront distribution (OAC to the bucket) + alternate domain `support.<domain>`.
- [ ] Route 53 **A/AAAA alias** record `support.<domain>` → the CloudFront distribution.
- [ ] SPA fallback routing: CloudFront **custom error response** 403/404 → `/index.html` (200) so deep links like `support.<domain>/?topic=...` work.
- [ ] CORS: if support is on a different origin than the API, add `https://support.<domain>` to the backend `UseCors` allowed origins (see Part 2).

---

## Part 2 — Support in the AWS topology

This section places the **support backend** (tickets, attachments, status, search-miss capture) into the AWS target so it "meets the system requirement" instead of being a bolt-on. Nothing here invents a new service — it all rides the migration we're already doing.

### Target topology (with support overlaid)

```
                 Route 53
        ┌───────────┴────────────┐
   notspotify.com           support.<domain>     (optional, Part 1)
        │                         │
   CloudFront ──► S3 (SPA dist)   └─► same SPA / second dist
        │
   api.<domain> (CloudFront/ALB)
        │
   ┌────▼─────────────────────────────────┐
   │  ASP.NET Core monolith (EC2/App Runner)│
   │  + existing controllers                │
   │  + NEW: SupportController              │  ◄── tickets, status, search-miss
   │  + SignalR hubs (presence/session)     │
   └───┬───────────────────────┬────────────┘
       │                       │
   RDS Postgres            S3 (private + presigned)
   • existing tables       • existing media keys
   • NEW SupportTicket*    • NEW support/attachments/{ticketId}/...
```

### How the pieces interact (and what support adds)
- **Support API = new controllers in the existing monolith.** A `SupportController` (+ admin endpoints) added next to the others. No new deployable, no new container. Auth, rate limiting, and DI all already exist.
- **Ticket data = new EF entities in the existing `AppDbContext`.** They migrate onto **RDS** automatically via the same `MigrateAsync()` on startup. Use the project's **idempotent `CREATE TABLE IF NOT EXISTS` guard pattern** (see `Program.cs`) because the DB is shared.
- **Attachments = existing `IStorageService`.** Store under a new key prefix `support/attachments/{ticketId}/{guid}.{ext}` so it works identically on S3 or Local. On S3 it inherits private bucket + presigned URLs for free.
- **Notifications = existing notification system.** "Admin replied / ticket closed" reuses `NotificationService` — no new channel.
- **System-status panel hits AWS surfaces.** Its checks map 1:1 to our AWS pieces: API reachable (ALB/health), DB connected (RDS), storage configured (S3), Stripe configured. This is genuinely useful precisely because we now have RDS + S3 + Stripe as separate failure points.

### AWS topology checklist
- [ ] **Backend host decision.** EC2 (Learner-Lab-friendly, single instance) is the default. App Runner / Elastic Beanstalk are fine if we want managed deploys. Document the choice.
- [ ] **SignalR over AWS.** WebSockets must survive the path. If behind an **ALB**, enable WebSocket support + **sticky sessions**. **Single instance = no backplane needed**; if we ever scale out, presence/session hubs need a **Redis backplane (ElastiCache)** — note as a known scale limit, not a v1 task.
- [ ] **CORS allowed origins** in backend `UseCors` updated for the real frontend origin(s): `https://notspotify.<domain>` and, if Part 1 ships, `https://support.<domain>`.
- [ ] **Refresh cookie (`rt`, httpOnly, scoped `/auth`) across subdomains.** If API and frontend end up on different subdomains, set the cookie `Domain=.<domain>` and `SameSite=None; Secure` so session refresh survives — otherwise login works but silent refresh breaks (this already bites people per the auth article).
- [ ] **Support ticket tables on RDS** via EF migration + idempotent guard (see Part 3).
- [ ] **Attachment uploads** wired through `IStorageService` with size/type limits (Part 3) — verify presigned GET works on the private S3 bucket.
- [ ] **System-status checks** read real AWS state (RDS connectivity, active storage provider, Stripe configured). Public sees green/yellow/red; admin sees detail.
- [ ] **S3 CORS** already covers GET/HEAD for media; **no change needed** for attachments served via presigned URLs (same-origin fetch or direct link).

---

## Part 3 — Support backend MVP (rides the migration)

Minimum to make support "real" once we're on AWS. Ordered for least-risk-first. (Detailed field lists live in [`support-page-roadmap.md`](support-page-roadmap.md) §1–6; this is the AWS-grounded build order.)

- [ ] **`SupportTicket` + `SupportTicketMessage` EF entities** in `AppDbContext`; migration added with `dotnet build` before `dotnet run` (per the shared-DB rule) and an idempotent table guard.
- [ ] **`SupportController`**: authenticated users create tickets (subject, category, description, auto-filled email, optional page URL / entity ID / error text). Anonymous → "log in first".
- [ ] **Admin endpoints**: list / reply / close / tag — reuse existing admin RBAC, no new role.
- [ ] **Reply/close notifications** via existing `NotificationService`.
- [ ] **No-results search capture**: log unmatched support queries (query, route, userId?, timestamp) to a small table; admin view of "unanswered searches".
- [ ] **Helpfulness feedback** ("Was this helpful?") on article pages → small table; admin view of low-helpfulness articles.
- [ ] **Attachments (optional)**: png/jpg/jpeg/webp, size-capped, via `IStorageService` under `support/attachments/...`. Never preview/execute arbitrary types.
- [ ] **System-status endpoint**: returns coarse health publicly, detailed config (RDS/S3/Stripe present?) to admins only.

---

## Part 4 — Spotify "basic search" (the dropdown in the screenshots)

The reference screenshots show two things: a **"Search with AI" / "Basic Search" toggle**, and a **basic search that drops down instant article suggestions as you type** (typing "App" → *Updating your Spotify app, Checking your app version, …*). Today both tabs do the **same** thing — `findArticleByQuery` returns the *first* substring match and only fires on Enter. Basic search should instead show a **live ranked suggestion list**.

### v1 — instant suggestions over the article index (frontend only, no backend)
- [ ] When **Basic Search** is active, show a **dropdown of up to ~5 matching articles** that updates on each keystroke (debounced), instead of redirect-on-Enter.
- [ ] Rank suggestions: title match > section match > group/description match; case-insensitive; trim query.
- [ ] Each suggestion is a row with a doc icon + title (mirrors the screenshot) linking to `/support?topic=<slug>`.
- [ ] Keyboard support: ↑/↓ to move, **Enter** opens the highlighted suggestion, **Esc** closes the dropdown.
- [ ] Show the raw query itself as the last row ("Search '<query>'") like Spotify's trailing magnifier row.
- [ ] Empty/no-match state: "No exact match" + quick links (Contact us, Account, Billing, Playback, Uploads) — feeds the no-results capture in Part 3.
- [ ] Make the two tabs genuinely differ: **Basic Search** = this instant index lookup; **Search with AI** = the existing free-text panel (keep its "AI-powered tool" disclaimer; wire to a real assistant later, out of scope here).

### v2 — better ranking without an LLM (still mostly frontend)
- [ ] Per-article **synonyms / keywords** map (e.g. "card declined" → failed-payment-help, "profile picture" → edit-your-profile) so colloquial queries hit.
- [ ] Lightweight **fuzzy match** (typo tolerance) over titles.
- [ ] "Recommended topics" shown **below the field before typing** (mirrors Spotify's resting state).

### v3 — optional backend assist (only if article set outgrows the client)
- [ ] If articles move into the DB/CMS (see other roadmap), add a small **`/support/search?q=`** endpoint returning ranked article refs — same shape as the client index so the dropdown component doesn't change.
- [ ] Reuse the **catalogue search pattern** (`SearchController` ILIKE + `Take(n)`) for consistency; this is also where support search and music search could converge if desired.

### Acceptance criteria for basic search
- [ ] Typing shows a live, ranked dropdown (not a single redirect).
- [ ] Keyboard nav + Enter + Esc all work.
- [ ] No match → helpful fallback links, and the miss is logged (once Part 3 lands).
- [ ] "Search with AI" and "Basic Search" behave **differently** and both are obviously functional.

---

## Suggested overall order

1. **Part 4 v1** — basic-search dropdown. Pure frontend, highest visible polish, zero risk, makes the screenshots match. *(Do first.)*
2. **Part 1 decision** — pick A / B / C and record it. (A needs nothing; C/B are infra tasks for migration day.)
3. **Part 2 + 3** — stand up the support backend *as part of* the RDS/S3 migration, not after, so tickets/attachments land on AWS from day one.
4. **Part 4 v2** — synonyms + recommended topics.
5. Defer Part 4 v3 and ticket attachments until article volume or graders demand them.

## Definition of done for "support on AWS"
- [ ] Decision recorded on `/support` route vs `support.<domain>`, with DNS/cert/CloudFront steps done if a subdomain was chosen.
- [ ] If a support backend was built: tickets + attachments live on **RDS + S3**, migrated by the same startup path as the rest of the app, with idempotent guards.
- [ ] CORS + refresh-cookie domain settings verified for the chosen frontend/api origins.
- [ ] System-status panel reflects **real** RDS/S3/Stripe state.
- [ ] Basic search shows live ranked suggestions, keyboard-navigable, with a logged no-results fallback.
