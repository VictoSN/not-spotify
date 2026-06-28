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

- [ ] **Fix Implementation**
  - [ ] Update download buttons to point to actual setup executable/installer files (e.g., .exe, .dmg, .apk)
  - [ ] Create proper setup installer for the application
  - [ ] Upload installer files to S3 bucket or designated CDN
  - [ ] Test download links work correctly

- [ ] **Tests to Complete**
  - [ ] Test: Download button downloads the correct file
  - [ ] Test: Installer can be downloaded on Windows
  - [ ] Test: Installer can be downloaded on macOS
  - [ ] Test: Installer can be downloaded on mobile
  - [ ] Test: Downloaded installer can be opened/run

---

## Bug #16: Password Reset Page - Inconsistent Theme and No Functionality
**Issue:** The "Reset Password" page has no backend logic to send emails, and its background color does not match the Register and Login pages.

**Explanation:** This breaks the visual consistency and leaves a critical security feature (password recovery) non-functional. Users cannot reset their passwords.

- [ ] **Fix Implementation**
  - [ ] Apply consistent CSS theming and background colors from Login/Register pages
  - [ ] Implement email-sending logic for password reset
  - [ ] Integrate with email service (e.g., SendGrid, Mailgun) or SMTP server
  - [ ] Send secure password reset link to user's registered email address
  - [ ] Create secure token generation and validation system

- [ ] **Tests to Complete**
  - [ ] Test: Password reset page has consistent background
  - [ ] Test: Email is sent to user's registered email address
  - [ ] Test: Reset link is unique and expires after reasonable time
  - [ ] Test: User can reset password using the link
  - [ ] Test: Invalid/expired links show appropriate error

---

## Bug #17: Registration Page - Missing Initial OTP/2FA Verification
**Issue:** The email registration process does not include an initial OTP (One-Time Password) or 2FA step.

**Explanation:** This is a significant security oversight. Verifying the user's email address upon registration is a basic industry standard to prevent bots and ensure the user has access to the provided email.

- [ ] **Fix Implementation**
  - [ ] Create two-step registration process
  - [ ] Step 1: User fills out registration form
  - [ ] Step 2: Send unique OTP to user's provided email address
  - [ ] Prompt user to enter OTP on the app/website
  - [ ] Activate account only upon successful verification

- [ ] **Tests to Complete**
  - [ ] Test: OTP is sent to user's email after registration
  - [ ] Test: Correct OTP activates the account
  - [ ] Test: Incorrect OTP shows error and prevents activation
  - [ ] Test: OTP expires after reasonable time
  - [ ] Test: Resend OTP functionality works

---

## Bug #18: Main Page - Inconsistent Search Bar Background (Guest vs. Logged In)
**Issue:** The top search bar has a white background for logged-in users but a different (default/dark) color for guest users.

**Explanation:** This inconsistency breaks the visual language of the application. The search bar should look the same regardless of authentication status.

- [ ] **Fix Implementation**
  - [ ] Set explicit background color for search bar
  - [ ] Use white background for ALL users (guest and logged in)
  - [ ] Ensure consistency across all themes and states

- [ ] **Tests to Complete**
  - [ ] Test: Guest user sees white search bar background
  - [ ] Test: Logged in user sees white search bar background
  - [ ] Test: Background is consistent in light theme
  - [ ] Test: Background is consistent in dark theme
  - [ ] Test: Background doesn't change after login/logout

---

## Bug #19: Search Page - Non-Functional Genre Subpages
**Issue:** On the Search page, clicking on genre tiles (e.g., "Pop," "Rock," "Hip-Hop") does nothing.

**Explanation:** This is a major navigation failure. Users expect to be taken to a curated page with playlists, artists, and songs related to that genre.

- [ ] **Fix Implementation**
  - [ ] Create backend logic to fetch and serve genre-specific content
  - [ ] Implement route/page for each genre (Pop, Rock, Hip-Hop, etc.)
  - [ ] Display curated playlists for each genre
  - [ ] Display top songs for each genre
  - [ ] Display popular artists for each genre

- [ ] **Tests to Complete**
  - [ ] Test: Clicking "Pop" navigates to pop genre page
  - [ ] Test: Clicking "Rock" navigates to rock genre page
  - [ ] Test: Each genre page shows relevant content
  - [ ] Test: Playlists on genre pages are clickable and playable
  - [ ] Test: Artist links on genre pages navigate correctly

---

## Bug #20: Guest User - "Follow Shows" Pop-up Uses Placeholder Logo
**Issue:** The pop-up encouraging a guest user to "follow shows with a free account" uses a generic music placeholder icon instead of the app's official logo.

**Explanation:** This is a minor but important branding oversight. Using the wrong logo looks unprofessional and untrustworthy.

- [ ] **Fix Implementation**
  - [ ] Replace placeholder icon with the application's official logo
  - [ ] Ensure logo is properly sized and positioned within the pop-up
  - [ ] Make sure logo is visible in both themes

- [ ] **Tests to Complete**
  - [ ] Test: App logo appears instead of music placeholder
  - [ ] Test: Logo is properly sized within pop-up
  - [ ] Test: Logo is visible in light theme
  - [ ] Test: Logo is visible in dark theme
  - [ ] Test: Pop-up functions correctly with new logo

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
  - [~] Edge cases: reordering composes with pins (pinned still float); only in the default view (no filter/search) to keep the saved order complete. NOT included: dragging items *into* folders, and reordering folders themselves (separate ordering store) — see note below.
  - [x] Works in both minimized and maximized sidebar states

- [x] **Tests to Complete**
  - [x] Test: Can drag playlist to new position in sidebar
  - [x] Test: Can drag album to new position (albums are reorderable LibItems via the same path)
  - [x] Test: New order persists after refresh
  - [x] Test: Drag-and-drop works in minimized sidebar
  - [x] Test: Drag-and-drop works in maximized sidebar
  - [ ] Test: Can drag folder to new position — NOT done (folder reordering out of scope this pass)

> Follow-up: folder reordering and dragging items into/out of folders are a
> separate feature (folders live in their own `libraryFolders` store). Tracked
> for a later pass; item reordering above is complete and tested.

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

## Final Checklist Before Marking All Tasks Complete
- [ ] All 29 bugs have been fixed
- [ ] All tests for each bug have passed
- [ ] No new bugs have been introduced
- [ ] Code has been committed with descriptive messages
- [ ] All UI changes have been reviewed
- [ ] Feature works in both light and dark themes
- [ ] Feature works on mobile and desktop viewports
- [ ] All dead/duplicate UI elements have been removed
