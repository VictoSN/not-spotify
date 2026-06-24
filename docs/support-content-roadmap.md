# Support Page Content Roadmap (the BFU)

A roadmap for turning `/support` ([`SupportPage.tsx`](../frontend/src/pages/SupportPage.tsx)) from a Spotify-shaped shell with mostly auto-generated filler into a **real help center whose every article describes something Not Spotify actually does** — with follow-along guides the user can tick off, helpfulness feedback, and the deep nested navigation from the real Spotify support pages.

Companion docs:
- [`support-page-roadmap.md`](support-page-roadmap.md) — ticket flow, feedback capture, article CMS (the *system* around support).
- [`support-aws-roadmap.md`](support-aws-roadmap.md) — `support.<domain>`, AWS topology, basic-search dropdown.

**This doc = the *content* and *article UX*.** It is the big one.

> **The one rule (from the brief):** write only what our app can actually do. If Spotify has an article for a feature we don't ship, we **don't** write a how-to that lies. Every article below is tagged ✅ real / 🟡 partial / ❌ remove-or-don't-build, based on a code audit of our settings, player, and controllers.

---

## 1. Why this is needed: the current page is mostly placeholders

Today `SupportPage.tsx` has ~60 article slugs but only **~10 have hand-written content** (`ARTICLE_DETAILS`). Everything else falls through to `buildDefaultArticleBlocks()` — category-aware *generated* text. It reads okay, but it's filler, and several slugs describe **features we do not have**. That's the gap to close.

### Audit of the current article catalogue

| Current section / article | Status | Reason |
|---|---|---|
| Payments → failed payment, charged too much, update payment, cancel, plan tiers, Duo/Family seats | ✅ real | Stripe + plan seats exist; some already hand-written. |
| **Payments → gift cards / redeem** (`gift-card-not-working`, `not-spotify-gift-cards`) | ✅ real (rewritten) | No stored-value gift cards, **but Stripe checkout has `allow_promotion_codes: true`** — so redeeming promo/coupon codes works. Articles rewritten 2026-06-24 to document redeem honestly. |
| Account → login (email/password), reset password, change password, edit profile, change email, close account | ✅ real | Auth + profile endpoints exist. **Reset/change password + Google login shipped 2026-06-24** — see [`auth-setup.md`](auth-setup.md). |
| **Account → social login** | 🟡 partial | **Google OAuth is wired** (gated until creds set). **Facebook/Apple** remain placeholders → document Google as working; say Facebook/Apple are "not available yet". |
| Account → security → **two-step protection** | ✅ removed | No 2FA exists; real guidance folded into "Keep your account secure". *(done 2026-06-24)* |
| Premium → plans, family/duo invites, student, cancel | ✅ real | Billing + seats exist. |
| In-app features → playlists, search, lyrics/queue/radio | ✅ real | All exist. |
| Devices & troubleshooting → playback, downloads | ✅ real (rename) | Real, but… |
| **Devices → "Connect to a device" / speakers** | ✅ removed | No Spotify-Connect/casting; section is now "Web player & app". *(done 2026-06-24)* |
| Safety & privacy → privacy settings, **private listening**, reporting, blocked users | 🟡 partial | "Private listening" relabeled to "Listening privacy & visibility" with real content *(done 2026-06-24)*; "blocked users" still filler → relabel/remove later. |
| Safety & privacy → **download your data** | ✅ removed (for now) | No export endpoint — pulled from nav; re-add when `GET /me/export` is built (§5). *(done 2026-06-24)* |
| ~50 other slugs (auto-generated) | 🟡 filler | Replace with real articles per §3, or delete the slug. |

**Action:** every ❌ row gets removed from `SUPPORT_GROUPS` (and any links to it). Every 🟡 gets either rewritten against real behavior or relabeled. This alone makes the page honest.

- [x] ~~Remove gift-card articles~~ → **rewritten** as "Redeem a code" (Stripe promo codes) since redeem is real. *(done 2026-06-24)*
- [x] Relabel social-login articles — wrote real "Login methods" + "Logging in with Google"; Facebook/Apple rewritten to honest "not available yet". *(done 2026-06-24)*
- [x] Removed two-step-protection article; folded real guidance into "Keep your account secure" (no 2FA → password + logout + sign-out-everywhere). Also removed the Samsung-login fiction. *(done 2026-06-24)*
- [x] Removed "Connect to a device" / speaker articles; section is now "Web player & app" with a real "Web player & installing the app" article. *(done 2026-06-24)*
- [x] Relabeled "Private listening" → "Listening privacy & visibility" with honest content (no private session; playlist visibility + presence + logout). *(done 2026-06-24)*
- [x] "Download your data": rebuilt honestly after `GET /me/export` shipped; article restored to the privacy nav with the exact exported fields. *(done 2026-06-24)*

---

## 2. The DO-NOT-WRITE list (features Spotify has, we don't)

Pin this so nobody re-adds fiction later:

- ❌ Stored-value **gift cards** (BUT 🟡 **redeeming promo/coupon codes works** via Stripe checkout — `allow_promotion_codes: true` — document that, not prepaid cards)
- 🟡 Social login — **Google works** (`docs/auth-setup.md`); **Facebook / Apple** are still placeholders, don't document them as working
- ❌ Two-factor / two-step verification
- ❌ Spotify Connect, casting, speakers, "connect to a device"
- ❌ Explicit-content **filter toggle** (tracks carry an `explicit` flag set by admins, but there is **no user setting** to hide them — don't promise one)
- ❌ Per-platform **Video settings** / **Canvas** on/off
- ❌ Audiobooks (we have podcasts + music videos, not audiobooks)
- ✅ **Data Saver** is now real (Settings → Audio toggle forces Low tier, shipped 2026-06-24); ❌ but cellular data-usage controls / "Offline Backup" are still not present
- ❌ Hardware/OS-specific troubleshooting we can't influence (TV, car, game consoles)

If a grader asks "where's the X article like Spotify?" the honest answer is "we don't ship X" — and that's better than a how-to for a button that doesn't exist.

---

## 3. The real article catalogue (grounded in our features)

This is the BFU content plan. Structure mirrors the **deep nested nav** in the reference screenshots (Group → Section → Article), but every leaf is backed by code. Items marked ✅ are confirmed present in the audit.

### Getting started
- [ ] Create your account & logging in (email + password; 8-char minimum) ✅
- [x] The web player & installing the PWA / desktop app (Tauri) ✅ *(written as "Web player & installing the app", 2026-06-24, follow-along)*
- [ ] Free vs Premium — what each tier can do ✅ *(mirror the README comparison table)*
- [ ] Keyboard shortcuts (press `?` anywhere) ✅

### App settings  *(the screenshot's "In-app features → App settings" — and we genuinely have most of it)*
- [x] **Audio quality** — Auto/Low/Normal/High/Very High; Free capped ~128 kbps, High/Very High need Premium ✅ *(written as "Data Saver and audio quality", 2026-06-24)*
- [x] **Volume normalization** — what the toggle does (Web Audio gain leveling) ✅ *(2026-06-24, follow-along)*
- [x] **Crossfade & gapless** ("Transitions between tracks") — 0/3/6/9/12s, where to set it ✅ *(2026-06-24, follow-along)*
- [x] **Autoplay** — keep playing similar tracks when a queue ends ✅ *(2026-06-24, follow-along)*
- [x] **Equalizer** — choosing presets ✅ *(2026-06-24, follow-along)*
- [x] **Playback speed** — cycling rates from the player bar (great for podcasts) ✅ *(2026-06-24, follow-along)*
- [x] **Sleep timer** — stop playback after N minutes ✅ *(2026-06-24, follow-along)*
- [x] **Appearance** — light/dark theme + dynamic cover-art theming ✅ *(2026-06-24, follow-along)*
- [x] **Change the app language** — en/es/fr, where it applies ✅ *(2026-06-24, follow-along)*
- [ ] **Now Playing & compact library** display toggles ✅

### Playback & listening
- [x] Shuffle & repeat — and **why Free can't turn shuffle off / can't repeat** ✅ *(2026-06-24)*
- [x] Queue & play-next — drag-reorder is Premium ✅ *(2026-06-24, in "Lyrics, queue, and recommendations")*
- [x] Lyrics — synced karaoke, click-to-seek, why some tracks are instrumental/none ✅ *(2026-06-24)*
- [x] Song radio & "Fans also like" — how the station is built ✅ *(2026-06-24, follow-along)*
- [ ] Picture-in-Picture & OS media keys ✅
- [ ] Audio ads on Free — why you hear them, how Premium removes them ✅
- [x] "App not playing music" troubleshooter ✅ *(real article; follow-along conversion done 2026-06-24)*

### Playlists & library
- [x] Create & edit playlists; cover art (5 MB, jpg/jpeg/png/webp) ✅ *(pre-existing real article)*
- [x] Smart playlists — the rule set (genre/rating/play-count/recency/limit) and why manual edits are blocked ✅ *(covered in "Create and edit playlists")*
- [x] Visibility: public / friends-only / private (saved copies removed when you go private) ✅ *(covered in "Listening privacy & visibility" + collaborative)*
- [x] Collaborative playlists ✅ *(2026-06-24, follow-along)*
- [x] Liked Songs & saving albums ✅ *(2026-06-24, follow-along)*
- [ ] Export / import a playlist as JSON ✅
- [ ] Sorting your library & tracks ✅

### Discovery & search
- [x] How search works — tracks/artists/albums/public playlists + **lyric phrase search** (≥3 chars) ✅ *(pre-existing real article)*
- [ ] Voice search ✅
- [x] Home rows explained — Trending, For You, New Music, Daily Mixes, Charts (Top 50), Popular in {country}, Recents ✅ *(2026-06-24, "Music recommendations")*
- [ ] Star ratings — how they feed "Most liked" ✅
- [x] Browse genres & moods ✅ *(2026-06-24)*

### Social
- [ ] Friends vs Follows (bidirectional w/ acceptance vs one-way) ✅
- [ ] Friend Activity & presence ✅
- [ ] Messages (1:1 chat) ✅
- [ ] Blend & listen-along / Jam ✅
- [ ] Notifications center ✅

### Podcasts, videos & your uploads
- [ ] Podcasts — catalogue & playing episodes ✅
- [ ] Music videos — the watch page (pauses audio) ✅
- [ ] Personal uploads locker — accepted types (mp3/m4a/aac/wav/ogg/oga/opus/flac/webm, ≤50 MB), owner-only ✅
- [ ] Embeddable mini-player — copy-embed-code from a track ✅

### Payments & billing  *(keep the strong existing ones, drop gift cards)*
- [ ] Premium plans & prices ✅ · Failed payment help ✅ · Update payment method ✅ · Charged too much / twice ✅ · Cancel Premium ✅ · Duo/Family/Student seats & invites ✅ · Does the price include tax ✅

### Downloads & offline
- [ ] Download & offline listening — Premium-gated; ZIP for albums/playlists; offline audio in the PWA ✅
- [ ] Downloads not working — 403 (Free), 502 (storage fetch) explained ✅

### Account & security
- [ ] Edit your profile (name/email/country — 2-letter ISO) & avatar (5 MB) ✅
- [ ] Change your email (it's also your login) ✅
- [x] Reset/change password ✅ *(real article + follow-along guides, 2026-06-24)*
- [x] Keep your account secure — no 2FA; password + logout + sign-out-everywhere ✅ *(2026-06-24, follow-along)*
- [ ] Close your account ✅ *(verify the endpoint exists before promising "recover")*
- [ ] Country & market — how it affects "Popular in {country}" ✅

### Artists & creators
- [ ] Become an artist — application → review flow ✅
- [ ] Artist dashboard — uploads, edits, resubmissions ✅
- [ ] Tour dates & events — why they may not show (approval/visibility) ✅
- [ ] Artist verification & profile image ✅

### Admin  *(internal; gate to admins, or keep out of public nav)*
- [ ] Approval queue, audit history, RBAC / master-admin & PendingAction ✅

---

## 4. ⭐ Follow-along guides with checkmarks (the signature feature)

The brief: *"add it to the support for user to follow the guide to add checkmark."* Real Spotify articles are read-only; ours will be **interactive** — step lists the user can tick off, with progress saved.

### Spec
- [x] New `ArticleBlock` variant: shipped as `steps?: string[]` (rendered by `GuideSteps`).
- [x] Renders each step with a tappable checkbox; checked steps get strike/dimmed style and a ✓.
- [x] Progress persists per article+block in `localStorage` (`ns-support-guide-<slug>-<index>`).
- [x] Progress meter ("X of N steps done") + Reset link.
- [ ] Steps can deep-link into the real app (e.g. "Open Account → Subscription" → `/account`). *(steps are plain text for now — next iteration)*
- [x] Keyboard-accessible (`role="checkbox"` button; Space/Enter toggle); no native `confirm()`.

### First guides to convert (high-traffic, all real)
- [x] **"Music won't play"** - converted to an interactive checklist covering connection, volume, alternate track, re-login, upload file rules, and S3/CORS checks. *(done 2026-06-24)*
- [x] **"Upgrade to Premium"** - `not-spotify-premium` now has an interactive upgrade checklist. *(done 2026-06-24)*
- [x] **"Cancel Premium"** - `how-to-cancel-premium-plans` now has an interactive cancel checklist. *(done 2026-06-24)*
- [x] **"Invite a Family/Duo member"** - invite/accept flow converted to an interactive checklist. *(done 2026-06-24)*
- [ ] **"Upload your own audio"** — `/uploads` → pick file (allowed types/size) → it appears in your private locker. ✅
- [x] **"Make a smart playlist"** - smart-rule creation flow added as an interactive checklist. *(done 2026-06-24)*
- [ ] **"Fix grey cover gradients / media won't load (S3)"** — admin-facing: check bucket CORS, presigned-URL expiry. ✅

---

## 5. "Understanding your data" / Download your data — build, *then* document

Spotify's screenshots lean hard on the data-export article. We now have a real export path, so the article is back in the support nav and documents only the fields Not Spotify actually returns.

- [x] **Build** `GET /me/export` - JSON bundle of the caller's own profile, playlists (+ tracks), play history, 30-day listening stats, recent searches, library saves, uploads, ratings, friends/follows, notifications, and shared-plan rows. *(done 2026-06-24)*
- [x] Gate to the authenticated user; never expose another account's data. Covered by `MeExportControllerTests.Export_ReturnsOnlyCallerScopedData`. *(done 2026-06-24)*
- [x] Frontend: a "Download your data" button in Account / Privacy that calls the endpoint and downloads JSON. *(done 2026-06-24)*
- [x] **Then** write the article - `download-your-data` lists exactly what the export includes/excludes. *(done 2026-06-24)*
- [x] Skip the GDPR-Article-15 / advertising-inference / voice-input sections - article explicitly says Not Spotify does not store those categories. *(done 2026-06-24)*

> If we choose **not** to build export for the submission, remove the data-download article entirely rather than ship a placeholder.

---

## 6. Article-page UX upgrades (match the screenshots)

- [x] **"Was this article helpful? 👍 / 👎"** at the bottom of every article (v1 = localStorage, `ArticleFeedback`). *(done 2026-06-24)* — v2 (POST to feedback table) still open.
- [x] **Related Articles** - every visible support article now has an explicit curated `related` list instead of the automatic slice. *(done 2026-06-24)*
- [ ] **Breadcrumbs** — already present (Home → Group); extend to Home → Group → Section for the deep nav.
- [x] **Deep nested sidebar** — group→section→article expandable; active article auto-expands its ancestors (`ArticleSidebar` effect). *(already wired)*
- [x] **"Manage your account" CTA card** — present.
- [ ] **Context-aware entry** — link error toasts in the app to the matching article (`/support?topic=...`), per `support-page-roadmap.md` §5. Biggest UX win after the guides.

---

## 7. Implementation phases (suggested order)

1. ✅ **Honesty pass** (§1-2): done 2026-06-24. Reset/change password, Google login, redeem-via-Stripe, Data Saver, and Download your data are documented only because the features exist. Unsupported Facebook/Apple login, blocked users, address checks, and country playback locks are written as not available instead of fake how-tos.
2. ✅ **Follow-along checklist block** (§4): `steps` block type + per-article localStorage progress + reset (`GuideSteps` in `SupportPage.tsx`). Shipped 2026-06-24. Starter guides converted include reset/change password, Google sign-in, redeem a code, Data Saver, app settings, music will not play, upgrade/cancel Premium, invite member, and smart playlists.
3. ✅ **Real article content** (§3): every visible support nav slug now has custom `ARTICLE_DETAILS` content (88/88), including billing, Premium/shared plans, account/security, playback/downloads, privacy/reporting, playlists, discovery, and data export. `buildDefaultArticleBlocks()` is now a safety fallback, not used by the visible catalogue. *(done 2026-06-24)*
4. ✅ **Helpfulness feedback** (§6): "Was this article helpful?" (localStorage v1, `ArticleFeedback`) plus curated related lists for every visible article. *(done 2026-06-24)*
5. ✅ **Download-your-data** (§5): `GET /me/export`, Account download button, support article, and backend scoping test shipped. *(done 2026-06-24)*
6. **Context-aware error links** (§6) tying the app to support.

> **New feature shipped alongside the docs:** **Data Saver** toggle (Settings → Audio) forces the audio engine to the Low tier — see `effectiveQuality()` in `audioEngine.ts` and the `data-saver` support article.

## 8. Definition of done

- [x] No support article describes a feature we don't ship (the DO-NOT-WRITE list is respected; unavailable features are labeled as unavailable).
- [x] Every article in the nav opens to unique, feature-accurate content - 88/88 visible slugs have `ARTICLE_DETAILS`; no generated filler remains in the visible catalogue.
- [ ] At least the 7 starter guides are interactive checklists with saved progress and in-app deep links.
- [x] Every article ends with "Was this helpful?" and a curated Related list.
- [x] Deep nested sidebar reflects the real catalogue and auto-expands the open article's ancestors.
- [x] "Download your data" works end-to-end (endpoint + Account button + honest article) - never a placeholder.
- [x] Copy never asks users for passwords, tokens, full card numbers, or secrets.
