# Support Page Roadmap

> **Companion doc:** [`support-content-roadmap.md`](support-content-roadmap.md) covers the article *content* — auditing placeholders vs. real features, the interactive follow-along checklists, and "Download your data". This doc stays on the *system* around support (tickets, feedback capture, article CMS).

This is a practical roadmap for turning `/support` from a polished static support surface into a useful Not Spotify help center. The ideas below are based on what the current backend actually supports: auth, profile/avatar uploads, Stripe billing, plan seats, Supabase Storage, playlists, search, playback, uploads, and admin/artist workflows.

## Current State

- `/support` exists as a standalone Spotify-style page.
- The landing page has search UI, help article groups, quick help, and nested accordions.
- Article pages use `/support?topic=...`.
- Core topics have custom content.
- Remaining topics generate category-specific content instead of generic filler.
- Existing top-bar Support links route to `/support`.

## Highest Value Additions

### 1. Real contact support flow

Add a "Contact us" article and support form that creates a ticket.

Minimum fields:
- Subject
- Category
- Description
- Account email, auto-filled when logged in
- Optional page URL
- Optional entity ID, such as playlist ID, track ID, artist ID, or upload ID
- Optional error text

Suggested backend shape:
- `SupportTicket`
- `SupportTicketMessage`
- `SupportTicketAttachment` only if storage is already ready for it

Recommended first version:
- Logged-in users can create tickets.
- Admins can list, reply, close, and tag tickets.
- Anonymous users see instructions to log in first.

Why it fits the app:
- The app already has auth, admin roles, notifications, and storage.
- This makes support real without needing a third-party helpdesk.

### 2. Article helpfulness feedback

Add "Was this helpful?" buttons at the bottom of article pages.

Track:
- Article slug
- Helpful or not helpful
- Optional reason
- User ID when logged in
- Timestamp

Useful admin view:
- Top unhelpful articles
- Search terms that led to unhelpful answers
- Articles with high traffic and low helpfulness

Why it matters:
- It tells which articles need better copy.
- It is simple and does not need AI.

### 3. No-results search capture

When support search has no article match, record the query.

Track:
- Query text
- Logged-in user ID if available
- Current route
- Timestamp

Admin use:
- Show "unanswered support searches".
- Convert frequent searches into new articles.

MVP behavior:
- If no match is found, show "No exact match" and quick links to Contact us, Account, Billing, Playback, and Uploads.

### 4. System-specific diagnostics articles

Add articles for the issues that are likely to happen in this project.

Suggested articles:
- Avatar upload failed
- Playlist cover upload failed
- Cropping image shows a black screen
- Supabase media does not load
- Supabase image colors are grey
- Premium checkout unavailable
- Stripe billing portal unavailable
- Upload audio failed
- Track download failed
- Search cannot find my content
- Artist profile verification
- Artist tour dates not showing

These should mention exact backend constraints:
- Avatar and playlist cover uploads: max 5 MB, jpg/jpeg/png/webp.
- Personal uploads: max 50 MB, mp3/m4a/aac/wav/ogg/oga/opus/flac/webm.
- Profile update fields: name, email, country.
- Country: two-letter ISO code.
- Billing plan keys: monthly, yearly, duo, family, student.
- Shared plans: invite by email, accepted member gets Premium through plan owner linkage.
- Search: tracks/artists/albums/public playlists, plus lyric phrase search for queries of at least 3 characters.
- Downloads: Premium required, except admins and managing artists.
- Storage: Supabase Storage uses public object URLs in this branch; image CORS matters for color extraction.

### 5. Context-aware help links inside errors

When the app shows an error toast, link it to the right support topic.

Examples:
- Avatar upload unsupported type -> `/support?topic=edit-your-profile`
- Stripe not configured -> `/support?topic=failed-payment-help`
- Premium required for download -> `/support?topic=download-and-offline-listening`
- Smart playlist manual edit blocked -> `/support?topic=create-and-edit-playlists`
- Search empty/no results -> `/support?topic=search-and-browse-music`
- Playback storage fetch failed -> `/support?topic=app-not-playing-music`

This is probably the best UX improvement after the support form.

### 6. Support status panel

Add a small "System status" card or page.

Checks:
- API reachable
- Auth refresh reachable
- Database connected
- Storage provider configured
- Stripe configured
- Supabase Storage bucket configured for images/audio

Scope carefully:
- Public users should only see simple green/yellow/red status.
- Admins can see detailed diagnostics and missing configuration.

This helps because the project uses Supabase, Stripe, and local dev services.

## Medium Value Additions

### 7. Admin article editor

Move support article content out of `SupportPage.tsx` into data.

Good first step:
- Keep articles in a local TypeScript data file.

Better later:
- Add `SupportArticle` table.
- Admins can edit article title, category, section, markdown body, related links, and published status.

Avoid for now:
- Full CMS complexity.
- Rich text editor.
- Versioning.

### 8. Markdown article renderer

If articles keep growing, render markdown instead of hand-built block arrays.

Needs:
- Headings
- Paragraphs
- Bullets
- Numbered lists
- Internal support links
- Callout boxes
- CTA buttons

Keep it safe:
- Do not allow raw HTML.
- Keep article content trusted/admin-only.

### 9. Deep article links from account pages

Add support links near confusing settings.

Examples:
- Account subscription card -> billing and plan articles.
- PlanMembersCard -> Family/Duo invite articles.
- Profile edit modal -> profile/avatar articles.
- Uploads page -> audio upload article.
- Artist dashboard -> artist verification/tour/upload articles.
- Search no-results page -> search article.

### 10. Better support search

Current search can route to a matching article. Improve it without needing an LLM.

Implement:
- Synonyms per article
- Keyword weighting
- Section/category matches
- Top 5 suggestions instead of instant redirect
- "Recommended topics" below the search field

Example synonyms:
- "card declined" -> failed payment help
- "profile picture" -> edit your profile
- "image crop black" -> cropping image shows a black screen
- "download song" -> download and offline listening
- "family invite" -> invite or remove Family plan members

### 11. Localized support content

The app already has English, Spanish, and French i18n coverage. Support articles are currently English-only.

Practical approach:
- Keep support article UI labels in i18n.
- Add article translations only for the top 10 support topics first.
- Fall back to English for missing translated article bodies.

## Lower Priority Additions

### 12. Ticket attachments

Allow users to attach screenshots to support tickets.

Constraints:
- Store through the existing storage provider.
- Limit file size.
- Allow png, jpg, jpeg, webp.
- Never execute or preview arbitrary file types.

Useful but not necessary for MVP.

### 13. Support notification workflow

Use existing notifications when:
- Admin replies to a ticket.
- Ticket is closed.
- Support asks for more info.

This fits the app because notifications already exist.

### 14. Article version history

Only useful if multiple admins edit support content.

Track:
- Editor
- Timestamp
- Old body
- New body
- Published state

Skip until support articles move into the database.

### 15. Guided troubleshooters

Add small wizard flows for common issues.

Good candidates:
- "Image upload failed"
- "Payment failed"
- "Music will not play"
- "Cannot join Family plan"

Keep each wizard simple:
- 3 to 5 questions
- Ends at a matching article or support ticket

## Suggested Next Implementation Order

1. Add context-aware error links to current toasts.
2. Add "Contact us" as a real support ticket flow.
3. Add no-results search capture.
4. Add helpfulness feedback.
5. Add the missing system-specific articles listed above.
6. Move support article data into its own file.
7. Add an admin ticket inbox.
8. Add system status for admins.
9. Improve search with synonyms and ranked suggestions.
10. Add localized article bodies for the top topics.

## Acceptance Criteria For A Good Support Page

- Every visible article opens and has unique, relevant content.
- Articles mention real app limits instead of vague product wording.
- The user can contact support when an article is not enough.
- Common app errors link directly to a relevant support article.
- Admins can see what users searched for but could not find.
- Billing support clearly distinguishes app state from Stripe state.
- Upload support clearly states accepted file types and size limits.
- Storage support mentions Supabase Storage and CORS behavior.
- Privacy/support copy never asks users to send passwords, tokens, full card numbers, or secrets.

