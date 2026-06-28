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

- [ ] **Fix Implementation**
  - [ ] Remove Facebook login method from "Edit Login Methods" section
  - [ ] Remove Apple login method from "Edit Login Methods" section

- [ ] **Tests to Complete**
  - [ ] Test: Facebook login option is completely removed
  - [ ] Test: Apple login option is completely removed
  - [ ] Test: Only supported login methods are displayed

---

## Bug #13: Account Page - Non-Functional Search Bar
**Issue:** The search bar at the top of the Account page is present but has no functionality.

**Explanation:** This is another dead UI element. It's unclear what a search on an account page would do, making it seem broken and unprofessional.

- [ ] **Fix Implementation**
  - [ ] Remove search bar from Account page entirely
  - [ ] Or implement search function to filter through account settings if desired

- [ ] **Tests to Complete**
  - [ ] Test: Search bar is completely removed
  - [ ] Test: No dead UI elements remain
  - [ ] Test: Layout adjusts correctly after removal

---

## Bug #14: Account & Artist Dashboard Pages - Incorrect Navigation Logic
**Issue:** The top-right account button always displays "Profile" and "Account" options. When on the Account page, the "Account" option is redundant and should be swapped for the "Artist Dashboard" button.

**Explanation:** The navigation logic is not context-aware, leading to a poor user experience. The user should be able to quickly jump to the main alternative view from wherever they are.

- [ ] **Fix Implementation**
  - [ ] Create context-aware navigation logic
  - [ ] Account page: dropdown should show "Profile" and "Artist Dashboard"
  - [ ] Artist Dashboard: dropdown should show "Profile" and "Account"
  - [ ] Other pages: dropdown should show "Profile" and "Account"

- [ ] **Tests to Complete**
  - [ ] Test: Account page shows "Profile" and "Artist Dashboard"
  - [ ] Test: Artist Dashboard shows "Profile" and "Account"
  - [ ] Test: Other pages show "Profile" and "Account"
  - [ ] Test: Clicking "Profile" navigates correctly
  - [ ] Test: Clicking "Artist Dashboard" navigates correctly

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

- [ ] **Fix Implementation**
  - [ ] Use CSS prefers-color-scheme media query to detect device theme
  - [ ] Automatically apply light or dark theme based on device settings
  - [ ] Remove theme selector/controls for guest users
  - [ ] Ensure theme applies globally to all pages for guest users

- [ ] **Tests to Complete**
  - [ ] Test: Guest user sees theme based on device preference
  - [ ] Test: Theme updates when device preference changes
  - [ ] Test: Light theme works correctly on light devices
  - [ ] Test: Dark theme works correctly on dark devices
  - [ ] Test: Theme selector is hidden for guest users

---

## Bug #22: Home Page - Dynamic Hue Should Only Apply to Top Playlist Tiles

Fix Implementation

- [x] Restrict dynamic hue coloring to only the top playlist tiles on the Home page

Tests to Complete

- [x] Test: Top Home playlist tiles use artwork-based hue

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

## Final Checklist Before Marking All Tasks Complete
- [ ] All 24 bugs have been fixed
- [ ] All tests for each bug have passed
- [ ] No new bugs have been introduced
- [ ] Code has been committed with descriptive messages
- [ ] All UI changes have been reviewed
- [ ] Feature works in both light and dark themes
- [ ] Feature works on mobile and desktop viewports
- [ ] All dead/duplicate UI elements have been removed

---
