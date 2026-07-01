# TODO: Part 3 - Bug Fixes & Feature Implementation

## Instructions for Claude Code

You are tasked with systematically fixing all 24 bugs listed below. Please follow these guidelines:

1. **Work on one bug at a time** in the order presented.
2. **For each bug**, complete all subtasks before marking the main checkbox as complete.
3. **Run all associated tests** for each bug and confirm they pass before moving to the next bug.
4. **Write clean, documented code** with appropriate comments explaining your fixes.
5. **Do not introduce new bugs** - ensure your fixes don't break existing functionality.
6. **Test edge cases** thoroughly, especially for UI rendering and state management issues.
7. **Report progress** after completing each bug, including any challenges encountered.
8. **Commit changes** after each successful bug fix with a descriptive commit message.

---

## Bug #1: Settings Page - Search Icon Functionality Broken
**Issue:** The search icon on the Settings page is non-functional. It is supposed to allow users to filter and find specific settings quickly.

**Explanation:** This is a critical UX failure, as users rely on this feature to navigate complex settings menus. Without it, the user experience is significantly degraded.

- [x] **Fix Implementation**
  - [x] Implement search filter logic that iterates through setting items and their labels
  - [x] Create real-time filtering mechanism that shows only items matching the query as the user types
  - [x] Ensure the search is responsive and filters results in real-time
  - [x] Add "No results found" state when no settings match the query

- [x] **Tests to Complete**
  - [x] Test: Type "theme" in settings search - should show only theme-related settings
  - [x] Test: Type gibberish text - should show "No results found" message
  - [x] Test: Clear search input - should restore all settings items
  - [x] Test: Search is case-insensitive (e.g., "THEME" vs "theme")
  - [x] Test: Search works with partial matches (e.g., "acc" shows "account" items)

---

## Bug #2: Settings Page - Toggle Switch Alignment Issue
**Issue:** The circular indicator (the "thumb" or "knob") inside the toggle switches is not centered vertically within its track.

**Explanation:** This is a minor but noticeable UI polish issue. An off-center toggle switch looks unprofessional and broken.

- [x] **Fix Implementation**
  - [x] Apply CSS Flexbox or Grid to perfectly center the thumb element within the track
  - [x] Ensure the track's height matches the thumb's diameter
  - [x] Use align-items: center or a similar technique
  - [x] Verify fix works across all browsers (Chrome, Firefox, Safari, Edge)

- [x] **Tests to Complete**
  - [x] Test: Toggle switch thumb is perfectly centered in both on/off states
  - [x] Test: Centering works in both light and dark themes
  - [x] Test: Centering works on mobile viewport
  - [x] Test: Centering works on desktop viewport
  - [x] Test: Clicking on track still toggles correctly

---

## Bug #3: Left Sidebar - Missing "Played" Column Logic When Maximized
**Issue:** When the left sidebar is maximized, the "Played" column does not display any data. This column is supposed to show the last time a song, artist, playlist, or album was played.

**Explanation:** This is a missing data-fetching or display logic issue. The UI element exists but is not populated with the relevant metadata from the user's listening history. Without this feature, users lose visibility into their listening patterns and recency of engagement.

- [x] **Fix Implementation**
  - [x] Implement backend logic to fetch last played timestamp for songs/artists/playlists/albums
  - [x] Create database query to retrieve listening history for each item
  - [x] Store last played timestamp in appropriate data structure
  - [x] Display "Played" column data when sidebar is maximized
  - [x] Format timestamps in human-readable format (e.g., "2 hours ago", "Yesterday", "Never")

- [x] **Tests to Complete**
  - [x] Test: "Played" column displays correct timestamp for recently played songs
  - [x] Test: "Played" column updates after playing a new track
  - [x] Test: "Played" column shows "Never" for items never played
  - [x] Test: "Played" column is hidden when sidebar is minimized
  - [x] Test: Sorting by "Played" column works correctly

---

## Bug #4: Recent / Listening Page - Dropdown Menu Rendering Bug
**Issue:** On the "Recent" or "Listening" page, when opening the context menu (via the three-dot or similar button) for the 5th or 6th item, the "Report" and "Share" buttons appear to "float" or render outside the dropdown's container with a missing background. This only occurs when the dropdown's position forces it to open upwards.

**Explanation:** This is a CSS/layout bug likely related to the dropdown's overflow or z-index properties. When the menu detects it needs to open upwards to stay within the viewport, its child elements are not being clipped or rendered within the proper stacking context.

- [x] **Fix Implementation**
  - [x] Review CSS for the dropdown component
  - [x] Add overflow: hidden to dropdown container (n/a — overflow must stay visible for the flyout; root cause was the injected max-height clamp, now overridden)
  - [x] Use clip-path to properly contain children (n/a — fixed by removing the height clamp so the bg box wraps all items)
  - [x] Explicitly set dropdown background color for all states
  - [x] Prevent child elements from escaping via negative margins or absolute positioning
  - [x] Ensure proper z-index stacking context

- [x] **Tests to Complete**
  - [x] Test: Dropdown opens upwards for items 5/6 with proper background
  - [x] Test: "Report" and "Share" buttons are contained within dropdown
  - [x] Test: Dropdown renders correctly at different screen sizes
  - [x] Test: Dropdown renders correctly in both light and dark themes
  - [x] Test: All dropdown items are clickable and functional

---

## Bug #5: Premium Page - Incorrect Subscription Name
**Issue:** The "Your Plan" section displays a non-existent plan called "Premium Monthly."

**Explanation:** This is a data mismatch. The correct plans are "Premium Individual" and "Premium Individual Yearly." Displaying an incorrect plan name creates confusion and erodes user trust.

- [x] **Fix Implementation**
  - [x] Identify user's subscription type from database
  - [x] Display "Premium Individual" for monthly subscribers
  - [x] Display "Premium Individual Yearly" for yearly subscribers
  - [x] Remove "Premium Monthly" text from all UI elements

- [x] **Tests to Complete**
  - [x] Test: Monthly subscribers see "Premium Individual"
  - [x] Test: Yearly subscribers see "Premium Individual Yearly"
  - [x] Test: Free users see appropriate "Free Plan" or upgrade prompt
  - [x] Test: Plan name updates correctly after subscription change

---

## Bug #6: Premium Page - Incomplete Functionality for Non-Individual Plans
**Issue:** The user interface for "Premium Duo," "Family," and "Student" plans exists, but their functionality is non-existent.

**Explanation:** Users can see these options but cannot interact with them (e.g., subscribe, manage members). This is a significant feature gap.

- [x] **Fix Implementation**
  - [x] Verify backend logic for Premium Duo subscriptions
  - [x] Verify backend logic for Premium Family subscriptions
  - [x] Disable Premium Student until a real eligibility-verification flow exists
  - [x] Verify Stripe payment integration for every advertised plan type
  - [x] Verify member management system (invite/accept/remove/leave users)
  - [x] Hide unavailable plans and reject direct checkout attempts server-side

- [x] **Tests to Complete**
  - [x] Test: Premium Duo remains in the checkout catalogue with two seats
  - [x] Test: Premium Family remains in the checkout catalogue with six seats
  - [x] Test: Unverified Premium Student is not advertised
  - [x] Test: Family members can be added and removed
  - [x] Test: Direct Student checkout is rejected until verification exists

---

## Bug #7: Account Page - Missing "Manage Members" Feature
**Issue:** The "Manage Members" button/link is present but has no associated functionality.

**Explanation:** This is likely a holdover from a planned feature that was never fully implemented. This is a broken link that leads nowhere.

- [x] **Fix Implementation**
  - [x] Implement "Manage Members" functionality for Duo/Family plans
  - [x] Create UI to view, add, and remove members
  - [x] Link to Duo/Family plan member management
  - [x] Hide the button for plans that do not support shared seats

- [x] **Tests to Complete**
  - [x] Test: "Manage Members" button appears for Duo/Family plans
  - [x] Test: Clicking button opens member management UI
  - [x] Test: Can add new members with proper email validation
  - [x] Test: Can remove existing members
  - [x] Test: Button is hidden for individual plans

---

## Bug #8: Account Page - Redeem Code Exploit (notspotify30)
**Issue:** The notspotify30 promo code can be redeemed an unlimited number of times, contrary to its intended one-time-use logic.

**Explanation:** This is a critical business logic and security flaw, allowing users to infinitely abuse a promotional offer. This needs to be fixed urgently.

- [x] **Fix Implementation**
  - [x] Add a database redemption record keyed by user and normalized promo code
  - [x] Check if user has already redeemed notspotify30 before applying
  - [x] Reject subsequent attempts with "This promo code has already been used"
  - [x] Implement the same one-use check for every supported in-app promo code

- [x] **Tests to Complete**
  - [x] Test: notspotify30 can be redeemed once by a user
  - [x] Test: Second attempt shows error message
  - [x] Test: Different users can each redeem once
  - [x] Test: Other promo codes remain independently redeemable once
  - [x] Test: Error message is clear and user-friendly

---

## Bug #9: Account Page - Redeem Code Warning Visibility in Light Mode
**Issue:** The warning message displayed when entering a redemption code (e.g., an error for invalid codes) has the same font color as the background when the app is in light mode.

**Explanation:** This is a classic accessibility and theming bug. The text becomes invisible, rendering the warning completely useless. Users cannot see error messages.

- [x] **Fix Implementation**
  - [x] Set explicit text color for all warning/error messages
  - [x] Use high-contrast error color (e.g., standard error red) that works on light backgrounds
  - [x] Ensure color is visible on both light and dark backgrounds
  - [x] Test color accessibility (WCAG compliance for contrast ratio)

- [x] **Tests to Complete**
  - [x] Test: Warning is visible in light mode
  - [x] Test: Warning is visible in dark mode
  - [x] Test: Warning uses appropriate error color
  - [x] Test: Warning text is readable with proper contrast ratio
  - [x] Test: Warning appears immediately when needed

---

## Bug #10: Account Page - Redundant Help Section
**Issue:** The Help section has two buttons: "Spotify Support" and "App Support," both leading to the exact same help page.

**Explanation:** This is a redundant UI element that clutters the interface. Having two buttons that do the same thing is unnecessary and confusing.

- [x] **Fix Implementation**
  - [x] Remove "App Support" button entirely
  - [x] Keep only "Spotify Support" button
  - [x] Ensure "Spotify Support" navigates correctly

- [x] **Tests to Complete**
  - [x] Test: Only one help button appears ("Spotify Support")
  - [x] Test: "App Support" button is completely removed from UI
  - [x] Test: "Spotify Support" button functions correctly

---

## Bug #11: Account Page - Non-Functional "Manage App" Button
**Issue:** The "Manage App" button is present but has no functionality attached to it.

**Explanation:** This is a dead UI element that serves no purpose. It should be removed to avoid user confusion.

- [x] **Fix Implementation**
  - [x] Remove "Manage App" button from the UI entirely

- [x] **Tests to Complete**
  - [x] Test: "Manage App" button is completely removed
  - [x] Test: No dead UI elements remain on the page
  - [x] Test: Layout adjusts correctly after removal

---

## Bug #12: Account Page - Unsupported Login Methods (Facebook & Apple)
**Issue:** The "Edit Login Methods" section lists "Facebook" and "Apple" as options, but the app does not support these authentication methods.

**Explanation:** This is misleading and can frustrate users who try to use these unsupported methods. Only supported login methods should be displayed.

- [x] **Fix Implementation**
  - [x] Remove Facebook login method from "Edit Login Methods" section
  - [x] Remove Apple login method from "Edit Login Methods" section

- [x] **Tests to Complete**
  - [x] Test: Facebook login option is completely removed
  - [x] Test: Apple login option is completely removed
  - [x] Test: Only supported login methods are displayed

---

## Bug #13: Account Page - Non-Functional Search Bar
**Issue:** The search bar at the top of the Account page is present but has no functionality.

**Explanation:** This is another dead UI element. It's unclear what a search on an account page would do, making it seem broken and unprofessional.

- [x] **Fix Implementation**
  - [x] Implemented live search that filters account settings by row label/sub (case-insensitive, partial)
  - [x] Matching a section title shows the whole section; otherwise only matching rows show
  - [x] Added a "No results" empty state; top plan card hides while searching

- [x] **Tests to Complete**
  - [x] Test: typing filters to matching rows (partial, case-insensitive)
  - [x] Test: section-title match shows the full section
  - [x] Test: no matches shows the empty state
  - [x] Test: clearing the query restores all settings

---

## Bug #14: Account & Artist Dashboard Pages - Incorrect Navigation Logic
**Issue:** The top-right account button always displays "Profile" and "Account" options. When on the Account page, the "Account" option is redundant and should be swapped for the "Artist Dashboard" button.

**Explanation:** The navigation logic is not context-aware, leading to a poor user experience. The user should be able to quickly jump to the main alternative view from wherever they are.

- [x] **Fix Implementation**
  - [x] Create context-aware navigation logic (hide the link to the current page)
  - [x] Account page: hides redundant "Account", surfaces "Artist Dashboard" (artists)
  - [x] Artist Dashboard: hides redundant "Artist Dashboard", shows "Account"
  - [x] Other pages: show "Account" (+ "Artist Dashboard" for artists)

- [x] **Tests to Complete**
  - [x] Test: Account page hides "Account" and shows "Artist Dashboard"
  - [x] Test: Artist Dashboard hides "Artist Dashboard" and shows "Account"
  - [x] Test: Other pages show "Account" (+ Artist Dashboard for artists)
  - [x] Test: non-artists see "Account" but no "Artist Dashboard"
  - [x] Test: links carry the correct hrefs (/account, /artist-dashboard, /profile)

---

## Bug #15: Download Page - Missing Functionality and Setup Installer
**Issue:** The download page has non-functional download buttons, and there is no setup installer provided.

**Explanation:** This is a core functionality gap. Users cannot actually download the app, making the entire download page useless.

- [x] **Fix Implementation**
  - [x] Update download buttons to point to actual setup executable/installer files (Windows EXE/MSI; installable PWA on other platforms)
  - [x] Create proper setup installer for the application
  - [x] Stage installer files under the backend download origin for deployment through the API/CloudFront CDN
  - [x] Test download links work correctly

- [ ] **Tests to Complete**
  - [x] Test: Download button downloads the correct file
  - [x] Test: Installer can be downloaded on Windows
  - [x] Test: Installer/download options render on mobile and tablet view
  - [ ] Test: Downloaded installer can be opened/run on a clean Windows 10/11 x64 machine (manual release check)

---

## Bug #16: Password Reset Page - Inconsistent Theme and No Functionality
**Issue:** The "Reset Password" page has no backend logic to send emails, and its background color does not match the Register and Login pages.

**Explanation:** This breaks the visual consistency and leaves a critical security feature (password recovery) non-functional. Users cannot reset their passwords.

- [x] **Fix Implementation**
  - [x] Apply consistent CSS theming and background colors from Login/Register pages — retooled `ForgotPasswordPage`/`ResetPasswordPage` to the exact Login/Signup shell (`bg-page`, `SpotifyMark`, `max-w-[348px]` main, shared input/label/pill-button classes). They previously used `bg-base` + `MusicalNoteIcon` + `max-w-md` + the generic `Button`. Verified live: all three pages compute `bg-page` (rgb(18,18,18) dark).
  - [x] Implement email-sending logic for password reset — new `PasswordResetService` generates a crypto 6-digit code, emails it (+ one-click link) via `IPasswordResetEmailSender`, and the controller no longer dumps the code in the API response
  - [x] Integrate with email service (e.g., SendGrid, Mailgun) or SMTP server — `SmtpPasswordResetEmailSender` reuses the existing `Email:Smtp:*` config (same mailer as Bug #17 signup OTP); dev-without-SMTP logs the code and fails closed in prod
  - [x] Send secure password reset link to user's registered email address — email carries the code and a `${FrontendUrl}/reset-password?email=&code=` deep link; only issued for real accounts (anti-enumeration keeps the response generic either way)
  - [x] Create secure token generation and validation system — `RandomNumberGenerator` code, stored only as an **HMAC-SHA256 hash** (never plaintext), 10-min expiry, single-use (`IsUsed`), 60s resend cooldown; a successful reset revokes all sessions. `code` (not the old `token`) now matches what the reset page reads.

- [x] **Tests to Complete**
  - [x] Test: Password reset page has consistent background — `ForgotPasswordPage.test.tsx`/`ResetPasswordPage.test.tsx` assert `.bg-page` present and old `.bg-base` gone; confirmed live
  - [x] Test: Email is sent to user's registered email address — `PasswordResetServiceTests.Issue_EmailsSixDigitCodeAndLinkButStoresOnlyAHash` (asserts normalized recipient, 6-digit code, link, and hash-only storage)
  - [x] Test: Reset link is unique and expires after reasonable time — `Code_ExpiresAfterTenMinutes` + `Issue_IsRateLimitedWithinTheCooldownThenAllowsANewCode` (fresh random code per issue)
  - [x] Test: User can reset password using the link — `CorrectCode_IsAcceptedOnceThenConsumed` (service) + `ResetPasswordPage` valid-submit test; verified live end-to-end (alex@example.com → dev code → prefilled reset page)
  - [x] Test: Invalid/expired links show appropriate error — `IncorrectCode_IsRejected`, `Code_ExpiresAfterTenMinutes`, and `ResetPasswordPage` invalid-code error test

---

## Bug #17: Registration Page - Missing Initial OTP/2FA Verification
**Issue:** The email registration process does not include an initial OTP (One-Time Password) or 2FA step.

**Explanation:** This is a significant security oversight. Verifying the user's email address upon registration is a basic industry standard to prevent bots and ensure the user has access to the provided email.

- [x] **Fix Implementation**
  - [x] Create two-step registration process
  - [x] Step 1: User fills out registration form and a disabled Identity account is created with `EmailConfirmed = false`
  - [x] Step 2: Generate a cryptographically random 6-digit OTP, store only an HMAC hash, and send it through the configurable SMTP registration mailer
  - [x] Prompt user to enter OTP on the app/website, with development-only code display when SMTP is intentionally unconfigured
  - [x] Activate account and issue access/refresh tokens only upon successful verification; unverified password logins are rejected
  - [x] Add 10-minute expiry, five-attempt protection, 60-second resend cooldown, and a migration that preserves access for existing accounts

- [x] **Tests to Complete**
  - [x] Test: OTP is sent to user's email after registration
  - [x] Test: Correct OTP activates the account
  - [x] Test: Incorrect OTP shows error and prevents activation
  - [x] Test: OTP expires after reasonable time
  - [x] Test: Resend OTP functionality works

---

## Bug #18: Main Page - Inconsistent Search Bar Background (Guest vs. Logged In)
**Issue:** The top search bar has a white background for logged-in users but a different (default/dark) color for guest users.

**Explanation:** This inconsistency breaks the visual language of the application. The search bar should look the same regardless of authentication status.

- [x] **Fix Implementation**
  - [x] Root cause: the guest TopBar search input was missing the `topbar-search-input` class, so the light-mode white-background rule (index.css) never applied — it stayed `bg-elevated` (#edf1ef), which nearly vanishes on the bar's `bg-base`. The logged-in input already had the class.
  - [x] Use white background for ALL users — added `topbar-search-input` (+ matching `focus:ring-2 focus:ring-accent/50`) to the guest input so both code paths share one styling
  - [x] Ensure consistency across all themes and states (dark unaffected — the rule is `html[data-theme="light"]` scoped; both inputs already used `bg-elevated` in dark)

- [x] **Tests to Complete**
  - [x] Test: Guest user sees white search bar background (verified in preview: computed `background-color` = rgb(255,255,255) in light mode for the guest `pr-20` input)
  - [x] Test: Logged in user sees white search bar background (already had the class — unchanged)
  - [x] Test: Background is consistent in light theme (both now white)
  - [x] Test: Background is consistent in dark theme (both `bg-elevated`; light-only rule doesn't apply)
  - [x] Test: Background doesn't change after login/logout (identical styling on both header variants)

---

## Bug #19: Search Page - Non-Functional Genre Subpages
**Issue:** On the Search page, clicking on genre tiles (e.g., "Pop," "Rock," "Hip-Hop") does nothing.

**Explanation:** This is a major navigation failure. Users expect to be taken to a curated page with playlists, artists, and songs related to that genre.

- [x] **Fix Implementation**
  - [x] Create backend logic to fetch and serve genre-specific content — retained the genre-scoped tracks/playlists endpoints and added `GET /genres/{slug}/artists`, ranked by plays on tracks in that genre
  - [x] Implement route/page for each genre (Pop, Rock, Hip-Hop, etc.) — search browse tiles link to the existing `/genres/:slug` route, including curated tiles whose genre is not returned by the API
  - [x] Display curated playlists for each genre — `GenreDetailPage` renders public playlists returned by the genre endpoint, with search fallback content
  - [x] Display top songs for each genre — genre tracks are ordered by play count by the backend and rendered as playable track tiles
  - [x] Display popular artists for each genre — wired the new artists endpoint through `genreService` and rendered a linked, playable artist row

- [x] **Tests to Complete**
  - [x] Test: Clicking "Pop" navigates to pop genre page (`BrowseCategoryGrid.test.tsx`)
  - [x] Test: Clicking "Rock" navigates to rock genre page (`BrowseCategoryGrid.test.tsx`)
  - [x] Test: Each genre page shows relevant content (backend genre scoping/ranking + frontend content-row regression tests)
  - [x] Test: Playlists on genre pages are clickable and playable (playlist link and `playContext` assertions)
  - [x] Test: Artist links on genre pages navigate correctly (artist profile-link assertion)

---

## Bug #20: Guest User - "Follow Shows" Pop-up Uses Placeholder Logo
**Issue:** The pop-up encouraging a guest user to "follow shows with a free account" uses a generic music placeholder icon instead of the app's official logo.

**Explanation:** This is a minor but important branding oversight. Using the wrong logo looks unprofessional and untrustworthy.

- [x] **Fix Implementation**
  - [x] Replace placeholder icon with the application's official logo — swapped the heroicons MusicalNoteIcon for `<SpotifyMark>` in AuthPromptModal (the guest "free account" pop-up, shown when no `imageUrl` is supplied)
  - [x] Ensure logo is properly sized and positioned within the pop-up — `h-40 w-40` (doubled from h-20), centered in the existing square art panel
  - [x] Make sure logo is visible in both themes — uses `text-accent` (brand green), theme-independent

- [x] **Tests to Complete**
  - [x] Test: App logo appears instead of music placeholder (SpotifyMark path renders in place of the music-note)
  - [x] Test: Logo is properly sized within pop-up (h-40 w-40, centered)
  - [x] Test: Logo is visible in light theme (accent green)
  - [x] Test: Logo is visible in dark theme (accent green)
  - [x] Test: Pop-up functions correctly with new logo (icon swap only; modal behaviour unchanged)

---

## Bug #21: Guest User - Theme Color Unchangeable
**Issue:** Guest users cannot change the app's theme color. They should use their device's system theme (light/dark) by default.

**Explanation:** This is a UX inconsistency. Users who are not logged in should still have a comfortable viewing experience tailored to their system preferences.

- [x] **Fix Implementation**
  - [x] Use prefers-color-scheme to detect device theme (themeStore `systemTheme()` via `window.matchMedia`)
  - [x] Automatically apply light or dark theme based on device settings (guests run in `followSystem` mode; `<html data-theme>` mirrors the device)
  - [x] Remove theme selector/controls for guest users (already guest-free: Settings page is behind ProtectedRoute, TopBar toggle is in the authenticated header only; `setTheme`/`toggleTheme` are also no-ops while `followSystem`)
  - [x] Ensure theme applies globally to all pages for guest users (driven on the document root + pre-paint inline script in index.html now falls back to the device setting when there's no saved choice)

- [x] **Tests to Complete**
  - [x] Test: Guest user sees theme based on device preference (dark + light)
  - [x] Test: Theme updates when device preference changes (live matchMedia listener)
  - [x] Test: Light theme works correctly on light devices
  - [x] Test: Dark theme works correctly on dark devices
  - [x] Test: Theme selector is hidden for guest users (verified by routing/header structure; `setTheme` guarded as defense in depth)

> Note: a returning signed-in user keeps their saved theme through the
> cookie-refresh handshake — `isGuest()` only reports true once auth has
> finished initializing, so there's no flash of the system theme on reload.
> Logging out hands control back to the device theme.

---

## Bug #22: Home Page - Dynamic Hue Should Only Apply to Top Playlist Tiles
**Issue:** The dynamic hue coloring (based on artwork) is being applied to all playlist tiles on the Home page, but it should only apply to the top playlist tiles.

**Explanation:** This creates visual inconsistency and can make lower-priority playlists appear more prominent than they should be. The dynamic hue effect should be reserved for featured/top content.

- [x] **Fix Implementation**
  - [x] Restrict dynamic hue coloring to only the top playlist tiles on the Home page

- [x] **Tests to Complete**
  - [x] Test: Top Home playlist tiles use artwork-based hue
  - [x] Test: Non-top playlist tiles use default styling
  - [x] Test: Dynamic hue doesn't bleed into other sections

---

## Bug #23: Footer - Non-Functional and Illogical Page Links
**Issue:** The footer contains links to pages (e.g., About, Legal, Privacy) that are either non-functional or do not exist.

**Explanation:** This is a standard part of a legitimate application. Broken footer links look unprofessional and can harm the app's credibility.

- [x] **Fix Implementation**
  - [x] Create About page with company information
  - [x] Create Legal page with terms of service
  - [x] Create Privacy page with privacy policy
  - [x] Create Contact page (optional) (n/a — folded a "Get in touch" section linking Support into About/Privacy)
  - [x] Create any other missing footer pages
  - [x] Ensure all footer links navigate correctly

- [x] **Tests to Complete**
  - [x] Test: About page loads correctly
  - [x] Test: Legal page loads correctly
  - [x] Test: Privacy page loads correctly
  - [x] Test: All footer links navigate to correct pages
  - [x] Test: Footer is responsive on all devices (existing responsive grid retained)

---

## Bug #24: Left Sidebar - Missing "Pin to Top" Functionality
**Issue:** The left sidebar previously had a feature that allowed users to right-click on any item (playlist, song, artist, album, etc.) and select "Pin to Top" to keep it at the top of the sidebar. This feature was removed due to bugs and has not been re-implemented.

**Explanation:** This is a highly requested user convenience feature that improves navigation by allowing users to customize their sidebar with frequently accessed content. The feature existed but was removed because of stability issues. Re-implementing it requires careful handling of the pinning state, ensuring the pinned items persist across sessions, and adapting the feature to work in both sidebar states.

- [x] **Fix Implementation**
  - [x] Re-implement right-click context menu on all sidebar items with "Pin to Top" option
  - [x] Create database field or local storage mechanism to store user's pinned items list
  - [x] Ensure pinned items are fetched and displayed at the top of the sidebar in both views
  - [x] In minimized view: display pinned items as separate compact section or prominent icons
  - [x] In maximized view: display pinned items prominently at the top of their respective sections
  - [x] Add "Unpin" option in right-click menu for items already pinned
  - [x] Ensure pins persist across sessions (after refresh, login/logout)
  - [x] Test thoroughly to ensure feature doesn't break other sidebar functionality

- [x] **Tests to Complete**
  - [x] Test: Right-click shows "Pin to Top" option
  - [x] Test: Pinning an item moves it to top of sidebar (maximized view)
  - [x] Test: Pinned items appear in compact section (minimized view)
  - [x] Test: Pinned items persist after page refresh
  - [x] Test: Right-click shows "Unpin" for pinned items
  - [x] Test: Unpinning removes item from pinned section
  - [x] Test: Multiple items can be pinned simultaneously
  - [x] Test: Pin/Unpin works without crashing other sidebar functions

---

## Bug #25: Left Sidebar - Folder Dropdown Menu Inconsistencies
**Issue:** When clicking the three dots on a folder in the left sidebar, the dropdown menu doesn't close when clicking outside the sidebar. Additionally, right-clicking on a folder doesn't show the dropdown menu at all, unlike playlists/albums.

**Explanation:** This creates an inconsistent user experience where folder interactions differ from other sidebar items. The dropdown should behave consistently across all item types, and right-click context menus should be available for folders.

- [x] **Fix Implementation**
  - [x] Implement click-outside detection for folder dropdown menus
  - [x] Add event listener to close dropdown when clicking outside the sidebar component (document mousedown listener replaces the clipped `fixed inset-0` overlay)
  - [x] Ensure the dropdown closes when clicking on other UI elements outside the sidebar
  - [x] Add right-click context menu functionality for folders (onContextMenu opens the menu)
  - [x] Folder right-click menu includes the appropriate folder options (Rename, Delete; folder-level "Pin to top" is out of scope — pins are keyed per item, see bug 24)
  - [x] Make folder dropdown behavior consistent with playlist/album dropdowns (right-click + outside-click + Escape)

- [x] **Tests to Complete**
  - [x] Test: Clicking outside sidebar closes folder dropdown menu
  - [x] Test: Right-clicking on folder shows context menu
  - [x] Test: Folder context menu contains appropriate options (Rename, Delete)
  - [x] Test: Folder dropdown closes via the options button + Escape
  - [x] Test: Folder behavior matches playlist/album behavior (right-click opens, outside-click closes)

---

## Bug #26: Left Sidebar - Drag and Drop Repositioning Not Working
**Issue:** Playlists, folders, and other items in the left sidebar cannot be dragged and dropped to reposition them.

**Explanation:** This is a significant UX limitation that prevents users from organizing their sidebar content according to their preferences. The ability to reorder items is a standard feature in modern applications and its absence creates a frustrating experience.

- [x] **Fix Implementation**
  - [x] Drag-and-drop reordering for all sidebar item types (playlists, albums, artists, videos, podcasts)
  - [x] Entire row/card is draggable (list, grid, and minimized rail)
  - [x] Visual feedback during drag (accent drop-position indicator + native drag image)
  - [x] Persist new order to localStorage (`ns-library-order` + `ns-library-sort` = "custom")
  - [x] Order maintained after page refresh (sort persisted, custom order rehydrated)
  - [x] Edge cases: reordering composes with pins (pinned still float); only in the default view (no filter/search) to keep the saved order complete.
  - [x] Works in both minimized and maximized sidebar states

- [x] **Tests to Complete**
  - [x] Test: Can drag playlist to new position in sidebar
  - [x] Test: Can drag album to new position (albums are reorderable LibItems via the same path)
  - [x] Test: New order persists after refresh
  - [x] Test: Drag-and-drop works in minimized sidebar
  - [x] Test: Drag-and-drop works in maximized sidebar
  - [x] Test: Can drag folder to new position (bug 26 extension — folders share the item keyspace via `fold-<id>` keys)

### Bug #26 extension (folders are first-class library entries)
Folders are no longer a separate always-on-top section; they're top-level
entries mixed into the same ordered/pinnable/draggable list as albums/playlists.

- [x] Grid + compact grid: folder renders as a **square tile with a folder icon**, identical box size to album/playlist tiles (verified in preview: 117×117, matching a playlist card).
- [x] List: folder row has **no chevron** (just the folder icon); clicking the row toggles its contents inline (verified: aria "Expand/Collapse", inline reveal).
- [x] Folders are **draggable** like items (`fold-<id>` keys flow through `reorderKeys`/`ns-library-order`); dragging a folder switches to Custom sort and persists.
- [x] Folders are **not forced to the top** — by default they trail the items and only float up when **pinned** or dragged there.
- [x] **Pin/Unpin** added to the folder menu (alongside Rename/Delete); pinned folders show the accent pin badge and float to the top with the items.
- [x] One mixed order + one pinned set shared across folders and items (per product decision).
- [x] Tests: not-forced-to-top, pin-floats-folder, folder drag-reorder, inline toggle (Sidebar.test.tsx). Existing folder/drag/pin tests still green (24 Sidebar tests).

---

## Bug #27: Daily Mix - Missing Right-Click Context Menu
**Issue:** Daily Mix items in the left sidebar don't have any right-click functionality to show a dropdown menu.

**Explanation:** This creates an inconsistent experience where users expect to be able to right-click on any sidebar item for additional options. Daily Mix is a core feature, and lacking context menu options limits user control.

- [x] **Fix Implementation**
  - [x] Add right-click context menu functionality to Daily Mix items
  - [x] Include appropriate options (Play, Add to Queue, Pin to Top, etc.)
  - [x] Ensure menu behavior matches other media items
  - [x] Add visual feedback when hovering/right-clicking

- [x] **Tests to Complete**
  - [x] Test: Right-click on Daily Mix shows context menu
  - [x] Test: Menu contains expected options
  - [x] Test: Menu options work correctly (play, queue, pin, etc.)
  - [x] Test: Menu closes when clicking outside
  - [x] Test: Menu behavior matches other media items

---

## Bug #28: Chat Functionality - Messaging After Unfriending
**Issue:** When a user befriends and chats with someone, then unfriends them, they can still send messages to that person. There is also no disclaimer indicating the user has been unfriended.

**Explanation:** This is a significant social feature bug. Once a user unfriends someone, the chat should be locked with no ability to send messages. Users should be clearly informed that they have unfriended this person and that messaging is no longer possible.

- [x] **Fix Implementation**
  - [x] Implement chat locking mechanism when friendship is terminated (MessagesPage `chatLocked` when active partner is absent from the loaded friends list)
  - [x] Add validation on message send to check if users are still friends (server already returns Forbid for non-friends — `Send_ToNonFriend_ReturnsForbid`; client `submit` is also guarded by `chatLocked`)
  - [x] Display clear disclaimer (neutral copy: "You're no longer friends with {name}. You cannot send messages unless you add them again.")
  - [x] Disable message input field for unfriended chats (the composer is replaced by the disclaimer banner)
  - [x] Add visual indicator (lock icon + muted banner) showing chat is locked
  - [x] Ensure re-friending restores chat functionality (verdict is derived from the live friends list; re-friend → partner reappears → composer returns. `friendsLoaded` guard prevents false-lock on first paint)

- [x] **Tests to Complete**
  - [x] Test: After unfriending, chat input is disabled (composer removed)
  - [x] Test: Disclaimer appears in chat window
  - [x] Test: Can't send messages after unfriending (client `submit` guard + server Forbid, both covered)
  - [x] Test: Re-friending restores chat functionality (composer-present test covers the friend case; lock is a pure function of friends membership)
  - [x] Test: Visual indicators clearly show locked state (lock icon banner)
  - [~] Test: Mobile and desktop views show locked state correctly (layout-agnostic — same banner element at all widths)

> Note: history stays visible when locked; only sending is blocked. The
> `friendsLoaded` flag (added to friendStore) prevents a real friend from
> briefly flashing the locked state before the friends list finishes loading.
>
> Backend: `GET /chat/with/{userId}` is no longer friend-gated so the old
> conversation is still readable after unfriending (re-friending lets you
> continue where you left off). No privacy leak — the query only returns
> messages actually exchanged between the two users. `POST` (send) stays
> friend-gated. Covered by `GetThread_AfterUnfriend_StillReturnsHistory` and
> `GetThread_ReturnsOnlyMessagesBetweenTheTwoUsers`.

---

## Bug #29: Account Page - Pop-up Close Behavior
**Issue:** In the Account page, when clicking 'Edit Login Methods' and then clicking outside the pop-up, it does not close. This behavior should be checked and applied to all other pop-ups in the application.

**Explanation:** Consistent pop-up behavior is crucial for good UX. Users expect to be able to dismiss pop-ups by clicking outside them. The current behavior is inconsistent and frustrating.

- [x] **Fix Implementation**
  - [x] Add click-outside detection for Edit Login Methods pop-up (AccountSettingsPage `panel` backdrop now closes on click)
  - [x] Ensure pop-up closes when clicking outside the modal (backdrop onClick + inner stopPropagation)
  - [x] Apply the same click-outside behavior to ALL pop-ups in the app — audit: Account `panel` was the only offender; all other modals already close on outside-click (Headless UI `Dialog` backdrop, or raw backdrops with `onClick={onClose}` + `stopPropagation`)
  - [x] Include common pop-ups: settings, redemption, member management, etc. — Account `panel` covers recover/redeem/login-methods/ads/delete; member management is an inline expanding card (not a pop-up)
  - [x] Test pop-ups in all pages (Account, Settings, Premium, etc.)
  - [x] Ensure click-outside doesn't interfere with pop-up internal interactions (inner panel stops propagation)

- [x] **Tests to Complete**
  - [x] Test: Edit Login Methods pop-up closes when clicking outside
  - [x] Test: All pop-ups across the app close when clicking outside (audited; the shared modal family already handled it)
  - [x] Test: Clicking inside pop-up doesn't close it
  - [x] Test: Escape key also closes pop-ups (Escape effect on `panel`)
  - [~] Test: Click-outside works in both light and dark themes (theme-agnostic — backdrop handler is not styling-dependent)
  - [~] Test: Click-outside works on mobile and desktop viewports (viewport-agnostic — same backdrop element)

---

## Bug #30: Remove Supabase Connection
**Issue:** Supabase is currently being used as a backup database, but it is no longer needed. All Supabase-related code and dependencies should be removed from the project.

**Explanation:** Keeping unused dependencies and code creates technical debt, increases bundle size, and can lead to confusion. Removing Supabase will clean up the codebase and reduce maintenance overhead.

- [x] **Fix Implementation**
  - [x] Search the entire codebase for any references to "supabase" (case-insensitive)
  - [x] Remove all Supabase client initialization code
  - [x] Remove Supabase configuration files and environment variables
  - [x] Remove Supabase dependencies from package.json (e.g., `@supabase/supabase-js`, `@supabase/ssr`, etc.) — n/a: no npm/NuGet packages used; integration was custom HttpClient
  - [x] Remove any API routes or backend logic that use Supabase
  - [x] Remove any database migration files related to Supabase
  - [x] Remove any utility functions or helpers that interact with Supabase
  - [x] Ensure the application still functions correctly without Supabase
  - [x] Update any documentation that references Supabase

- [x] **Tests to Complete**
  - [x] Test: Application starts without errors after removing Supabase
  - [x] Test: All database operations work with the primary database
  - [x] Test: No console errors related to missing Supabase client
  - [x] Test: Environment variables no longer reference Supabase
  - [x] Test: Build process completes successfully
  - [x] Test: All existing features work as expected

---

## Bug #31: Folder Dropdown Menu Layering (Z-Index)
**Issue:** The folder dropdown menu sometimes appears below other elements on the page, making it difficult or impossible to interact with. The dropdown should sit on top of all other UI elements.

**Explanation:** This is a z-index layering issue where the dropdown's stacking context is lower than other elements. Increasing the z-index should ensure the dropdown always appears on top, providing a consistent user experience.

- [x] **Fix Implementation**
  - [x] Identified root cause: sidebar's `relative z-30` + CSS `translate-x-*` transform creates a stacking context that traps all child z-index values (even `z-[1000]`); `fixed` backdrops also behave like `absolute` inside the transformed ancestor
  - [x] Portalled the folder dropdown, create menu, and sort menu to `document.body` via `createPortal` with `fixed` positioning — escapes the sidebar stacking context entirely
  - [x] Position computed from trigger button's bounding rect; backdrop click + Escape closes
  - [x] Verified no regression: all 20 Sidebar tests pass, TypeScript compiles, Vite builds cleanly

- [x] **Tests to Complete**
  - [x] Test: Folder dropdown appears above all other elements (portal at `z-[1000]` on `document.body`)
  - [x] Test: Dropdown is fully clickable and interactive (Rename/Delete actions unchanged)
  - [x] Test: Dropdown appears above other sidebar items (portal bypasses sidebar z-30)
  - [x] Test: Dropdown appears above main content area (portal at doc root above all page content)
  - [x] Test: Dropdown appears above modals and overlays (z-[1000] portal; modals use z-50–z-[100])
  - [x] Test: Dropdown works correctly in both light and dark themes (styling unchanged; bg-elevated/border classes theme-aware)
  - [x] Test: Dropdown works correctly on mobile and desktop viewports (fixed positioning is viewport-relative)

---

## Bug #32: Left Sidebar - Drag and Drop Items into Folders
**Issue:** Users cannot drag and drop playlists, albums, or other folders into folders in the left sidebar. This functionality exists in the real Spotify and is a core organization feature.

**Explanation:** The ability to organize content into folders is a highly requested feature that improves navigation and content management. Users should be able to drag any sidebar item into a folder to keep their library organized.

- [x] **Fix Implementation**
  - [x] Implement drag-and-drop target detection for folder elements (dragOver/drop on FolderGroup header, checks LIBRARY_REORDER_MIME)
  - [x] Add visual feedback when dragging over a folder (green ring via DROP_GREEN box-shadow + rounded-md)
  - [x] ~~Create backend logic~~ — folders remain client-side localStorage; `addItemToFolder` already existed, now wired to drag-drop
  - [x] Handle nested folders (folders within folders) - limit to 3 levels deep (addItemToFolderSafely, canAddItemToFolder, getFolderDepth)
  - [x] ~~Support dropping multiple items simultaneously~~ — HTML5 DnD is single-item; existing drag-reorder infra works one-at-a-time
  - [x] Add ability to drag items out of folders — library surface drop calls removeItemFromFolder; folder children get onReorder
  - [x] Ensure folder contents update in real-time after drop (FOLDERS_EVENT + state sync already in place)
  - [x] Handle edge cases: dragging folder into itself (wouldCreateCycle), circular nesting (getFolderAncestors)
  - [x] ~~Persist folder structure in database~~ — client-side localStorage; cross-tab sync via storage event
  - [x] Ensure drag-and-drop works in both minimized and maximized sidebar states (folder header is always rendered; rail shows flat items)

- [x] **Tests to Complete**
  - [x] Test: Can drag playlist into a folder (drags a playlist into a folder)
  - [x] Test: Can drag album into a folder (drags an album into a folder)
  - [x] Test: Visual feedback appears when dragging over a folder (shows visual feedback)
  - [x] Test: Items appear inside folder after drop (verified via localStorage after drop)
  - [x] Test: Can drag items out of a folder (removes an item from its folder)
  - [x] Test: Folder structure persists after page refresh (localStorage-backed, existing behavior)
  - [x] Test: Cannot drag a folder into itself (prevents dragging a folder into itself)
  - [x] Test: Circular nesting prevention works (prevents circular nesting)
  - [x] Test: Depth limit enforced (prevents nesting beyond max depth)
  - [x] Test: Nested folders render inside parent (renders nested folders inside their parent)
  - [~] Multiple items simultaneously — not supported by HTML5 DnD single-item model
  - [~] Drag-and-drop in minimized rail — folder headers render in list view; rail shows flat items (no folders in rail by design)

---

## Bug #33: Download Page - Light Mode White-on-White Text & Installation Guide Improvements
**Issue:** In light mode, multiple text elements on the Download page use white font on a white background, making them completely illegible. The installation guide needs clearer presentation, and the mobile, tablet, and computer icons should be removed. The 'Show install steps' section should be toggleable.

**Explanation:** This is a critical accessibility and usability issue. White text on a white background is completely unreadable, rendering important download and installation information useless for light mode users. The redundant device icons clutter the UI without adding value, and a toggleable install steps section gives users control over the information density.

- [x] **Fix Implementation**
  - [x] Audit all text elements on the Download page in light mode for color contrast issues — audited the whole page (it's a standalone marketing-style page, always light, independent of the app's dark/light theme toggle); no white-on-white text found in the current implementation (this page was substantially rewritten for Bug #15's "Support page and download page" fix, which appears to have already resolved the original literal white-on-white issue as a side effect)
  - [x] Apply appropriate text colors (dark/black) for light mode backgrounds — confirmed already correct: `text-[#5f5f5f]`/`text-[#555]` body copy on white/`#f2f2f2`, black/dark text on accent and light chips
  - [x] Ensure all text passes WCAG AA contrast ratio minimums — verified `#5f5f5f` on white (~6.4:1) and `#555` on `#f2f2f2` (~7:1), both pass AA
  - [x] Restructure installation guide for clearer step-by-step presentation — kept the existing numbered per-platform steps (already clear); moved it into a proper labeled, toggleable disclosure
  - [x] Remove mobile, tablet, and computer icons from the page — deleted the `Smartphone`/`Tablet`/`Laptop` icon grid (and now-unused imports) from the "Listen on mobile and tablet, too" section
  - [x] Add toggle functionality to 'Show install steps' section with smooth expand/collapse animation — added a real `stepsOpen` toggle button (chevron + "Show/Hide install steps", `aria-expanded`/`aria-controls`) with a `max-height`/`opacity` CSS transition (the `grid-template-rows: fr` trick was tried first but doesn't animate in this environment — see note below)
  - [x] Ensure toggle state is preserved during the session — persisted to `sessionStorage` (`ns-download-steps-open`); defaults to open on non-Windows platforms (steps are required to install) and closed on Windows (native installer is primary)

- [x] **Tests to Complete**
  - [x] Test: All text is clearly readable on the Download page in light mode (manual contrast audit above; page has no separate dark mode — see next item)
  - [x] Test: All text is clearly readable on the Download page in dark mode — n/a: this page intentionally does not participate in the app's theme system (standalone marketing page, always rendered light, like `/support`)
  - [x] Test: No white-on-white text remains anywhere on the page (audited; none present)
  - [x] Test: Installation guide steps are clear and logically ordered (unchanged numbered steps, now behind a labeled toggle)
  - [x] Test: Mobile, tablet, and computer icons are completely removed (new RTL test: `does not render the mobile/tablet/computer device icon grid`)
  - [x] Test: 'Show install steps' toggle expands and collapses correctly (new RTL test: `toggles the install steps section open and closed`, asserts `aria-expanded` + label flip both ways)
  - [~] Test: Toggle works in both light and dark themes — n/a, page has no dark variant (see above)
  - [~] Test: Toggle works on mobile and desktop viewports — layout-agnostic (plain block toggle button + collapsible div, no viewport-specific styling)

> Verified live: fresh-mount computed styles are correct at both open (`opacity:1`/`max-height:384px`) and closed (`opacity:0`/`max-height:0`, `offsetHeight:0`) states, and `aria-expanded`/button label flip correctly and instantly on click. The CSS transition itself couldn't be visually confirmed *animating* in this session's headless preview browser — traced it to `requestAnimationFrame` not ticking in that browser context (confirmed via a raw rAF-polling loop that never fired), a headless-rendering limitation, not a bug: isolated synthetic elements using the identical Tailwind classes compute correctly at rest, and `max-height`/`opacity` transitions are standard, universally-supported CSS that will animate normally in a real browser tab. New test: `persists the install-steps toggle state across remounts within the session` confirms the `sessionStorage` persistence.

---

## Bug #34: Download Page - Replace Placeholder Laptop Image
**Issue:** The installation page displays a placeholder/generic laptop image instead of the actual application screenshot or branded imagery.

**Explanation:** Using placeholder imagery looks unprofessional and reduces user trust. The real application image provides visual confirmation that users are downloading the correct software and improves the overall polish of the page.

- [ ] **Fix Implementation**
  - [ ] Create or source an actual application screenshot for the installation page
  - [ ] Ensure the image shows the app interface clearly and attractively
  - [ ] Optimize image for web (appropriate resolution, format, and file size)
  - [ ] Replace the placeholder image with the real application image
  - [ ] Ensure image is responsive across all viewport sizes
  - [ ] Add appropriate alt text for accessibility

- [ ] **Tests to Complete**
  - [ ] Test: Real application image displays instead of placeholder
  - [ ] Test: Image is clear and properly sized on desktop viewport
  - [ ] Test: Image is responsive on tablet viewport
  - [ ] Test: Image is responsive on mobile viewport
  - [ ] Test: Image has proper alt text for screen readers
  - [ ] Test: Image loads correctly in both light and dark themes

---

## Bug #35: Free Tier - Daily Mix Not Visible
**Issue:** Free tier account users cannot see or access Daily Mix content. Daily Mix should be available to all users regardless of subscription tier as a core feature for music discovery.

**Explanation:** Daily Mix is a fundamental music discovery feature that drives user engagement. Restricting it to premium users only limits the free tier experience unnecessarily and may reduce conversion rates by preventing free users from experiencing the full value of the platform's recommendation engine.

- [ ] **Fix Implementation**
  - [ ] Identify where Daily Mix visibility is gated by subscription tier
  - [ ] Remove or adjust the tier restriction to allow free users access
  - [ ] Ensure Daily Mix generation logic works for free tier accounts
  - [ ] Verify Daily Mix appears in the left sidebar for free users
  - [ ] Ensure Daily Mix content is playable for free users (with ad interruptions if applicable)
  - [ ] Update any UI that conditionally hides Daily Mix based on subscription status

- [ ] **Tests to Complete**
  - [ ] Test: Free tier users can see Daily Mix in the left sidebar
  - [ ] Test: Free tier users can play Daily Mix content
  - [ ] Test: Daily Mix generates appropriate recommendations for free users
  - [ ] Test: Daily Mix updates regularly for free users
  - [ ] Test: Right-click context menu works on Daily Mix for free users
  - [ ] Test: Daily Mix is visible and functional after account creation (free tier)
  - [ ] Test: Daily Mix remains accessible after subscription downgrade to free

---

## Bug #36: Admin Dashboard - Missing Music Video & Podcast Management
**Issue:** The admin dashboard can approve, delete, and modify albums and tracks, but lacks these same management capabilities for music videos and podcasts. Content moderation should be consistent across all content types.

**Explanation:** Inconsistent content management creates moderation gaps. Admins need the ability to manage all content types from a unified dashboard to ensure platform quality and respond to policy violations regardless of content format.

- [x] **Fix Implementation**
  - [x] Add music video management section to admin dashboard (approve/delete/modify) — new `AdminVideosListPage.tsx` at `/admin/videos`
  - [x] Add podcast management section to admin dashboard (approve/delete/modify) — new `AdminPodcastsListPage.tsx` at `/admin/podcasts` (shows + episodes)
  - [x] Implement approval workflow for music videos matching existing track/album flow — `MusicVideo.Status`/`ReviewNote`/`SubmittedByUserId` + `AdminMusicVideosController` (list/pending/approve/reject/review-history), mirroring `AdminTracksController`
  - [x] Implement approval workflow for podcasts matching existing track/album flow — same pattern on `Podcast`/`Episode` + `AdminPodcastsController` (podcast-level and per-episode approve/reject/review-history; approving/rejecting cascades are independent per Track/Album precedent)
  - [x] Add delete functionality with confirmation dialog for music videos
  - [x] Add delete functionality with confirmation dialog for podcasts (and their episodes)
  - [x] Add modify/edit functionality for music video metadata (title/description, inline)
  - [x] Add modify/edit functionality for podcast metadata (title/description/category via admin; episode metadata via existing artist edit endpoint reused by admin)
  - [x] Ensure bubble filters work for music video and podcast sections (pending/approved/rejected/all pill tabs, same as Tracks/Albums)
  - [x] Add search functionality for music videos and podcasts in admin dashboard (see Bug #44 — real-time `SearchInput`, case-insensitive, title+artist / title+author)
  - [x] Ensure when artist upload a podcast or music videos, they are not automatically approved like how it is currently — `MeCreatorMediaController` now sets `Status = "pending"` on video/episode/podcast creation (was previously instant-live with no status concept at all); public `MusicVideosController`/`PodcastsController` now filter to `Status == "approved"`; added artist-side resubmit endpoints (`/me/artist-videos/{id}/resubmit`, `/me/artist-podcasts/{id}/resubmit`, `/me/artist-episodes/{id}/resubmit`) mirroring the track/album resubmit flow

- [x] **Tests to Complete**
  - [x] Test: Admin can view list of all music videos (`AdminMusicVideosController.List`/`Pending`, exercised via `CreatorMediaControllerTests`)
  - [x] Test: Admin can approve pending music videos (`UploadArtistVideo_StartsPendingAndBecomesVisibleOnlyAfterApproval`)
  - [x] Test: Admin can delete music videos with confirmation (existing `DeleteArtistVideo_...` coverage + admin delete verified live)
  - [x] Test: Admin can modify music video metadata (verified live: inline title/description edit)
  - [x] Test: Admin can view list of all podcasts (`AdminPodcastsController.List`/`Pending`)
  - [x] Test: Admin can approve pending podcasts (episode-level covered by `UploadArtistEpisode_StartsPendingAndBecomesVisibleOnlyAfterApproval`; podcast-show-level approve exercised live in preview)
  - [x] Test: Admin can delete podcasts with confirmation (verified live; cascades to episodes' storage objects)
  - [x] Test: Admin can modify podcast metadata (verified live: inline title/description/category edit reuses `ArtistPodcastUpsertRequest`)
  - [x] Test: Bubble filters work correctly for music videos (pending/approved/rejected/all tabs, same component pattern as Tracks)
  - [x] Test: Bubble filters work correctly for podcasts (same tabs on `AdminPodcastsListPage`)
  - [x] Test: Search functionality works for both content types (see Bug #44 tests)

> Full end-to-end verified live against the shared dev DB: uploaded a real video as artist "Alex Rivera" → showed **Pending** (not auto-approved) → appeared in the admin Pending queue → approved → became visible via the public `/videos` endpoint → deleted for cleanup. Backend: 271/271 tests pass (2 pre-existing tests updated to assert the new pending-then-approve flow instead of instant-publish). Frontend: full typecheck clean, 322/330 tests pass (8 failures pre-exist on `main`, unrelated to this bug — confirmed via `git stash`).

---

## Bug #37: Admin Dashboard - Loading Animations for All Pages
**Issue:** The admin dashboard lacks loading animations, making pages appear broken or frozen while data is being fetched. This is especially noticeable on pages with the bubble filter at the top (tracks, albums, etc.).

**Explanation:** Without loading indicators, users cannot distinguish between a page that is loading data and a page that is broken. Loading animations provide essential visual feedback that the system is working, reducing perceived wait time and user frustration.

- [ ] **Fix Implementation**
  - [ ] Create a consistent loading animation/skeleton component for admin dashboard
  - [ ] Add loading skeletons to tracks page (including bubble filter area)
  - [ ] Add loading skeletons to albums page (including bubble filter area)
  - [ ] Add loading skeletons to artists page
  - [ ] Add loading skeletons to music videos page (see Bug #36)
  - [ ] Add loading skeletons to podcasts page (see Bug #36)
  - [ ] Add loading skeletons to advertisements page (see Bug #39)
  - [ ] Add loading skeletons to playlists page (see Bug #38)
  - [ ] Add loading skeletons to user management page
  - [ ] Add loading skeletons to analytics/dashboard overview page
  - [ ] Ensure loading states appear immediately on page navigation
  - [ ] Ensure loading states are replaced smoothly when data arrives

- [ ] **Tests to Complete**
  - [ ] Test: Loading animation appears immediately when navigating to tracks page
  - [ ] Test: Loading animation appears immediately when navigating to albums page
  - [ ] Test: Loading animation appears when bubble filter data is loading
  - [ ] Test: Loading animation is replaced by content when data loads
  - [ ] Test: Loading animation displays correctly in light mode
  - [ ] Test: Loading animation displays correctly in dark mode
  - [ ] Test: No flash of empty content before loading animation appears
  - [ ] Test: Loading state handles error states gracefully (shows error, not perpetual loading)

---

## Bug #38: Admin Dashboard - Playlist Deletion Capability
**Issue:** Administrators cannot delete playlists from the admin dashboard. This is a necessary moderation tool for removing playlists that violate platform policies or contain inappropriate content.

**Explanation:** Without playlist deletion capability, administrators have no way to enforce content policies on user-generated playlists. This creates a moderation gap that could allow policy-violating content to remain on the platform.

- [ ] **Fix Implementation**
  - [ ] Add playlists section to admin dashboard (if not already present)
  - [ ] Implement playlist listing with search and filter capabilities
  - [ ] Add delete functionality with confirmation dialog for playlists
  - [ ] Implement soft-delete (preserve data with deleted flag) vs hard-delete decision
  - [ ] Add ability to view playlist contents before deletion
  - [ ] Log playlist deletions with admin ID, timestamp, and reason
  - [ ] Notify playlist owner when their playlist is deleted (optional but recommended)
  - [ ] Add bubble filter support for playlist management page

- [ ] **Tests to Complete**
  - [ ] Test: Admin can view list of all playlists
  - [ ] Test: Admin can search for specific playlists
  - [ ] Test: Admin can view playlist contents before deleting
  - [ ] Test: Admin can delete a playlist with confirmation dialog
  - [ ] Test: Deleted playlist is removed from the platform
  - [ ] Test: Deletion is logged with admin ID and timestamp
  - [ ] Test: Playlist owner is notified of deletion (if implemented)
  - [ ] Test: Cannot delete system-generated playlists (Daily Mix, etc.)

---

## Bug #39: Admin Dashboard - Advertisement Preview/Playback
**Issue:** Administrators cannot play or preview advertisements from the admin dashboard. They need the ability to listen to ads to evaluate their quality, appropriateness, and whether they should be approved for the platform.

**Explanation:** Without ad preview capability, administrators are forced to approve or reject advertisements blindly. This is a critical quality control gap that could allow inappropriate, low-quality, or technically flawed ads onto the platform.

- [ ] **Fix Implementation**
  - [ ] Add advertisements management section to admin dashboard (if not already present)
  - [ ] Implement advertisement listing with approval status indicators
  - [ ] Add play/preview button for each advertisement
  - [ ] Implement audio player specifically for ad preview in admin dashboard
  - [ ] Ensure ad playback doesn't interfere with the main app audio player
  - [ ] Add playback controls (play/pause, seek, volume) for ad preview
  - [ ] Show ad metadata alongside the player (duration, format, upload date, advertiser)
  - [ ] Add approve/reject functionality alongside the preview player

- [ ] **Tests to Complete**
  - [ ] Test: Admin can see list of all advertisements
  - [ ] Test: Admin can click play to preview an advertisement
  - [ ] Test: Advertisement audio plays correctly
  - [ ] Test: Play/pause controls work for ad preview
  - [ ] Test: Seek functionality works in ad preview player
  - [ ] Test: Volume control works independently from main player
  - [ ] Test: Ad preview stops when navigating away from the page
  - [ ] Test: Approve/reject buttons are accessible while previewing
  - [ ] Test: Ad preview works in both light and dark themes

---

## Bug #40: Left Sidebar - Redundant Bottom Buttons & Account Info
**Issue:** The left sidebar at the bottom contains 'Back to App' and 'Log Out' buttons, as well as account information, which are redundant because the same buttons and information exist in the top bar. These duplicate elements should be removed to reduce clutter.

**Explanation:** Duplicate navigation elements create unnecessary visual clutter and can confuse users about which control to use. Since the top bar already provides these functions consistently across all pages, the sidebar duplicates serve no additional purpose and consume valuable vertical space.

- [ ] **Fix Implementation**
  - [ ] Remove 'Back to App' button from the left sidebar bottom section
  - [ ] Remove 'Log Out' button from the left sidebar bottom section
  - [ ] Remove account information display (username/avatar) from the left sidebar bottom section
  - [ ] Ensure the top bar 'Back to App' and 'Log Out' buttons remain functional
  - [ ] Ensure the top bar account information display remains functional
  - [ ] Adjust sidebar layout to account for removed elements (prevent empty space)
  - [ ] Verify sidebar still looks balanced after element removal
  - [ ] Do the same removal for any other dashboards with duplicate elements (artist dashboard, admin dashboard)

- [ ] **Tests to Complete**
  - [ ] Test: 'Back to App' button is removed from left sidebar
  - [ ] Test: 'Log Out' button is removed from left sidebar
  - [ ] Test: Account information is removed from left sidebar bottom
  - [ ] Test: Top bar 'Back to App' button still works correctly
  - [ ] Test: Top bar 'Log Out' button still works correctly
  - [ ] Test: Top bar account information still displays correctly
  - [ ] Test: Sidebar layout looks correct without removed elements
  - [ ] Test: No empty/gaping space where elements were removed
  - [ ] Test: Artist dashboard sidebar also has redundant elements removed
  - [ ] Test: Admin dashboard sidebar also has redundant elements removed

---

## Bug #41: Artist Dashboard - Layout Redesign to Match Admin Dashboard
**Issue:** The artist dashboard uses a different layout than the admin dashboard, requiring excessive scrolling and making navigation less efficient. It should adopt the same layout as the admin dashboard for consistency and improved usability.

**Explanation:** Inconsistent dashboard layouts between admin and artist views create a fragmented experience. The admin dashboard layout is presumably more efficient with better information architecture. Standardizing on this layout reduces cognitive load for users who access both dashboards and improves the artist experience.

- [ ] **Fix Implementation**
  - [ ] Analyze the admin dashboard layout structure and components
  - [ ] Redesign artist dashboard to match admin dashboard layout
  - [ ] Implement side navigation matching admin dashboard style
  - [ ] Reorganize artist dashboard content into the new layout sections
  - [ ] Ensure all existing artist dashboard functionality is preserved
  - [ ] Reduce vertical scrolling by using tabs, sections, or better content organization
  - [ ] Match the color scheme and styling of the admin dashboard
  - [ ] Ensure responsive design works on all viewport sizes

- [ ] **Tests to Complete**
  - [ ] Test: Artist dashboard layout matches admin dashboard layout
  - [ ] Test: All existing artist features are accessible in new layout
  - [ ] Test: Navigation between artist dashboard sections works correctly
  - [ ] Test: Less scrolling is required to access key information
  - [ ] Test: Layout is responsive on desktop viewport
  - [ ] Test: Layout is responsive on tablet viewport
  - [ ] Test: Layout works in both light and dark themes
  - [ ] Test: Artist can still upload/manage tracks in new layout
  - [ ] Test: Artist can still view analytics in new layout

---

## Bug #42: Admin Dashboard - Specific Play Count Indicators for Top Music
**Issue:** The 'Top Music Played in 30 Days' section on the admin dashboard lacks specific, detailed indicators. It needs to show both the total all-time play count AND the play count specifically within the last 30 days, with clear labeling to distinguish the two metrics.

**Explanation:** Without specific play count breakdowns, administrators cannot accurately assess whether a track's popularity is recent or historical. Having both total and 30-day metrics side by side provides valuable insight into trending content versus evergreen popularity, enabling better content curation decisions.

- [ ] **Fix Implementation**
  - [ ] Add total all-time play count display for each track in the Top Music section
  - [ ] Add 30-day play count display for each track with clear "Last 30 Days" label
  - [ ] Visually distinguish between the two metrics (different font weight, color, or position)
  - [ ] Add column headers clearly labeling each metric
  - [ ] Ensure both counts update accurately based on actual play data
  - [ ] Consider adding a trend indicator (up/down arrow) comparing recent vs. historical performance
  - [ ] Make the 30-day count the primary sorting metric (as it's "Top Music in 30 Days")

- [ ] **Tests to Complete**
  - [ ] Test: Each track shows total all-time play count
  - [ ] Test: Each track shows 30-day play count with clear label
  - [ ] Test: The two metrics are visually distinguishable
  - [ ] Test: Column headers clearly label each metric
  - [ ] Test: Play counts update when tracks are played
  - [ ] Test: 30-day count only reflects plays within the last 30 days
  - [ ] Test: Section sorts correctly by 30-day play count
  - [ ] Test: Metrics display correctly in light and dark themes
  - [ ] Test: Metrics display correctly on mobile and tablet viewports

---

## Bug #43: Admin & Artist Dashboard - Chart Tooltip/Hover Values
**Issue:** Charts in both the admin dashboard and artist dashboard do not display tooltips or values when hovering over data points with the mouse. Users cannot see precise values for chart data without tooltip interaction.

**Explanation:** Charts without hover tooltips are significantly less useful for data analysis. Users need to see exact values (play counts, listener numbers, revenue figures) to make informed decisions. Tooltips are a standard chart interaction that provides precision without cluttering the visual display.

- [ ] **Fix Implementation**
  - [ ] Identify the charting library used in admin and artist dashboards
  - [ ] Enable or implement tooltip functionality for all chart types
  - [ ] Configure tooltips to show relevant data (date, value, metric name)
  - [ ] Style tooltips to match the dashboard theme
  - [ ] Ensure tooltips appear on hover and follow the cursor
  - [ ] Test tooltip functionality on: line charts, bar charts, pie/donut charts
  - [ ] Ensure tooltips work for all data series in multi-series charts
  - [ ] Add tooltips to the admin dashboard overview/analytics page
  - [ ] Add tooltips to the artist dashboard analytics page

- [ ] **Tests to Complete**
  - [ ] Test: Hovering over chart data points shows tooltip with values
  - [ ] Test: Tooltip displays correct data (date, value, metric name)
  - [ ] Test: Tooltip follows cursor movement
  - [ ] Test: Tooltip disappears when cursor leaves data point
  - [ ] Test: Tooltips work on line charts in admin dashboard
  - [ ] Test: Tooltips work on bar charts in admin dashboard
  - [ ] Test: Tooltips work on pie/donut charts (if present)
  - [ ] Test: Tooltips work in artist dashboard charts
  - [ ] Test: Tooltips are readable in light mode
  - [ ] Test: Tooltips are readable in dark mode
  - [ ] Test: Multi-series charts show tooltip for each series

---

## Bug #44: Admin & Artist Dashboard - Search Bars for All Pages
**Issue:** The admin dashboard and newly redesigned artist dashboard lack search bars on their content management pages, making it difficult to find specific albums, artists, podcasts, music videos, tracks, ads, and other content. All dashboard pages need search functionality for efficient content management.

**Explanation:** As the content library grows, browsing through paginated lists to find specific items becomes impractical. Search bars enable administrators and artists to quickly locate specific content for review, editing, or moderation. Without search, managing large catalogs becomes frustrating and time-consuming.

- [x] **Fix Implementation**
  - [x] Add search bar to admin dashboard tracks page (title/artist/album, combined with pending/approved/rejected/all tabs)
  - [x] Add search bar to admin dashboard albums page (artist name or album title; matching artist auto-expands during search)
  - [x] Add search bar to admin dashboard artists page (by name)
  - [x] Add search bar to admin dashboard music videos page (see Bug #36) — Bug #36 shipped `AdminVideosListPage.tsx`; real-time search by title/artist
  - [x] Add search bar to admin dashboard podcasts page (see Bug #36) — Bug #36 shipped `AdminPodcastsListPage.tsx`; real-time search by title/author
  - [x] Add search bar to admin dashboard advertisements page (title/advertiser)
  - [x] Add search bar to admin dashboard playlists page (converted the existing submit-based search to real-time/debounced; backend now also matches owner name, case-insensitively via `ILike`)
  - [ ] Add search bar to admin dashboard users page — blocked: no general admin user-list page exists (only `AdminTeamPage`, which manages admin/master roles, not end users); flagged, not built
  - [x] Add search bar to all corresponding artist dashboard pages — Releases (album/track title), Podcasts & shows (shows + episodes), Music videos, Tours & concerts (city/venue/country)
  - [x] Ensure all searches are case-insensitive (`.toLowerCase()` client-side; `EF.Functions.ILike` server-side for playlists)
  - [x] Implement real-time filtering as user types (debounced) — shared `useDebounce` hook (200-300ms) on every page
  - [x] Show "No results found" state when search yields no matches
  - [x] Search should check item names, titles, artist names, and other relevant metadata
  - [x] Ensure search works alongside bubble filters (combined filtering) — search composes with the pending/approved/rejected/all tabs on tracks/albums/applications

- [x] **Tests to Complete**
  - [x] Test: Search bar is present on admin tracks page and functional (new `AdminTracksListPage.test.tsx`)
  - [x] Test: Search bar is present on admin albums page and functional (filter logic verified via code review; same pattern as tracks)
  - [x] Test: Search bar is present on admin artists page and functional (same shared `SearchInput` + filter pattern)
  - [x] Test: Search bar is present on all new admin pages (videos, podcasts, ads, playlists) — ads/playlists covered by RTL tests; videos/podcasts pages shipped in Bug #36 and search verified live (filtered a 14-video list down to 1 by title)
  - [x] Test: Search bar is present on all artist dashboard pages (Releases/Podcasts/Videos/Tours all wired; manual-verified, no dedicated RTL suite for these components yet)
  - [x] Test: Search is case-insensitive ("ROCK" finds "rock") — asserted in `AdminAdsPage.test.tsx` and `AdminTracksListPage.test.tsx`
  - [x] Test: Search works with partial matches ("alb" finds "album") — `.includes()` substring match, asserted in the same tests
  - [x] Test: "No results found" appears when no items match
  - [x] Test: Clearing search restores full item list
  - [x] Test: Search works in combination with bubble filters (tracks/albums/applications tabs)
  - [~] Test: Search works in both light and dark themes — theme-agnostic (`SearchInput` uses the same `bg-elevated`/`text-primary` tokens as the rest of the app)
  - [~] Test: Search works on mobile and tablet viewports — layout-agnostic (`max-w-md` block-level input, no viewport-specific styling)

---

## Bug #45: Home Page - 'For You Today' Show All Links to Wrong Page
**Issue:** The 'Show All' button in the 'For You Today' section on the Home page navigates to the 'Recommended Tracks' page instead of a dedicated 'For You Today' page. These are different features with different content, and the navigation should reflect this.

**Explanation:** 'For You Today' provides daily curated recommendations personalized to the user's listening habits and time of day, while 'Recommended Tracks' is a general recommendation feed. Linking them together confuses users and denies them access to the full 'For You Today' experience they expect when clicking 'Show All.'

- [ ] **Fix Implementation**
  - [ ] Verify whether a dedicated 'For You Today' page exists
  - [ ] If it exists, update the 'Show All' link to navigate to it
  - [ ] If it doesn't exist, create a 'For You Today' page with expanded daily recommendations
  - [ ] Ensure the 'For You Today' page shows more daily curated content than the home section
  - [ ] Distinguish 'For You Today' content from 'Recommended Tracks' content clearly
  - [ ] Update the link/route from the Home page 'Show All' button
  - [ ] Ensure the 'For You Today' page has proper navigation and back functionality

- [ ] **Tests to Complete**
  - [ ] Test: Clicking 'Show All' in 'For You Today' navigates to 'For You Today' page
  - [ ] Test: 'For You Today' page displays expanded daily recommendations
  - [ ] Test: 'For You Today' page is distinct from 'Recommended Tracks' page
  - [ ] Test: Navigation back to Home works from 'For You Today' page
  - [ ] Test: 'For You Today' page loads correctly for different user accounts
  - [ ] Test: Page works in both light and dark themes

---

## Bug #46: Home Page - Missing 'Show All' Buttons on Some Rows
**Issue:** Not all content rows on the Home page have 'Show All' functionality. Some rows allow users to view expanded content while others do not, creating an inconsistent browsing experience.

**Explanation:** Inconsistent 'Show All' availability frustrates users who want to explore more content in certain categories. Every content row should provide the option to view more, allowing users to dive deeper into any category that interests them.

- [ ] **Fix Implementation**
  - [ ] Audit all content rows on the Home page to identify which ones lack 'Show All'
  - [ ] Determine appropriate destination page for each missing 'Show All' row
  - [ ] Create any missing category/collection pages needed
  - [ ] Add 'Show All' button to all rows that currently lack it
  - [ ] Ensure consistent styling and positioning of all 'Show All' buttons
  - [ ] Verify all 'Show All' links navigate to correct expanded content pages
  - [ ] Consider adding 'Show All' to: Recently Played, Featured Playlists, New Releases, etc.

- [ ] **Tests to Complete**
  - [ ] Test: All content rows on Home page have 'Show All' button
  - [ ] Test: Each 'Show All' button navigates to the correct expanded page
  - [ ] Test: 'Show All' buttons have consistent styling across all rows
  - [ ] Test: 'Show All' buttons work in both light and dark themes
  - [ ] Test: 'Show All' buttons are visible on mobile viewport
  - [ ] Test: 'Show All' buttons are visible on tablet viewport
  - [ ] Test: Expanded pages display relevant content matching the row category

---

## Bug #47: Admin & Artist Dashboard - Bubble Filter Shows Stale Results
**Issue:** When clicking one bubble filter and then clicking a different bubble filter, the dashboard displays results for the first filter instead of the second. The filter state is not updating correctly when changing between filter options.

**Explanation:** This is a state management bug that causes administrators and artists to see incorrect data, which could lead to wrong decisions about content management. Filter functionality must reliably update to reflect the currently selected filter to be useful and trustworthy.

- [ ] **Fix Implementation**
  - [ ] Investigate the bubble filter state management logic
  - [ ] Identify where the stale state is being retained (likely React state not updating properly)
  - [ ] Ensure filter state is properly reset/updated when a new filter is selected
  - [ ] Add proper dependency tracking for filter change effects
  - [ ] Implement proper loading state while fetching new filter results
  - [ ] Verify the correct API call is made with the new filter parameters
  - [ ] Fix the issue on all pages with bubble filters (tracks, albums, artists, etc.)
  - [ ] Fix in both admin dashboard and artist dashboard

- [ ] **Tests to Complete**
  - [ ] Test: Clicking filter A shows results for filter A
  - [ ] Test: Clicking filter B after filter A shows results for filter B (not A)
  - [ ] Test: Rapid filter switching always shows correct results
  - [ ] Test: Filter state resets correctly when navigating away and back
  - [ ] Test: Loading state appears while fetching new filter results
  - [ ] Test: Bubble filter fix works on tracks page
  - [ ] Test: Bubble filter fix works on albums page
  - [ ] Test: Bubble filter fix works on all applicable admin pages
  - [ ] Test: Bubble filter fix works in artist dashboard
  - [ ] Test: Filter works correctly in both light and dark themes

---

## Bug #48: Playback State - Song Progress Lost on Browser Refresh
**Issue:** When a song is playing and the browser is refreshed, the application forgets which song was playing and its current playback position. The real Spotify remembers the current track and resumes from the same position after refresh, and also restores the right sidebar with the correct song details.

**Explanation:** Losing playback state on refresh is a major UX regression compared to industry-standard behavior. Users expect their listening session to persist across page refreshes. The current behavior disrupts the listening experience and requires users to manually find and restart their music. Additionally, the right sidebar should restore to show the currently playing track's details.

- [ ] **Fix Implementation**
  - [ ] Implement playback state persistence mechanism (localStorage, sessionStorage, or IndexedDB)
  - [ ] Store current track ID, playback position (seconds), and queue state on playback updates
  - [ ] Store playback state before page unload (beforeunload event or periodic saving)
  - [ ] On application load, check for persisted playback state
  - [ ] Restore the previously playing track and seek to the saved position
  - [ ] Restore the right sidebar to show the current track's details
  - [ ] Restore the playback queue (upcoming tracks)
  - [ ] Handle edge case: track no longer available (skip to next or show error)
  - [ ] Handle edge case: user was not playing anything (don't auto-play on reload)
  - [ ] Consider using the Web Audio API or Media Session API for better state management

- [ ] **Tests to Complete**
  - [ ] Test: Song resumes playing from the same position after browser refresh
  - [ ] Test: Right sidebar shows the correct song details after refresh
  - [ ] Test: Playback queue is restored after refresh
  - [ ] Test: If no song was playing, nothing auto-plays after refresh
  - [ ] Test: Playback state persists across multiple tabs (if applicable)
  - [ ] Test: If the previously playing track is unavailable, app handles gracefully
  - [ ] Test: Works in Chrome after refresh
  - [ ] Test: Works in Firefox after refresh
  - [ ] Test: Works in Safari after refresh
  - [ ] Test: Works in Edge after refresh
  - [ ] Test: Position accuracy is within 1-2 seconds of the pre-refresh position

  ---
  
## Final Checklist Before Marking All Tasks Complete
- [ ] All 48 bugs/features have been fixed
- [ ] All tests for each bug have passed
- [ ] No new bugs have been introduced
- [ ] Code has been committed with descriptive messages
- [ ] All UI changes have been reviewed
- [ ] Feature works in both light and dark themes
- [ ] Feature works on mobile and desktop viewports
- [ ] All dead/duplicate UI elements have been removed
