import { useEffect, useMemo, useState, type FocusEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  Globe2,
  Grid3X3,
  RotateCcw,
  Search,
  Shield,
  SlidersHorizontal,
  Smartphone,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  X,
} from 'lucide-react'
import { SpotifyMark } from '@/components/common/SpotifyMark'
import { InstallAppButton } from '@/components/common/InstallAppButton'
import { Avatar } from '@/components/ui/Avatar'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'

interface ArticleRef {
  slug: string
  title: string
}

interface HelpSection {
  id: string
  title: string
  articles: ArticleRef[]
}

interface HelpGroup {
  id: string
  title: string
  description: string
  Icon: LucideIcon
  sections: HelpSection[]
}

interface ArticleBlock {
  heading?: string
  paragraphs?: string[]
  bullets?: string[]
  ordered?: string[]
  /** Interactive follow-along guide: each string is a step the reader can tick off.
   *  Progress is saved per-article in localStorage (see GuideSteps). */
  steps?: string[]
  cta?: { label: string; href: string }
}

interface ArticleDetail extends ArticleRef {
  groupId: string
  sectionId: string
  groupTitle: string
  blocks: ArticleBlock[]
  related: string[]
}

const article = (slug: string, title: string): ArticleRef => ({ slug, title })

const SUPPORT_GROUPS: HelpGroup[] = [
  {
    id: 'payments',
    title: 'Payments & billing',
    description: 'Payment methods, charges, receipts, and subscription billing.',
    Icon: CreditCard,
    sections: [
      {
        id: 'recommended-topics',
        title: 'Recommended topics',
        articles: [
          article('price-updates', 'Price updates'),
          article('failed-payment-help', 'Failed payment help'),
          article('accepted-payment-methods', 'Accepted payment methods'),
          article('change-payment-details', 'How to change your payment details'),
          article('gift-card-not-working', 'Gift card not working'),
          article('not-spotify-gift-cards', 'Not Spotify gift cards'),
          article('how-to-cancel-premium-plans', 'How to cancel Premium plans'),
          article('payments-for-duo-plan', 'Payments for Duo plan'),
          article('payments-for-family-plan', 'Payments for Family plan'),
        ],
      },
      {
        id: 'manage-payments',
        title: 'Manage payments',
        articles: [
          article('update-payment-method', 'Update payment method'),
          article('payment-history', 'View your payment history'),
          article('manage-your-subscription', 'Manage your subscription'),
        ],
      },
      {
        id: 'payment-methods',
        title: 'Payment methods',
        articles: [
          article('accepted-payment-methods', 'Accepted payment methods'),
          article('payment-options-by-country', 'Payment options by country'),
          article('gift-card-not-working', 'Gift card not working'),
        ],
      },
      {
        id: 'charge-help',
        title: 'Charge help',
        articles: [
          article('failed-payment-help', 'Failed payment help'),
          article('canceled-but-still-charged', 'Canceled but still charged'),
          article('refund-policy', 'Refund policy'),
          article('charged-but-dont-use-premium', "Charged but don't use Not Spotify Premium"),
          article('charged-too-much', 'Charged too much'),
          article('charged-twice', 'Charged twice'),
          article('charged-for-a-free-trial', 'Charged for a free trial'),
          article('does-premium-include-tax', 'Does the price for Premium include tax?'),
          article('price-updates', 'Price updates'),
          article('contact-us', 'Contact us'),
        ],
      },
    ],
  },
  {
    id: 'account',
    title: 'Manage your account',
    description: 'Profile details, login methods, account settings, and security.',
    Icon: UserRound,
    sections: [
      {
        id: 'logging-in',
        title: 'Logging in',
        articles: [
          article('changing-how-you-log-in', 'Changing how you log in to Not Spotify'),
          article('cant-log-in-to-not-spotify', "Can't log in to Not Spotify"),
          article('not-spotify-login-methods', 'Not Spotify login methods'),
          article('reset-or-change-password', 'How to reset or change your Not Spotify password'),
          article('logging-in-with-facebook', 'Logging in to Not Spotify with Facebook'),
          article('logging-in-with-apple', 'Logging in to Not Spotify with Apple'),
          article('logging-in-with-google', 'Logging in to Not Spotify with Google'),
          article('cant-play-abroad', 'Country and playback'),
          article('disabled-accounts', 'Not Spotify disabled accounts'),
          article('log-out-of-not-spotify', 'How to log out of Not Spotify'),
        ],
      },
      {
        id: 'profile-help',
        title: 'Profile Help',
        articles: [
          article('edit-your-profile', 'Edit your profile'),
          article('change-email-address', 'Change your email address'),
          article('close-or-recover-account', 'Close or recover your account'),
        ],
      },
      {
        id: 'account-settings',
        title: 'Account settings',
        articles: [
          article('notification-settings', 'Notification settings'),
          article('privacy-settings', 'Privacy settings'),
          article('language-and-country', 'Language and country settings'),
        ],
      },
      {
        id: 'security',
        title: 'Security',
        articles: [
          article('keep-your-account-secure', 'Keep your account secure'),
          article('suspicious-account-activity', 'Suspicious account activity'),
          article('remove-saved-login-details', 'Remove saved login details'),
        ],
      },
    ],
  },
  {
    id: 'premium',
    title: 'Premium plans',
    description: 'Plan details, Family, Duo, Student, and Premium troubleshooting.',
    Icon: SlidersHorizontal,
    sections: [
      {
        id: 'available-plans',
        title: 'Available plans',
        articles: [
          article('not-spotify-premium', 'Not Spotify Premium'),
          article('premium-family', 'Premium Family'),
          article('premium-duo', 'Premium Duo'),
          article('premium-student', 'Premium Student'),
        ],
      },
      {
        id: 'plans-settings',
        title: 'Plans settings',
        articles: [
          article('your-not-spotify-plan-details', 'Your Not Spotify plan details'),
          article('how-to-cancel-premium-plans', 'How to cancel Premium plans'),
          article('how-to-change-premium-plans', 'How to change Premium plans'),
          article('premium-not-working', 'Premium not working'),
          article('cant-join-family-plan', "Can't join Family plan"),
          article('cant-join-duo-plan', "Can't join Duo plan"),
        ],
      },
      {
        id: 'premium-family',
        title: 'Premium Family',
        articles: [
          article('invite-or-remove-family-plan-members', 'Invite or remove Family plan members'),
          article('family-plan-address', 'Family plan address'),
          article('family-plan-manager', 'Family plan manager'),
        ],
      },
      {
        id: 'premium-duo',
        title: 'Premium Duo',
        articles: [
          article('join-duo-plan', 'Join Duo plan'),
          article('duo-plan-address', 'Duo plan address'),
          article('duo-manager', 'Duo manager'),
        ],
      },
      {
        id: 'premium-student',
        title: 'Premium Student',
        articles: [
          article('student-plan-verification', 'Student plan verification'),
          article('renew-student-discount', 'Renew your student discount'),
          article('student-plan-not-working', 'Student plan not working'),
        ],
      },
    ],
  },
  {
    id: 'features',
    title: 'In-app features',
    description: 'Search, playlists, recommendations, lyrics, queue, and radio.',
    Icon: Grid3X3,
    sections: [
      {
        id: 'playlists',
        title: 'Playlists',
        articles: [
          article('create-and-edit-playlists', 'Create and edit playlists'),
          article('liked-songs', 'Liked Songs'),
          article('collaborative-playlists', 'Collaborative playlists'),
        ],
      },
      {
        id: 'search-discovery',
        title: 'Search and discovery',
        articles: [
          article('search-and-browse-music', 'Search and browse music'),
          article('music-recommendations', 'Music recommendations'),
          article('browse-genres-and-moods', 'Browse genres and moods'),
        ],
      },
      {
        id: 'listening',
        title: 'Listening',
        articles: [
          article('lyrics-queue-and-recommendations', 'Lyrics, queue, and recommendations'),
          article('shuffle-and-repeat', 'Shuffle and repeat'),
          article('go-to-song-radio', 'Go to song radio'),
          article('data-saver', 'Data Saver and audio quality'),
        ],
      },
      {
        id: 'app-settings',
        title: 'App settings',
        articles: [
          article('volume-normalization', 'Volume normalization'),
          article('crossfade-and-gapless', 'Crossfade & transitions between tracks'),
          article('autoplay-tracks', 'Autoplay'),
          article('equalizer', 'Equalizer'),
          article('playback-speed', 'Playback speed'),
          article('sleep-timer', 'Sleep timer'),
          article('app-appearance', 'Appearance (light & dark)'),
          article('change-app-language', 'Change the app language'),
        ],
      },
    ],
  },
  {
    id: 'devices',
    title: 'Devices & troubleshooting',
    description: 'Playback, downloads, audio, and app troubleshooting.',
    Icon: Smartphone,
    sections: [
      {
        id: 'app-help',
        title: 'App help',
        articles: [
          article('app-not-playing-music', 'App not playing music'),
          article('app-keeps-crashing', 'App keeps crashing'),
          article('sound-or-volume-issues', 'Sound or volume issues'),
        ],
      },
      {
        id: 'downloads',
        title: 'Downloads',
        articles: [
          article('download-and-offline-listening', 'Download and offline listening'),
          article('downloads-not-working', 'Downloads not working'),
          article('remove-downloads', 'Remove downloads'),
        ],
      },
      {
        id: 'devices',
        title: 'Web player & app',
        articles: [
          article('web-player-help', 'Web player & installing the app'),
          article('sound-or-volume-issues', 'Sound or volume issues'),
        ],
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Safety & privacy',
    description: 'Privacy settings, reporting, blocked users, and account safety.',
    Icon: Shield,
    sections: [
      {
        id: 'privacy-settings',
        title: 'Privacy settings',
        articles: [
          article('privacy-settings', 'Privacy settings'),
          article('private-listening', 'Listening privacy & visibility'),
          article('download-your-data', 'Download your data'),
        ],
      },
      {
        id: 'reporting',
        title: 'Reporting',
        articles: [
          article('report-content-or-users', 'Report content or users'),
          article('blocked-users', 'Managing unwanted interactions'),
          article('copyright-claims', 'Copyright claims'),
        ],
      },
      {
        id: 'account-safety',
        title: 'Account safety',
        articles: [
          article('keep-your-account-secure', 'Keep your account secure'),
          article('suspicious-account-activity', 'Suspicious account activity'),
        ],
      },
    ],
  },
]

const QUICK_HELP_SLUGS = [
  'cant-log-in-to-not-spotify',
  'failed-payment-help',
  'charged-too-much',
  'invite-or-remove-family-plan-members',
  'app-not-playing-music',
]

const ARTICLE_INDEX = new Map<string, { article: ArticleRef; group: HelpGroup; section: HelpSection }>()
for (const group of SUPPORT_GROUPS) {
  for (const section of group.sections) {
    for (const item of section.articles) {
      if (!ARTICLE_INDEX.has(item.slug)) ARTICLE_INDEX.set(item.slug, { article: item, group, section })
    }
  }
}

const ARTICLE_DETAILS: Record<string, Partial<ArticleDetail>> = {
  'failed-payment-help': {
    blocks: [
      {
        paragraphs: [
          'Premium checkout is created through the Not Spotify billing API and then handed to Stripe. A payment can fail before checkout opens if Stripe is not configured, if the selected plan is missing its price ID, or if your payment provider declines the recurring charge.',
          'The checkout API accepts the plan keys monthly, yearly, duo, family, or student. If you see a configuration message instead of a Stripe page, the account was not charged.',
        ],
        bullets: [
          'Use a payment method accepted by Stripe in your account country.',
          'Not expired or canceled.',
          'Enable online, secure, and recurring purchases in your bank app.',
          'Try again only after checking the plan shown on the Premium page.',
        ],
        cta: { label: 'Update or change your payment details', href: supportTopicHref('update-payment-method') },
      },
      {
        heading: 'Still not working?',
        bullets: [
          'Try entering your payment details again using a private or incognito window.',
          'Try a different payment method.',
          'Wait a few hours if your bank temporarily blocks repeated attempts.',
          'If checkout says Stripe is not configured, ask an admin to check the Stripe secret key and the price ID for your plan.',
        ],
      },
      {
        heading: 'Regular payment failed?',
        paragraphs: [
          'The local subscription state is read from the user record. If a Stripe renewal fails and the webhook marks the subscription inactive, Premium features such as downloads and shared plan seats can stop until billing is fixed.',
        ],
      },
      {
        heading: 'Minimum details to send support',
        paragraphs: [
          'Include your account email, selected plan key, approximate time of the attempt, browser, country, and the exact message shown by checkout or the billing portal.',
        ],
      },
    ],
    related: ['charged-too-much', 'accepted-payment-methods', 'update-payment-method', 'contact-us'],
  },
  'charged-too-much': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify shows plan prices from the billing catalogue. The local subscription endpoint stores your plan, Stripe status, billing interval, current period end, and whether cancellation is scheduled.',
          'A higher charge is usually caused by choosing a different plan tier, moving from yearly/monthly, tax added by Stripe, or a previous failed renewal being retried.',
          'To compare the app state with Stripe:',
        ],
        ordered: [
          'Open Account and check your current plan and interval.',
          'Open the Stripe billing portal from the account page if it is available.',
          'Compare the receipt amount with the plan key shown in Not Spotify.',
        ],
      },
      {
        heading: 'Are you a student?',
        paragraphs: [
          'Student is a separate plan key in checkout. If you accidentally started monthly, yearly, duo, or family, the charge will match that plan instead of the student rate.',
        ],
      },
      {
        heading: 'What support needs',
        paragraphs: [
          'Send your account email, the receipt amount, currency, plan shown in Account, and whether the Stripe portal shows the same subscription.',
        ],
      },
    ],
    related: ['failed-payment-help', 'charged-twice', 'refund-policy', 'price-updates'],
  },
  'cant-log-in-to-not-spotify': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify login accepts email and password, plus "Continue with Google" when Google sign-in is configured on the server. The Facebook and Apple buttons are placeholders and are not enabled yet.',
        ],
        bullets: [
          'Use the exact email address you signed up with.',
          'Passwords are checked by the backend identity system; signup requires at least 8 characters.',
          'If you created your account with Google, use "Continue with Google" rather than a password.',
          'Refresh uses an httpOnly cookie named rt scoped to /auth, so blocked third-party cookies or cross-site cookie settings can break session refresh in some browsers.',
        ],
        cta: { label: 'Reset your password', href: supportTopicHref('reset-or-change-password') },
      },
      {
        heading: 'Still locked out?',
        paragraphs: [
          'Contact support with your account email, browser, whether login or refresh failed, and the exact error message. Do not send your password.',
        ],
      },
    ],
    related: ['reset-or-change-password', 'not-spotify-login-methods', 'disabled-accounts', 'keep-your-account-secure'],
  },
  'invite-or-remove-family-plan-members': {
    blocks: [
      {
        paragraphs: [
          'Shared plans use plan seats in the backend. The owner holds the Stripe subscription, and accepted members receive Premium by being linked to the owner account.',
        ],
        steps: [
          'Go to Account.',
          'Open the plan members section.',
          'Enter the member email address.',
          'Send the invite. If the user already has an account, they also receive an in-app notification.',
          'Ask the member to sign in with that email and accept the invite from Account.',
        ],
      },
      {
        heading: 'Invite not working?',
        bullets: [
          'Only Duo and Family owners can invite members.',
          'The invited email must be valid and cannot be your own email.',
          'A plan cannot exceed its seat limit. Duo has fewer seats than Family.',
          'Members who already own Premium cannot accept a shared seat until their own subscription is canceled.',
        ],
      },
    ],
    related: ['family-plan-address', 'family-plan-manager', 'cant-join-family-plan', 'payments-for-family-plan'],
  },
  'app-not-playing-music': {
    blocks: [
      {
        paragraphs: [
          'Playback depends on an approved track record and a reachable audio URL from the configured storage service. Catalogue tracks are loaded from the API, while personal uploads are resolved only for the owner.',
        ],
        steps: [
          'Check your internet connection.',
          'Make sure the app is not muted and the device volume is turned up.',
          'Try another track to see whether one source file is failing or all playback is failing.',
          'Sign out and back in if every track fails after login.',
          'For personal uploads, confirm the file type is mp3, m4a, aac, wav, ogg, oga, opus, flac, or webm and under 50 MB.',
          'If S3-backed media fails, check bucket CORS and whether presigned URLs are expiring too quickly.',
        ],
      },
      {
        heading: 'What the result means',
        bullets: [
          'If only one track fails, its stored audio key or external audio URL may be missing or unreachable.',
          'If every track fails after login, check whether your session expired and sign in again.',
          'Turn off data saver or battery saver temporarily.',
          'Clear the app cache.',
        ],
      },
    ],
    related: ['sound-or-volume-issues', 'data-saver', 'downloads-not-working', 'web-player-help'],
  },
  'update-payment-method': {
    blocks: [
      {
        paragraphs: [
          'Payment method changes are handled by the Stripe billing portal. Not Spotify stores the Stripe customer ID locally and opens a portal session when Stripe is configured.',
        ],
        ordered: [
          'Go to Account.',
          'Open the billing portal.',
          'Update the payment method in Stripe.',
          'Return to Not Spotify and refresh Account to confirm the subscription state.',
        ],
      },
      {
        heading: 'If the update fails',
        bullets: [
          'If the portal says no Stripe customer exists, start checkout at least once for the account.',
          'If the portal is unavailable, Stripe is not configured in the backend.',
          'If the new card is declined, the bank or payment provider must approve recurring online payments.',
        ],
      },
    ],
    related: ['failed-payment-help', 'accepted-payment-methods', 'payment-history', 'charged-too-much'],
  },
  'edit-your-profile': {
    blocks: [
      {
        paragraphs: [
          'The profile update endpoint accepts name, email, and country. Country must be a two-letter code such as US, SG, or MY.',
        ],
        bullets: [
          'Name cannot be blank after trimming.',
          'Email must be valid and unique across accounts.',
          'Changing email also updates the login username.',
        ],
      },
      {
        heading: 'Profile picture requirements',
        bullets: [
          'Avatar uploads are limited to 5 MB.',
          'Supported image types are jpg, jpeg, png, and webp.',
          'Uploaded avatars are stored under avatars/{userId}/{newId}.{ext}; the old avatar object is deleted after a successful upload.',
        ],
      },
    ],
    related: ['change-email-address', 'privacy-settings', 'keep-your-account-secure'],
  },
  'create-and-edit-playlists': {
    blocks: [
      {
        paragraphs: [
          'Playlist creation accepts a name, optional description, public flag, and optional smart rules. Smart playlists are generated automatically from rules and cannot be manually edited until the rules are removed.',
        ],
        bullets: [
          'Visibility can be public, friends, or private.',
          'If a public playlist is changed to private or friends-only, saved copies are removed from other users libraries.',
          'Playlist covers use the same 5 MB jpg/jpeg/png/webp image rules as avatars.',
        ],
      },
      {
        heading: 'Smart playlist rules',
        paragraphs: ['Rules can filter by genre, minimum rating, minimum play count, recently added days, and limit. If a rule validation error appears, simplify the rule set and save again.'],
        steps: [
          'Create a playlist.',
          'Choose smart playlist rules instead of manually adding tracks.',
          'Add one or more filters such as genre, minimum rating, minimum play count, recent days, or result limit.',
          'Save the playlist.',
          'Open the playlist and confirm tracks resolved automatically from the approved catalogue.',
        ],
      },
    ],
    related: ['collaborative-playlists', 'search-and-browse-music', 'liked-songs'],
  },
  'search-and-browse-music': {
    blocks: [
      {
        paragraphs: [
          'Search uses case-insensitive database matching over approved tracks, artists, albums, and public playlists. Track searches also check lyrics when the query is at least 3 characters long.',
        ],
        bullets: [
          'The optional type filter can limit results to track, artist, album, or playlist.',
          'Playlist search only returns public playlists.',
          'If a track is not approved, it will not appear in normal search results.',
        ],
      },
      {
        heading: 'Why results may look different',
        paragraphs: [
          'Home recommendations, charts, trending, and country-popular rows use play history and catalogue metadata, not the same ranking as search.',
        ],
      },
    ],
    related: ['music-recommendations', 'browse-genres-and-moods', 'lyrics-queue-and-recommendations'],
  },
  'download-and-offline-listening': {
    blocks: [
      {
        paragraphs: [
          'Track download is a Premium feature. Admins and the artist who manages a track can download their own track even if they are not using a normal Premium account.',
        ],
        bullets: [
          'The download endpoint returns 403 for free listeners.',
          'If the audio object cannot be fetched from storage, the API returns a 502 style fetch error.',
          'Album downloads are packaged as ZIP files by the backend using the same storage fetch path.',
        ],
      },
    ],
    related: ['premium-not-working', 'app-not-playing-music', 'downloads-not-working'],
  },
  'reset-or-change-password': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify accounts use an email and password (at least 8 characters). There are two ways to update your password: reset it if you are locked out, or change it from Account while you are logged in. Both sign you out of every other device for security.',
        ],
      },
      {
        heading: 'Forgot your password? Reset it',
        steps: [
          'On the log in page, select "Forgot your password?".',
          'Enter the email address for your account and select "Send reset link".',
          'Open the reset link. (In local development the link is shown right on the page, because no email service is configured.)',
          'Enter a new password (at least 8 characters) and confirm it.',
          'Log in with your new password.',
        ],
      },
      {
        heading: 'Change your password while logged in',
        steps: [
          'Open Account.',
          'Go to "Security and privacy" and select "Change password".',
          'Enter your current password, then your new password twice.',
          'Select "Update password" — other devices are signed out, and the tab you are using stays logged in.',
        ],
      },
      {
        heading: 'Good to know',
        bullets: [
          'Passwords must be at least 8 characters.',
          'Resetting or changing your password revokes all of your other sessions.',
          'Support will never ask for your password — do not share it.',
          'In production, password reset needs an email service; until one is added, ask an admin for help.',
        ],
      },
    ],
    related: ['cant-log-in-to-not-spotify', 'not-spotify-login-methods', 'keep-your-account-secure', 'changing-how-you-log-in'],
  },
  'not-spotify-login-methods': {
    blocks: [
      {
        paragraphs: [
          'You can sign in to Not Spotify in two ways: with an email and password, or with Google.',
        ],
        bullets: [
          'Email + password — set when you sign up; the password must be at least 8 characters and can be reset or changed.',
          'Continue with Google — uses Google sign-in; the first time, an account is created automatically from your Google email.',
          'Facebook and Apple buttons may appear but are not available yet.',
        ],
      },
      {
        heading: 'Which one should I use?',
        paragraphs: [
          'Use whichever you created the account with. If you signed up with email, keep using email and password (and you can reset it any time). If you used Google, choose "Continue with Google" each time — there is no separate password for Google accounts.',
        ],
      },
    ],
    related: ['logging-in-with-google', 'reset-or-change-password', 'cant-log-in-to-not-spotify', 'changing-how-you-log-in'],
  },
  'logging-in-with-google': {
    blocks: [
      {
        paragraphs: [
          'Google sign-in uses a standard secure redirect to Google and back. The first time you use it, Not Spotify creates an account from your Google email automatically; after that it simply logs you in.',
        ],
      },
      {
        heading: 'Sign in with Google',
        steps: [
          'On the log in or sign up page, select "Continue with Google".',
          'Choose the Google account you want to use and approve access.',
          'You are returned to Not Spotify and signed in automatically.',
        ],
      },
      {
        heading: 'Button greyed out or shows "not available"?',
        bullets: [
          'Google sign-in only appears when the server has Google credentials configured. If it is not set up yet, use email and password instead.',
          'Make sure your browser is not blocking the redirect to Google.',
          'If you originally signed up with email, you can keep using that — both reach the same account when the email matches.',
        ],
      },
    ],
    related: ['not-spotify-login-methods', 'cant-log-in-to-not-spotify', 'reset-or-change-password'],
  },
  'logging-in-with-facebook': {
    blocks: [
      {
        paragraphs: [
          'Logging in with Facebook is not available yet. The button may appear in the interface, but Facebook sign-in has not been enabled. Use email and password, or "Continue with Google" when it is available, instead.',
        ],
      },
    ],
    related: ['not-spotify-login-methods', 'logging-in-with-google', 'reset-or-change-password'],
  },
  'logging-in-with-apple': {
    blocks: [
      {
        paragraphs: [
          'Logging in with Apple is not available yet. The button may appear in the interface, but Apple sign-in has not been enabled. Use email and password, or "Continue with Google" when it is available, instead.',
        ],
      },
    ],
    related: ['not-spotify-login-methods', 'logging-in-with-google', 'reset-or-change-password'],
  },
  'not-spotify-gift-cards': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify does not sell prepaid, stored-value gift cards. What you can redeem is a promotion code — a discount or free-period coupon — on the Premium checkout page.',
        ],
      },
      {
        heading: 'Redeem a code',
        steps: [
          'Open the Premium page and choose a plan.',
          'On the secure checkout page, find the "Add promotion code" field.',
          'Enter your code and apply it — the total updates before you pay.',
          'Complete payment. Premium activates once the payment is confirmed.',
        ],
      },
      {
        heading: 'Good to know',
        bullets: [
          'Promotion codes are created by the team in the payment dashboard; the app does not generate them.',
          'A code only works if it is active and matches the plan or conditions it was made for.',
          'If the Premium page shows a configuration message, checkout (and codes) are not set up yet.',
        ],
      },
    ],
    related: ['gift-card-not-working', 'how-to-cancel-premium-plans', 'accepted-payment-methods', 'failed-payment-help'],
  },
  'gift-card-not-working': {
    blocks: [
      {
        paragraphs: [
          'On Not Spotify, a "gift card" code is a promotion code entered on the checkout page (not in the app). If a code will not apply, work through the checks below.',
        ],
        bullets: [
          'Type the code exactly — promotion codes can be case-sensitive.',
          'The code may be expired, fully redeemed, or limited to a specific plan or billing interval.',
          'Codes apply on the checkout page: open Premium, choose a plan, then look for "Add promotion code".',
          'If there is no promotion-code field at checkout, payments are not fully configured yet.',
        ],
      },
      supportMinimumBlock([
        'The exact code (you can mask part of it).',
        'The plan and interval you selected.',
        'The exact message shown at checkout.',
        'Account email.',
      ]),
    ],
    related: ['not-spotify-gift-cards', 'failed-payment-help', 'accepted-payment-methods', 'contact-us'],
  },
  'data-saver': {
    blocks: [
      {
        paragraphs: [
          'Streaming quality controls how much data your audio uses. Not Spotify offers tiers from Low to Very High, plus Auto. Free accounts stream up to Normal (~128 kbps); High and Very High require Premium.',
        ],
      },
      {
        heading: 'Turn on Data Saver',
        steps: [
          'Open Settings.',
          'Under Audio, turn on "Data Saver".',
          'Playback immediately switches to Low quality to use less data — the quality picker is locked while Data Saver is on.',
          'Turn it off any time to return to your chosen quality.',
        ],
      },
      {
        heading: 'Choosing a quality tier',
        bullets: [
          'Auto adapts to your connection; Low uses the least data and Very High the most.',
          'Quality changes apply right away — no restart needed.',
          'Lower tiers roll off the highest frequencies, so audio sounds slightly softer at the top end.',
          'Free accounts are capped at Normal; upgrade to Premium for High and Very High.',
        ],
      },
    ],
    related: ['app-not-playing-music', 'sound-or-volume-issues', 'download-and-offline-listening'],
  },

  // ── Phase 1 honesty rewrites ──
  'keep-your-account-secure': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify protects your account with a password and short-lived access tokens backed by a rotating refresh token. There is no separate two-factor (2FA) step yet, so the most important things you can do are keep your password private and sign out of devices you no longer use.',
        ],
        bullets: [
          'Use a strong, unique password (at least 8 characters) and never share it — support will never ask for it.',
          'Logging out revokes that device\'s refresh token, so the session can\'t be refreshed again.',
          'Changing or resetting your password signs you out of every other device.',
          'Your email address is also your login, so protect access to your email inbox too.',
        ],
      },
      {
        heading: 'Lock down your account',
        steps: [
          'Open Account → "Security and privacy".',
          'Select "Change password" and set a new, unique password.',
          'Use "Sign out everywhere" to drop every other active session.',
          'Log out on any shared or public computer when you finish.',
        ],
      },
    ],
    related: ['reset-or-change-password', 'suspicious-account-activity', 'cant-log-in-to-not-spotify', 'log-out-of-not-spotify'],
  },
  'web-player-help': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify runs in your web browser — there is nothing to install to start listening. You can also install it as an app (PWA) for a windowed, app-like experience, or run the optional desktop build.',
        ],
        bullets: [
          'Best experience is in a Chromium browser (Chrome or Edge), especially for the Picture-in-Picture mini-player and OS media keys.',
          'Playback uses your browser and operating system\'s audio output — there is no separate "connect to a speaker" device list.',
          'Audio streams over HTTPS, so a blocked mixed-content or storage request can stop playback (see "App not playing music").',
        ],
      },
      {
        heading: 'Install it as an app',
        steps: [
          'Open Not Spotify in Chrome or Edge.',
          'Use the install icon in the address bar (or browser menu → "Install").',
          'Launch it from your apps list — it opens in its own window and works offline for the app shell.',
        ],
      },
    ],
    related: ['app-not-playing-music', 'sound-or-volume-issues', 'download-and-offline-listening'],
  },
  'private-listening': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify does not have a temporary "private session" mode. Instead, your privacy is controlled by playlist visibility and your presence settings, and you can always log out to stop a shared device from acting as you.',
        ],
        bullets: [
          'Playlists can be Public, Friends-only, or Private — Private playlists are visible only to you.',
          'Changing a public playlist to Private or Friends-only removes saved copies from other users\' libraries.',
          'Friend Activity and presence show what you\'re playing to friends; listening is tied to your authenticated account.',
          'There is no anonymous/incognito listening toggle — log out if you don\'t want activity attributed to you.',
        ],
      },
    ],
    related: ['privacy-settings', 'create-and-edit-playlists', 'keep-your-account-secure'],
  },

  // ── Phase 3: App settings cluster ──
  'volume-normalization': {
    blocks: [
      {
        paragraphs: [
          'Volume normalization evens out loudness so quiet and loud tracks play at a more consistent level. Not Spotify applies it in the audio engine as a gain stage, so the change is heard immediately — no restart needed.',
        ],
      },
      {
        heading: 'Turn it on or off',
        steps: [
          'Open Settings.',
          'Find the Audio section.',
          'Toggle "Volume normalization" on or off — it applies to the current track right away.',
        ],
      },
    ],
    related: ['data-saver', 'crossfade-and-gapless', 'sound-or-volume-issues'],
  },
  'crossfade-and-gapless': {
    blocks: [
      {
        paragraphs: [
          'Crossfade overlaps the end of one track with the start of the next so there is no silence between songs. You choose the length, from off up to 12 seconds. Gapless playback (for albums recorded to run continuously) is handled automatically by the two-deck audio engine.',
        ],
      },
      {
        heading: 'Set your crossfade length',
        steps: [
          'Open Settings.',
          'Go to the Playback section.',
          'Set "Crossfade" to Off, 3, 6, 9, or 12 seconds.',
          'Play two tracks back to back to hear the overlap.',
        ],
      },
    ],
    related: ['autoplay-tracks', 'volume-normalization', 'data-saver'],
  },
  'autoplay-tracks': {
    blocks: [
      {
        paragraphs: [
          'Autoplay keeps the music going: when your queue or playlist ends, Not Spotify continues with similar tracks instead of stopping. It uses the same recommendation signals as song radio.',
        ],
      },
      {
        heading: 'Turn Autoplay on or off',
        steps: [
          'Open Settings.',
          'Go to the Playback section.',
          'Toggle "Autoplay" on to keep playing, or off to stop at the end of the queue.',
        ],
      },
    ],
    related: ['go-to-song-radio', 'crossfade-and-gapless', 'shuffle-and-repeat'],
  },
  'equalizer': {
    blocks: [
      {
        paragraphs: [
          'The equalizer shapes the tone of playback using presets (for example Bass Booster, Vocal, or Treble Boost). It runs in the audio engine, so switching a preset changes the sound of the current track immediately.',
        ],
      },
      {
        heading: 'Choose an equalizer preset',
        steps: [
          'Start playing a track so the player bar is visible.',
          'Open the equalizer control from the player.',
          'Pick a preset — the change applies straight away.',
          'Choose the flat/Off preset to return to the original sound.',
        ],
      },
    ],
    related: ['volume-normalization', 'data-saver', 'sound-or-volume-issues'],
  },
  'playback-speed': {
    blocks: [
      {
        paragraphs: [
          'Playback speed lets you play audio faster or slower than normal — handy for podcasts and spoken-word episodes. The control cycles through the available rates and shows the current one (for example 1×, 1.25×, 1.5×).',
        ],
      },
      {
        heading: 'Change the speed',
        steps: [
          'Start playing a track or podcast episode.',
          'Find the speed control in the player bar (it shows the current rate, like 1×).',
          'Click it to cycle to the next speed; keep clicking to return to 1×.',
        ],
      },
    ],
    related: ['sleep-timer', 'lyrics-queue-and-recommendations', 'app-not-playing-music'],
  },
  'sleep-timer': {
    blocks: [
      {
        paragraphs: [
          'The sleep timer stops playback after a set number of minutes — useful for falling asleep to music. When the timer runs out, playback pauses automatically.',
        ],
      },
      {
        heading: 'Set a sleep timer',
        steps: [
          'Start playing something.',
          'Open the sleep-timer (moon) control in the player.',
          'Choose how many minutes until playback should stop.',
          'To cancel early, open the same control and turn the timer off.',
        ],
      },
    ],
    related: ['playback-speed', 'autoplay-tracks', 'app-not-playing-music'],
  },
  'app-appearance': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify supports light and dark themes, and tints parts of the interface using colours pulled from the current cover art. Your theme choice is saved on this device.',
        ],
      },
      {
        heading: 'Switch theme',
        steps: [
          'Open Settings.',
          'Go to the Appearance section.',
          'Choose Dark or Light — the interface updates instantly.',
        ],
      },
    ],
    related: ['change-app-language', 'data-saver', 'web-player-help'],
  },
  'change-app-language': {
    blocks: [
      {
        paragraphs: [
          'You can switch the interface language between English, Spanish, and French. The choice applies across the app shell, Home, Search, Library, and Settings, and is saved on this device.',
        ],
      },
      {
        heading: 'Change the language',
        steps: [
          'Open Settings.',
          'Go to the Language section.',
          'Choose English, Español, or Français — the interface updates right away.',
        ],
      },
      {
        paragraphs: [
          'Some detailed views are still being translated, so a few labels may remain in English while that work continues.',
        ],
      },
    ],
    related: ['app-appearance', 'edit-your-profile', 'language-and-country'],
  },

  // ── Phase 3: Playback & listening ──
  'shuffle-and-repeat': {
    blocks: [
      {
        paragraphs: [
          'How shuffle and repeat behave depends on your plan. This is the clearest difference between Free and Premium listening.',
        ],
      },
      {
        heading: 'On Free',
        bullets: [
          'Shuffle is always on and cannot be turned off.',
          'Repeat is not available.',
          'Picking a specific track starts the playlist from a random position rather than that exact song.',
        ],
      },
      {
        heading: 'On Premium',
        bullets: [
          'Turn shuffle on or off freely.',
          'Repeat the whole queue (repeat all) or a single track (repeat one).',
          'Play any track directly, in any order, from any source.',
        ],
      },
    ],
    related: ['lyrics-queue-and-recommendations', 'autoplay-tracks', 'not-spotify-premium', 'go-to-song-radio'],
  },
  'lyrics-queue-and-recommendations': {
    blocks: [
      {
        heading: 'Lyrics',
        paragraphs: [
          'Many tracks have time-synced "karaoke" lyrics: the current line highlights and the view auto-scrolls as the song plays, and you can click any line to jump to that moment. Lyrics are fetched from public lyric sources, so instrumental tracks (or songs with no match) simply show no lyrics.',
        ],
      },
      {
        heading: 'Queue & play next',
        bullets: [
          'Add a track to the queue, or use "Play next" to slot it right after the current song.',
          'Open the queue to see what\'s coming up in "Up next".',
          'Premium can drag to reorder the queue; on Free the order is managed for you.',
        ],
      },
      {
        heading: 'What plays after the queue',
        paragraphs: [
          'When the queue runs out, Autoplay (if on) keeps the music going with similar tracks. You can also start an endless station from any song with "Go to song radio".',
        ],
      },
    ],
    related: ['shuffle-and-repeat', 'go-to-song-radio', 'autoplay-tracks', 'playback-speed'],
  },
  'go-to-song-radio': {
    blocks: [
      {
        paragraphs: [
          'Song radio turns any track into an endless station of similar music. It ranks the catalogue by how often listeners played candidates in the same sessions as your seed track (co-listen similarity), how much the genres overlap, and a boost for the same artist — the seed song plays first. The same engine powers the "Fans also like" related-artists row.',
        ],
      },
      {
        heading: 'Start a song radio',
        steps: [
          'Open the "…" (more) menu on any track.',
          'Choose "Go to song radio".',
          'The station starts with that song and keeps playing related tracks.',
        ],
      },
    ],
    related: ['lyrics-queue-and-recommendations', 'autoplay-tracks', 'music-recommendations', 'shuffle-and-repeat'],
  },

  // ── Phase 3: Playlists, library & discovery ──
  'liked-songs': {
    blocks: [
      {
        paragraphs: [
          'Liked Songs is your personal, automatic collection of every track you\'ve liked. It\'s available on both Free and Premium — liking, unliking, and viewing all work the same on either plan.',
        ],
      },
      {
        heading: 'Like or unlike a track',
        steps: [
          'Play a track, or open its "…" menu.',
          'Select the heart to like it — it\'s added to Liked Songs instantly.',
          'Select the heart again to unlike and remove it.',
        ],
      },
      {
        paragraphs: [
          'You can also save whole albums to your library; saved albums and Liked Songs both appear in your Library.',
        ],
      },
    ],
    related: ['create-and-edit-playlists', 'collaborative-playlists', 'search-and-browse-music'],
  },
  'collaborative-playlists': {
    blocks: [
      {
        paragraphs: [
          'A collaborative playlist lets people you invite add and remove tracks alongside you. Only the owner controls who can collaborate; collaborators edit the track list together.',
        ],
      },
      {
        heading: 'Make a playlist collaborative',
        steps: [
          'Open a playlist you own.',
          'Open its "…" menu and invite a collaborator.',
          'They accept the invite and can then add or remove tracks.',
          'Remove a collaborator any time from the same menu to stop their access.',
        ],
      },
      {
        heading: 'Visibility still applies',
        paragraphs: [
          'Collaboration is about who can edit; visibility (public, friends-only, or private) controls who can see the playlist. A private collaborative playlist is only visible to you and your collaborators.',
        ],
      },
    ],
    related: ['create-and-edit-playlists', 'liked-songs', 'privacy-settings'],
  },
  'music-recommendations': {
    blocks: [
      {
        paragraphs: [
          'The Home page is built from several recommendation rows, each using different signals from your listening and the catalogue. They are not the same ranking as Search, so results can differ.',
        ],
        bullets: [
          'For You — based on the genres of what you played in the last 30 days (falls back to Trending for new listeners).',
          'Trending — what\'s popular right now, weighting the last 7 days heavily over all-time plays.',
          'New Music — the most recently added catalogue tracks.',
          'Daily Mixes — one mix per your top genres from the last 90 days.',
          'Charts — the Top 50 by plays this week.',
          'Popular in {country} — top tracks among listeners in your country over the last 30 days.',
          'Recently played — your most recent distinct tracks.',
        ],
      },
    ],
    related: ['search-and-browse-music', 'browse-genres-and-moods', 'go-to-song-radio'],
  },
  'browse-genres-and-moods': {
    blocks: [
      {
        paragraphs: [
          'Beyond search, you can browse the catalogue by genre and by mood or activity. Each genre or mood opens its own page of tracks and playlists so you can dig into a style or a vibe.',
        ],
        bullets: [
          'Genres group music by style; open one to see its tracks and related playlists.',
          'Moods & activities (for example focus, workout, chill) collect fitting music for the moment.',
          'These pages use catalogue metadata, so they fill out as more music is tagged.',
        ],
      },
    ],
    related: ['music-recommendations', 'search-and-browse-music', 'go-to-song-radio'],
  },
  'accepted-payment-methods': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify payments are processed by Stripe Checkout. The exact cards, wallets, and local payment methods you see depend on the Stripe account country, currency, and the plan price configured by the team.',
        ],
        bullets: [
          'Use a payment method that supports online recurring payments.',
          'Do not send support full card numbers, CVC codes, bank passwords, or one-time passcodes.',
          'If Checkout does not open, no payment method was charged in Not Spotify.',
        ],
      },
    ],
    related: ['failed-payment-help', 'update-payment-method', 'payment-options-by-country', 'not-spotify-gift-cards'],
  },
  'change-payment-details': {
    blocks: [
      {
        paragraphs: [
          'Changing payment details uses the same Stripe billing portal as "Update payment method". Not Spotify opens the portal for accounts that already have a Stripe customer ID.',
        ],
        steps: [
          'Open Account.',
          'In Subscription, choose "Manage billing".',
          'Update the payment method in the Stripe portal.',
          'Return to Not Spotify and refresh Account if the subscription status has not updated yet.',
        ],
      },
    ],
    related: ['update-payment-method', 'manage-your-subscription', 'failed-payment-help', 'payment-history'],
  },
  'payment-history': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify stores your current subscription state, but receipts and invoice history live in Stripe. Use the billing portal to view payment history when Stripe is configured for your account.',
        ],
        bullets: [
          'Account shows the current plan, billing interval, Stripe status, renewal date, and cancellation flag.',
          'Stripe shows the official receipt and payment method details.',
          'If the portal is unavailable, the account may not have completed Checkout yet.',
        ],
      },
    ],
    related: ['manage-your-subscription', 'charged-too-much', 'charged-twice', 'update-payment-method'],
  },
  'manage-your-subscription': {
    blocks: [
      {
        paragraphs: [
          'Your subscription is managed from Account. The app can open Stripe Checkout, open the billing portal, cancel Premium locally, and refresh your auth token so Premium gates update immediately.',
        ],
        steps: [
          'Open Account.',
          'Check the plan card for your current plan and renewal date.',
          'Use "Manage billing" to update payment details in Stripe, or "Cancel subscription" to downgrade to Free.',
          'Refresh the page if a webhook update has not appeared yet.',
        ],
      },
    ],
    related: ['your-not-spotify-plan-details', 'how-to-cancel-premium-plans', 'update-payment-method', 'not-spotify-premium'],
  },
  'payment-options-by-country': {
    blocks: [
      {
        paragraphs: [
          'Payment availability by country is decided by Stripe and the configured price currency. Not Spotify passes the selected plan to Checkout; Stripe decides which payment methods can be shown.',
        ],
        bullets: [
          'Your account country is a two-letter code used elsewhere in the app, but Checkout behavior is controlled by Stripe.',
          'If a local method is missing, try a card that supports recurring online payments.',
          'If every payment option is missing, the selected plan may not have a configured Stripe price ID.',
        ],
      },
    ],
    related: ['accepted-payment-methods', 'failed-payment-help', 'language-and-country', 'price-updates'],
  },
  'canceled-but-still-charged': {
    blocks: [
      {
        paragraphs: [
          'Canceling Premium in Not Spotify downgrades the account to Free immediately and releases any shared Duo or Family seats owned by that account. A later charge usually means Stripe did not receive the cancellation or another account still owns an active subscription.',
        ],
        bullets: [
          'Check Account for the plan and Stripe status shown on this login.',
          'Open the Stripe billing portal and compare the active subscription there.',
          'Confirm you are signed into the same email that originally paid.',
        ],
      },
    ],
    related: ['how-to-cancel-premium-plans', 'charged-too-much', 'charged-twice', 'contact-us'],
  },
  'charged-but-dont-use-premium': {
    blocks: [
      {
        paragraphs: [
          'A charge is tied to the Stripe customer on the account that started Checkout. If this account is Free, the paid subscription may belong to another Not Spotify login or to a plan owner who invited you as a member.',
        ],
        bullets: [
          'Check other email addresses you may have used for Checkout.',
          'Ask the Duo or Family owner whether they still hold the paid plan.',
          'Use the receipt email from Stripe to identify which account was charged.',
        ],
      },
    ],
    related: ['payment-history', 'manage-your-subscription', 'failed-payment-help', 'contact-us'],
  },
  'charged-twice': {
    blocks: [
      {
        paragraphs: [
          'Duplicate-looking charges can happen when a bank shows an authorization and a final charge, when two accounts subscribed separately, or when a failed renewal is retried.',
        ],
        bullets: [
          'Compare receipt dates and subscription IDs in Stripe.',
          'Check whether another Not Spotify email also has Premium.',
          'If one line disappears after a few days, it was likely a temporary authorization.',
        ],
      },
    ],
    related: ['charged-too-much', 'payment-history', 'failed-payment-help', 'refund-policy'],
  },
  'charged-for-a-free-trial': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify does not create its own free-trial system. If a trial exists, it is configured directly in Stripe for a plan price or promotion code, and Checkout shows the amount before payment is completed.',
        ],
        bullets: [
          'Review the total on the Stripe Checkout page before paying.',
          'Promotion codes can reduce the price only when they are active for the selected plan.',
          'If you were charged unexpectedly, compare the receipt with the plan and code used at Checkout.',
        ],
      },
    ],
    related: ['not-spotify-gift-cards', 'charged-too-much', 'refund-policy', 'failed-payment-help'],
  },
  'does-premium-include-tax': {
    blocks: [
      {
        paragraphs: [
          'Tax is handled by Stripe according to the payment configuration. Not Spotify plan cards show the configured plan price, while Stripe Checkout and receipts are the source of truth for final tax and currency details.',
        ],
        bullets: [
          'Check the final total in Checkout before confirming payment.',
          'Use the Stripe receipt for tax records.',
          'If the app price and receipt differ, include both when asking support to investigate.',
        ],
      },
    ],
    related: ['price-updates', 'charged-too-much', 'payment-history', 'accepted-payment-methods'],
  },
  'refund-policy': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify does not have an automatic refund button. Subscription state can be canceled locally, but refunds must be handled by the project team through Stripe after checking the account and receipt.',
        ],
        bullets: [
          'Cancel Premium first if you do not want future renewal attempts.',
          'Keep the Stripe receipt date, amount, and customer email available.',
          'Do not share full card details or bank login information.',
        ],
      },
    ],
    related: ['how-to-cancel-premium-plans', 'charged-too-much', 'charged-twice', 'contact-us'],
  },
  'price-updates': {
    blocks: [
      {
        paragraphs: [
          'Plan prices come from the billing catalogue and Stripe price IDs configured on the server. If a price changes, the Premium page reads the updated catalogue and Checkout uses the matching Stripe price.',
        ],
        bullets: [
          'Monthly, yearly, Duo, Family, and Student are separate plan keys.',
          'A missing price ID makes that plan unavailable instead of charging a guessed amount.',
          'Existing subscriptions follow Stripe subscription behavior for renewals and receipts.',
        ],
      },
    ],
    related: ['not-spotify-premium', 'your-not-spotify-plan-details', 'does-premium-include-tax', 'payment-history'],
  },
  'not-spotify-premium': {
    blocks: [
      {
        paragraphs: [
          'Premium removes Free listening limits and unlocks plan-gated features such as direct track picking, repeat, queue reordering, higher audio quality, downloads, and no audio ads.',
        ],
      },
      {
        heading: 'Upgrade to Premium',
        steps: [
          'Open Premium.',
          'Choose Individual, Yearly, Duo, Family, or Student.',
          'Review the price and any promotion code in Stripe Checkout.',
          'Complete payment and return to Not Spotify.',
          'Refresh your session if Premium controls do not unlock immediately.',
        ],
      },
    ],
    related: ['your-not-spotify-plan-details', 'how-to-change-premium-plans', 'premium-not-working', 'accepted-payment-methods'],
  },
  'premium-family': {
    blocks: [
      {
        paragraphs: [
          'Premium Family is a shared plan tier with one owner and several member seats. The owner pays through Stripe; accepted members receive Premium through a PlanMembership row linked to the owner.',
        ],
        bullets: [
          'The owner manages invites from Account.',
          'Pending invites count toward the seat limit.',
          'Removing a member releases the seat and returns that member to Free.',
        ],
      },
    ],
    related: ['invite-or-remove-family-plan-members', 'family-plan-manager', 'family-plan-address', 'payments-for-family-plan'],
  },
  'premium-duo': {
    blocks: [
      {
        paragraphs: [
          'Premium Duo works like Family with a smaller seat count: one plan owner and one invited member. The member gets Premium while the owner subscription is active.',
        ],
        bullets: [
          'Duo invites are sent by email from Account.',
          'The invited account must accept before the seat becomes active.',
          'A member with their own Premium subscription cannot accept a shared seat until that subscription is canceled.',
        ],
      },
    ],
    related: ['join-duo-plan', 'duo-manager', 'duo-plan-address', 'payments-for-duo-plan'],
  },
  'premium-student': {
    blocks: [
      {
        paragraphs: [
          'Premium Student is a separate Stripe plan key. Not Spotify does not run an in-app student verification provider, so availability depends on whether the team configured a Student price for the demo environment.',
        ],
        bullets: [
          'Choose Student on the Premium page when it is available.',
          'If Checkout says the plan is not configured, ask an admin to set the Stripe Student price ID.',
          'Student is an individual plan and does not include shared member seats.',
        ],
      },
    ],
    related: ['student-plan-verification', 'student-plan-not-working', 'renew-student-discount', 'not-spotify-premium'],
  },
  'your-not-spotify-plan-details': {
    blocks: [
      {
        paragraphs: [
          'Account shows your current plan, tier, billing interval, Stripe status, renewal date, and whether cancellation is scheduled. Shared-plan members also see who owns the plan that gives them Premium.',
        ],
        bullets: [
          'Free accounts can open Premium to compare plans.',
          'Premium owners can open the billing portal or cancel.',
          'Duo and Family owners see member seats and pending invites.',
        ],
      },
    ],
    related: ['manage-your-subscription', 'not-spotify-premium', 'invite-or-remove-family-plan-members', 'payment-history'],
  },
  'how-to-cancel-premium-plans': {
    blocks: [
      {
        paragraphs: [
          'Canceling from Account downgrades the current user to Free and refreshes the auth token so Premium-only controls lock again. If you own Duo or Family, member seats are released too.',
        ],
        steps: [
          'Open Account.',
          'In Subscription, choose "Cancel subscription".',
          'Confirm the cancellation dialog.',
          'Wait for Account to refresh your plan to Free.',
          'If Stripe still shows an active subscription, open the billing portal and compare the subscription there.',
        ],
      },
    ],
    related: ['manage-your-subscription', 'canceled-but-still-charged', 'refund-policy', 'premium-not-working'],
  },
  'how-to-change-premium-plans': {
    blocks: [
      {
        paragraphs: [
          'Plan changes are handled by starting Checkout for the new plan or managing the existing subscription in Stripe. The backend supports the plan keys monthly, yearly, duo, family, and student.',
        ],
        bullets: [
          'Use Premium to start Checkout for a new plan when you are Free.',
          'Use the Stripe billing portal when you already have a Stripe customer.',
          'If changing from a shared seat to your own subscription, leave the shared plan first.',
        ],
      },
    ],
    related: ['not-spotify-premium', 'manage-your-subscription', 'premium-family', 'premium-duo'],
  },
  'premium-not-working': {
    blocks: [
      {
        paragraphs: [
          'Premium gates read your current user record and token. If payment succeeded but Premium controls still look locked, the webhook or token refresh may not have caught up yet.',
        ],
        bullets: [
          'Refresh the page or sign out and in again.',
          'Open Account and confirm it shows Premium.',
          'If Account is still Free after Checkout, ask an admin to check Stripe webhook delivery and the subscription ID.',
          'For shared seats, confirm the owner plan is still active and your invite status is active.',
        ],
      },
    ],
    related: ['your-not-spotify-plan-details', 'failed-payment-help', 'how-to-change-premium-plans', 'download-and-offline-listening'],
  },
  'cant-join-family-plan': {
    blocks: [
      {
        paragraphs: [
          'Family invites are matched to the invited email address. Joining can fail when the invite is expired or removed, the owner has no seats left, or your account already owns Premium.',
        ],
        bullets: [
          'Sign in with the email that received the invite.',
          'Ask the owner to check whether the invite is still pending.',
          'Cancel your own Premium before accepting a shared seat.',
        ],
      },
    ],
    related: ['invite-or-remove-family-plan-members', 'premium-family', 'family-plan-manager', 'premium-not-working'],
  },
  'cant-join-duo-plan': {
    blocks: [
      {
        paragraphs: [
          'Duo has one owner and one member seat. If you cannot join, the invite may be for a different email, the seat may already be used, or your account may already own Premium.',
        ],
        bullets: [
          'Use the invited email address.',
          'Ask the owner to remove any old pending invite and send a new one.',
          'If you are already Premium, cancel your own subscription before accepting.',
        ],
      },
    ],
    related: ['join-duo-plan', 'premium-duo', 'duo-manager', 'premium-not-working'],
  },
  'payments-for-family-plan': {
    blocks: [
      {
        paragraphs: [
          'The Family owner pays the Stripe subscription. Members do not add payment methods for their shared seats; their Premium access comes from the owner account while the subscription is active.',
        ],
        bullets: [
          'If the owner cancels, members return to Free.',
          'If a member leaves or is removed, only that seat is released.',
          'Receipts are available to the owner through Stripe.',
        ],
      },
    ],
    related: ['premium-family', 'family-plan-manager', 'invite-or-remove-family-plan-members', 'payment-history'],
  },
  'payments-for-duo-plan': {
    blocks: [
      {
        paragraphs: [
          'The Duo owner pays the subscription and controls the one member invite. The invited member does not pay through their own account for that shared seat.',
        ],
        bullets: [
          'Only the owner can update payment details in Stripe.',
          'The member keeps Premium only while the owner plan is active.',
          'If the member starts their own Premium later, they should leave Duo first.',
        ],
      },
    ],
    related: ['premium-duo', 'duo-manager', 'join-duo-plan', 'payment-history'],
  },
  'family-plan-manager': {
    blocks: [
      {
        paragraphs: [
          'The Family plan manager is the account that started the Family subscription. That owner can invite members, remove members, update billing through Stripe, and cancel the plan.',
        ],
        bullets: [
          'Manager status cannot be transferred in the app.',
          'Members can leave a shared plan but cannot manage the owner subscription.',
          'When the owner cancels, all shared seats are released.',
        ],
      },
    ],
    related: ['premium-family', 'invite-or-remove-family-plan-members', 'payments-for-family-plan', 'family-plan-address'],
  },
  'family-plan-address': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify does not currently collect or verify a household address for Family. The app enforces seat count and invite ownership, not address matching.',
        ],
        bullets: [
          'Use Account to manage invited emails.',
          'If address verification is added later, this article should be updated before the UI ships.',
          'For now, joining issues are usually invite email, seat count, or existing Premium ownership problems.',
        ],
      },
    ],
    related: ['premium-family', 'cant-join-family-plan', 'invite-or-remove-family-plan-members', 'family-plan-manager'],
  },
  'join-duo-plan': {
    blocks: [
      {
        paragraphs: [
          'You can join Duo when the owner invites the same email address you use for Not Spotify and the Duo seat is available.',
        ],
        steps: [
          'Sign in with the invited email.',
          'Open Account.',
          'Find the incoming Duo invite in the plan members area.',
          'Accept the invite.',
          'Refresh the page if Premium controls do not unlock immediately.',
        ],
      },
    ],
    related: ['premium-duo', 'cant-join-duo-plan', 'duo-manager', 'payments-for-duo-plan'],
  },
  'duo-manager': {
    blocks: [
      {
        paragraphs: [
          'The Duo manager is the account that pays for Duo. They control the billing portal, cancellation, and the single member invite.',
        ],
        bullets: [
          'The member can leave Duo from Account.',
          'The manager can remove the member and invite someone else.',
          'Manager ownership cannot be moved to the member in the app.',
        ],
      },
    ],
    related: ['premium-duo', 'join-duo-plan', 'payments-for-duo-plan', 'duo-plan-address'],
  },
  'duo-plan-address': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify Duo does not currently collect or verify an address. The app checks the invite email, seat limit, and subscription state.',
        ],
        bullets: [
          'If you cannot join, make sure the invite is addressed to your account email.',
          'Ask the manager to remove old pending invites before sending a new one.',
          'Cancel your own Premium before accepting a shared Duo seat.',
        ],
      },
    ],
    related: ['premium-duo', 'cant-join-duo-plan', 'duo-manager', 'join-duo-plan'],
  },
  'student-plan-verification': {
    blocks: [
      {
        paragraphs: [
          'Student is a separate plan key in Not Spotify, but there is no in-app student verification provider. If the demo environment offers Student, it is because the team configured a Student Stripe price.',
        ],
        bullets: [
          'Choose Student on Premium only when it appears as available.',
          'If Checkout fails with missing configuration, the Student price ID is not set.',
          'Do not send student documents through support unless a real verification flow is added later.',
        ],
      },
    ],
    related: ['premium-student', 'student-plan-not-working', 'renew-student-discount', 'failed-payment-help'],
  },
  'student-plan-not-working': {
    blocks: [
      {
        paragraphs: [
          'Student plan problems are usually billing configuration problems, because Not Spotify does not run a separate verification service. Checkout must have the Student price ID configured before it can work.',
        ],
        bullets: [
          'Try the normal Premium plan to confirm Checkout works at all.',
          'Check whether the Student plan card shows a configuration message.',
          'Ask an admin to verify the Student Stripe price ID.',
        ],
      },
    ],
    related: ['premium-student', 'student-plan-verification', 'failed-payment-help', 'accepted-payment-methods'],
  },
  'renew-student-discount': {
    blocks: [
      {
        paragraphs: [
          'There is no automatic student-renewal workflow in Not Spotify. Student access follows the Stripe subscription attached to the Student plan price.',
        ],
        bullets: [
          'Use Account to see whether the subscription is active.',
          'If the Student plan is no longer available, choose another Premium plan.',
          'If a real verification provider is added later, this article should be updated before renewal prompts ship.',
        ],
      },
    ],
    related: ['premium-student', 'student-plan-verification', 'how-to-change-premium-plans', 'price-updates'],
  },
  'changing-how-you-log-in': {
    blocks: [
      {
        paragraphs: [
          'You can keep using email and password, or Google when the server has Google credentials. Not Spotify does not currently link or unlink Facebook or Apple accounts.',
        ],
        bullets: [
          'To change an email/password login, update your email or password from Account.',
          'Google login creates or signs into the account with the matching Google email.',
          'If you changed your email, use the new email the next time you sign in with password.',
        ],
      },
    ],
    related: ['not-spotify-login-methods', 'logging-in-with-google', 'reset-or-change-password', 'change-email-address'],
  },
  'cant-play-abroad': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify does not geo-lock playback. Your country setting helps personalize rows such as "Popular in your country", but it does not block songs when you travel.',
        ],
        bullets: [
          'If music will not play while abroad, treat it as a network, storage, login, or browser playback issue.',
          'Update your country in your profile if local recommendation rows look wrong.',
          'There is no travel limit or country-mismatch lock in this app.',
        ],
      },
    ],
    related: ['language-and-country', 'app-not-playing-music', 'search-and-browse-music', 'music-recommendations'],
  },
  'disabled-accounts': {
    blocks: [
      {
        paragraphs: [
          'There is no public self-service disabled-account appeal flow. If an account cannot sign in and password reset does not help, an admin needs to check the user record and roles.',
        ],
        bullets: [
          'Try resetting your password first.',
          'Check that you are using the correct email or Google login.',
          'Ask support to check whether the account exists and whether sign-in is blocked.',
        ],
      },
    ],
    related: ['cant-log-in-to-not-spotify', 'reset-or-change-password', 'keep-your-account-secure', 'contact-us'],
  },
  'log-out-of-not-spotify': {
    blocks: [
      {
        paragraphs: [
          'Logging out revokes the refresh token for this device. If it is your last active session, the app can also mark you offline for friends.',
        ],
        steps: [
          'Open the user menu or Account.',
          'Choose Log out or Sign out everywhere.',
          'You are returned to the login page.',
          'On a shared device, close the browser tab after signing out.',
        ],
      },
    ],
    related: ['keep-your-account-secure', 'remove-saved-login-details', 'suspicious-account-activity', 'cant-log-in-to-not-spotify'],
  },
  'change-email-address': {
    blocks: [
      {
        paragraphs: [
          'Your email is also your password-login username. Updating it changes both the contact email and the login email for this account.',
        ],
        steps: [
          'Open your profile edit screen.',
          'Enter a valid email address that is not already used by another account.',
          'Save the profile.',
          'Use the new email the next time you log in with password.',
        ],
      },
    ],
    related: ['edit-your-profile', 'changing-how-you-log-in', 'reset-or-change-password', 'language-and-country'],
  },
  'close-or-recover-account': {
    blocks: [
      {
        paragraphs: [
          'Self-service account deletion and playlist recovery are not built yet. The Account page shows those actions as disabled, so no article should promise a button that does not exist.',
        ],
        bullets: [
          'To stop using the account, cancel Premium first if you pay for it.',
          'Sign out everywhere on shared devices.',
          'Ask an admin if you need a data cleanup during the project demo.',
        ],
      },
    ],
    related: ['download-your-data', 'how-to-cancel-premium-plans', 'log-out-of-not-spotify', 'keep-your-account-secure'],
  },
  'notification-settings': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify has a notifications center for events such as friend requests, accepted friends, approvals, releases, and Jam invites. Granular notification preferences are not built yet.',
        ],
        bullets: [
          'Use the notification bell to read new notifications.',
          'Mark individual notifications read, mark all read, or clear them.',
          'There is no email, push, or per-category toggle in the app yet.',
        ],
      },
    ],
    related: ['privacy-settings', 'private-listening', 'keep-your-account-secure', 'report-content-or-users'],
  },
  'privacy-settings': {
    blocks: [
      {
        paragraphs: [
          'Privacy controls are currently centered on playlist visibility, profile visibility through social surfaces, and signing out of shared devices. There is no single privacy dashboard yet.',
        ],
        bullets: [
          'Set playlists to Public, Friends-only, or Private.',
          'Friend Activity can show friends what you are playing while you are active.',
          'Download your data from Account to inspect what the app stores for your user.',
        ],
      },
    ],
    related: ['private-listening', 'download-your-data', 'create-and-edit-playlists', 'keep-your-account-secure'],
  },
  'language-and-country': {
    blocks: [
      {
        paragraphs: [
          'Language is saved on this device and changes the app interface. Country is saved on your profile as a two-letter code and helps personalize country-based discovery rows.',
        ],
        bullets: [
          'Language options are English, Spanish, and French.',
          'Country must be an ISO-style two-letter code such as US, SG, or MY.',
          'Country does not block playback or act as a travel restriction.',
        ],
      },
    ],
    related: ['change-app-language', 'edit-your-profile', 'cant-play-abroad', 'music-recommendations'],
  },
  'suspicious-account-activity': {
    blocks: [
      {
        paragraphs: [
          'If you notice unfamiliar playback, profile changes, or billing changes, secure the account before troubleshooting anything else.',
        ],
        steps: [
          'Change your password from Account, or reset it from the login page.',
          'Sign out everywhere.',
          'Check your email, country, plan, and recent notifications.',
          'Contact support with timestamps and what changed, but never send your password.',
        ],
      },
    ],
    related: ['keep-your-account-secure', 'reset-or-change-password', 'log-out-of-not-spotify', 'remove-saved-login-details'],
  },
  'remove-saved-login-details': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify stores refresh sessions in secure httpOnly cookies and tokens in app state. It does not manage your browser password manager, so saved passwords must be removed in the browser or operating system.',
        ],
        bullets: [
          'Sign out of Not Spotify first.',
          'Remove saved passwords from your browser password settings if needed.',
          'On shared devices, use Sign out everywhere after changing your password.',
        ],
      },
    ],
    related: ['log-out-of-not-spotify', 'keep-your-account-secure', 'reset-or-change-password', 'suspicious-account-activity'],
  },
  'app-keeps-crashing': {
    blocks: [
      {
        paragraphs: [
          'Most crashes in the web app come from stale built assets, browser storage, or a backend/API mismatch during development. The app shell is a PWA, so cached files can survive refreshes.',
        ],
        bullets: [
          'Refresh the page and try again.',
          'Clear site data if the PWA keeps loading an old build.',
          'Check the browser console for red errors and the API base URL.',
          'If this is the desktop shell, rebuild the frontend before packaging Tauri again.',
        ],
      },
    ],
    related: ['web-player-help', 'app-not-playing-music', 'sound-or-volume-issues', 'contact-us'],
  },
  'sound-or-volume-issues': {
    blocks: [
      {
        paragraphs: [
          'Sound is produced by the browser audio element and the Web Audio processing chain for equalizer, quality, and normalization. If the track is playing but silent or distorted, check both device output and app audio settings.',
        ],
        steps: [
          'Make sure the player volume and device volume are not muted.',
          'Try another track to rule out a bad source file.',
          'Turn Equalizer back to Off or Flat.',
          'Toggle Volume normalization off and on.',
          'If Data Saver is on, turn it off and try Normal or High quality.',
        ],
      },
    ],
    related: ['volume-normalization', 'equalizer', 'data-saver', 'app-not-playing-music'],
  },
  'downloads-not-working': {
    blocks: [
      {
        paragraphs: [
          'Downloads are Premium-gated and depend on the backend being able to fetch the audio object from storage. The app uses the same storage keys as playback, then packages album and playlist downloads as ZIP files.',
        ],
        bullets: [
          'Free users receive a 403 for track downloads.',
          'A storage fetch failure means the object key, bucket, CORS, or presigned URL path needs checking.',
          'For PWA offline audio, make sure the browser has enough storage and the track has loaded successfully once.',
        ],
      },
    ],
    related: ['download-and-offline-listening', 'app-not-playing-music', 'not-spotify-premium', 'remove-downloads'],
  },
  'remove-downloads': {
    blocks: [
      {
        paragraphs: [
          'Offline audio saved by the PWA is stored in browser storage on that device. Removing it clears local copies but does not remove the track from your library or playlists.',
        ],
        bullets: [
          'Use the offline/download control for the track when available.',
          'Clear site data to remove all local offline copies for this browser.',
          'Downloaded ZIP files for albums or playlists are normal files; delete them from your downloads folder.',
        ],
      },
    ],
    related: ['download-and-offline-listening', 'downloads-not-working', 'liked-songs', 'web-player-help'],
  },
  'blocked-users': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify does not have a blocked-users list yet. To reduce interaction with someone, remove them as a friend, stop following them, or make playlists private.',
        ],
        bullets: [
          'Unfriending removes the accepted friend relationship.',
          'Unfollowing stops their reposts and profile activity from being part of your follow graph.',
          'Private playlists are visible only to you.',
        ],
      },
    ],
    related: ['privacy-settings', 'private-listening', 'report-content-or-users', 'create-and-edit-playlists'],
  },
  'report-content-or-users': {
    blocks: [
      {
        paragraphs: [
          'A full in-app report workflow is not built yet. For the project version, gather the exact content link and enough context for an admin to review it.',
        ],
        bullets: [
          'Include the track, playlist, artist, user profile, or message link.',
          'Say what is wrong and when you saw it.',
          'Do not include passwords, private tokens, or full payment details.',
        ],
      },
    ],
    related: ['copyright-claims', 'blocked-users', 'contact-us', 'privacy-settings'],
  },
  'copyright-claims': {
    blocks: [
      {
        paragraphs: [
          'Not Spotify is an artist-upload project, not a licensed commercial catalogue. If an uploaded track or video appears to use content without permission, an admin needs the content link and claimant details to review it.',
        ],
        bullets: [
          'Send the track, album, playlist, or video URL.',
          'Include the claimant name and a short ownership explanation.',
          'Admins can reject, remove, or revoke artist content through the review tools.',
        ],
      },
    ],
    related: ['report-content-or-users', 'contact-us', 'privacy-settings', 'keep-your-account-secure'],
  },
  'contact-us': {
    blocks: [
      {
        paragraphs: [
          'A real support ticket form is on the system roadmap, but it is not shipped yet. Until then, use this article as the checklist for what to include when you contact the project team or admin.',
        ],
        bullets: [
          'Your account email.',
          'The page or content link where the issue happened.',
          'The exact error message and approximate time.',
          'What you expected to happen and what actually happened.',
        ],
      },
    ],
    related: ['failed-payment-help', 'app-not-playing-music', 'report-content-or-users', 'download-your-data'],
  },
  'download-your-data': {
    blocks: [
      {
        paragraphs: [
          'You can download a JSON export of the data Not Spotify stores for your signed-in account. The export is generated by GET /me/export and only returns data scoped to the authenticated user.',
        ],
      },
      {
        heading: 'Download your export',
        steps: [
          'Open Account.',
          'Go to Security and privacy.',
          'Select "Download your data".',
          'Save the JSON file when your browser downloads it.',
        ],
      },
      {
        heading: 'What is included',
        bullets: [
          'Profile and plan fields: name, email, country, plan, plan tier, account dates, and Stripe status fields that are already visible to the app.',
          'Library data: owned playlists and tracks, saved playlists, saved tracks, saved albums, ratings, and recent searches.',
          'Listening and social data: play history, notifications, accepted or pending friendships, follows, and shared-plan invites or seats involving your account.',
        ],
      },
      {
        heading: 'What is not included',
        bullets: [
          'Passwords, refresh tokens, full card numbers, CVC codes, and bank details are never included.',
          'Advertising profiles, voice recordings, and third-party data categories are not listed because Not Spotify does not store them.',
        ],
      },
    ],
    related: ['privacy-settings', 'private-listening', 'edit-your-profile', 'close-or-recover-account'],
  },
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function titleFromSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => {
      if (word === 'duo') return 'Duo'
      if (word === 'vat') return 'VAT'
      return word[0].toUpperCase() + word.slice(1)
    })
    .join(' ')
}

function supportTopicHref(value: string) {
  const slug = ARTICLE_INDEX.has(value) ? value : slugify(value)
  return `/support?topic=${encodeURIComponent(slug)}`
}

function supportSearchHref(value: string) {
  return `/support?search=${encodeURIComponent(value.trim())}`
}

function supportMinimumBlock(items: string[]): ArticleBlock {
  return {
    heading: 'Minimum details to include',
    bullets: items,
  }
}

function buildDefaultArticleBlocks(articleRef: ArticleRef, group: HelpGroup, section: HelpSection): ArticleBlock[] {
  const title = articleRef.title

  if (group.id === 'payments') {
    if (section.id === 'charge-help') {
      return [
        {
          paragraphs: [
            `${title} is checked against the local subscription state and the Stripe record for the account. Not Spotify stores the plan, Stripe status, billing interval, current period end, and whether cancellation is scheduled.`,
            'The app cannot invent or adjust Stripe receipts locally. If the Stripe portal and Not Spotify disagree, the Stripe subscription ID or webhook sync is the first thing to verify.',
          ],
          bullets: [
            'Open Account and confirm the plan shown in Not Spotify.',
            'Open the Stripe billing portal if available and compare the receipt or subscription status.',
            'If the billing portal does not open, Stripe is not configured or the account has no Stripe customer yet.',
          ],
        },
        supportMinimumBlock([
          'Account email and plan shown in Account.',
          'Receipt amount, currency, and date.',
          'Whether the issue happened after checkout, cancellation, or renewal.',
          'Exact Stripe or app error message, if one appeared.',
        ]),
      ]
    }

    if (section.id === 'payment-methods') {
      return [
        {
          paragraphs: [
            `${title} depends on what Stripe accepts for your country and currency. Not Spotify starts checkout with one of the configured plan price IDs, then Stripe handles the card, wallet, or local payment method.`,
          ],
          bullets: [
            'Use a payment method issued for the same country as your account where possible.',
            'Enable recurring online payments with your bank.',
            'If checkout says a price ID is missing, an admin must configure that plan before payment can work.',
          ],
        },
        supportMinimumBlock([
          'Selected plan key: monthly, yearly, duo, family, or student.',
          'Country on your account.',
          'Payment method type, without sharing full card numbers.',
          'Screenshot or text of the checkout error.',
        ]),
      ]
    }

    if (section.id === 'manage-payments') {
      return [
        {
          paragraphs: [
            `${title} is handled from Account through the billing API. The backend can create a Stripe checkout session, open a Stripe customer portal, read current subscription status, and cancel the subscription.`,
          ],
          bullets: [
            'Checkout requires Stripe secret key and the selected plan price ID.',
            'The billing portal requires a Stripe customer ID on the account.',
            'Canceling downgrades the user to free locally and releases any Duo or Family seats owned by that user.',
          ],
        },
        supportMinimumBlock([
          'What action you tried: checkout, portal, update payment, or cancel.',
          'Account email.',
          'Plan and interval shown in Account.',
          'Time of the request and exact error text.',
        ]),
      ]
    }

    return [
      {
        paragraphs: [
          `${title} belongs to Premium billing. Plans are exposed by the backend catalogue and can be unavailable when Stripe configuration is incomplete.`,
        ],
        bullets: [
          'The accepted plan keys are monthly, yearly, duo, family, and student.',
          'The plan card can show a missing-configuration message when the Stripe secret key or price ID is absent.',
          'Current subscription status is read from the account record, not guessed from the UI.',
        ],
      },
      supportMinimumBlock(['Account email.', 'Plan key.', 'Screenshot or text of the billing message.', 'Whether this is checkout, renewal, cancellation, or portal access.']),
    ]
  }

  if (group.id === 'account') {
    if (section.id === 'logging-in') {
      return [
        {
          paragraphs: [
            `${title} uses the auth API. Login accepts email and password, while signup accepts email, password, name, and an optional two-letter country code.`,
          ],
          bullets: [
            'Passwords must be at least 8 characters on signup.',
            'Refresh sessions use an httpOnly cookie named rt scoped to /auth.',
            'Logout revokes the refresh token and can mark you offline when it is your last active session.',
            'Social login buttons are placeholders until OAuth provider credentials are configured.',
          ],
        },
        supportMinimumBlock(['Account email.', 'Whether login, signup, refresh, or logout failed.', 'Browser and device.', 'Exact error message. Do not include your password.']),
      ]
    }

    if (section.id === 'profile-help') {
      return [
        {
          paragraphs: [
            `${title} is managed by the profile API. It can update name, email, country, and avatar. It does not accept arbitrary profile fields unless the backend DTO is expanded.`,
          ],
          bullets: [
            'Name must not be blank after trimming.',
            'Email must be valid and unique.',
            'Country must be exactly two letters.',
            'Avatar uploads accept jpg, jpeg, png, or webp up to 5 MB.',
          ],
        },
        supportMinimumBlock(['Account email.', 'Field you tried to update.', 'Image type and size if avatar upload failed.', 'Any API error shown by the app.']),
      ]
    }

    if (section.id === 'security') {
      return [
        {
          paragraphs: [
            `${title} focuses on access tokens, refresh tokens, and account changes. The backend stores refresh token hashes and rotates them on refresh.`,
          ],
          bullets: [
            'Use logout on shared devices so the refresh token is revoked.',
            'Change your email only from Account, because the email is also the login username.',
            'If you suspect session theft, ask support to invalidate active refresh tokens for the account.',
          ],
        },
        supportMinimumBlock(['Account email.', 'Last successful login time.', 'Devices or browsers you used recently.', 'What account data changed unexpectedly.']),
      ]
    }

    return [
      {
        paragraphs: [
          `${title} is stored on your Not Spotify account record in the database. The UI only exposes settings that the backend accepts safely.`,
        ],
        bullets: [
          'Account settings are protected and require a valid access token.',
          'Country affects market-aware recommendations and popular tracks.',
          'Email changes must pass uniqueness validation before they are saved.',
        ],
      },
      supportMinimumBlock(['Account email.', 'Setting you expected to change.', 'Current value shown in Account.', 'Exact save error.']),
    ]
  }

  if (group.id === 'premium') {
    if (section.id === 'premium-family' || section.id === 'premium-duo') {
      return [
        {
          paragraphs: [
            `${title} uses shared plan seats. The owner keeps the Stripe subscription; accepted members are upgraded locally by linking their account to the owner.`,
          ],
          bullets: [
            'Only active Duo or Family owners can invite members.',
            'Invites are sent by email address and can be accepted only by that email account.',
            'A user who already owns Premium cannot join another shared plan.',
            'Removing a member downgrades that member to free and sends an in-app notification.',
          ],
        },
        supportMinimumBlock(['Owner account email.', 'Invited member email.', 'Plan tier shown in Account.', 'Whether the seat is invited or active.']),
      ]
    }

    if (section.id === 'plans-settings') {
      return [
        {
          paragraphs: [
            `${title} is based on the billing subscription endpoint and the plan membership endpoint. Premium features check the local user plan, so stale subscription sync can make features look wrong even when Stripe is correct.`,
          ],
          bullets: [
            'Canceling Premium downgrades the owner to free immediately in the app.',
            'Canceling also releases all owned shared seats.',
            'Premium downloads require the local user plan to be premium unless the caller is an admin or the artist managing the track.',
          ],
        },
        supportMinimumBlock(['Account email.', 'Plan key and tier shown in Account.', 'Whether Stripe portal agrees with Not Spotify.', 'Feature that failed after plan change.']),
      ]
    }

    return [
      {
        paragraphs: [
          `${title} is one of the Premium catalogue topics. The billing catalogue defines each plan label, tier, interval, max seats, price ID, and display price.`,
        ],
        bullets: [
          'Individual plans have one seat.',
          'Duo and Family plans can share seats through invites.',
          'Student is its own plan key and should be selected directly at checkout.',
          'A plan can appear disabled if Stripe is not configured for that key.',
        ],
      },
      supportMinimumBlock(['Plan you selected.', 'Account country.', 'Whether checkout opened.', 'Any missing-configuration text.']),
    ]
  }

  if (group.id === 'features') {
    if (section.id === 'playlists') {
      return [
        {
          paragraphs: [
            `${title} is handled by playlist endpoints. A playlist has name, optional description, cover, visibility, tracks, follower count, and optional smart rules.`,
          ],
          bullets: [
            'Only the owner can edit, delete, upload cover art, or add/remove tracks.',
            'Visibility can be public, friends, or private.',
            'Public playlists can be saved by other users; private/friends playlists are access-controlled.',
            'Smart playlists are generated by rules and reject manual track changes.',
          ],
        },
        supportMinimumBlock(['Playlist name or ID.', 'Owner account email.', 'Visibility setting.', 'Track ID or title if add/remove failed.']),
      ]
    }

    if (section.id === 'search-discovery') {
      return [
        {
          paragraphs: [
            `${title} uses database search and recommendation endpoints. Search is literal and case-insensitive; discovery rows use play history, genres, ratings, country, and catalogue dates.`,
          ],
          bullets: [
            'Search returns tracks, artists, albums, public playlists, and lyric matches.',
            'For You uses genres from tracks played in the last 30 days and falls back to trending.',
            'Charts use plays from the last 7 days, with all-time plays as padding.',
            'Popular by country uses listener country over the last 30 days and market metadata as fallback.',
          ],
        },
        supportMinimumBlock(['Search query.', 'Expected artist/track/playlist.', 'Whether the item is approved/public.', 'Country if the issue is market-specific.']),
      ]
    }

    return [
      {
        paragraphs: [
          `${title} is part of the playback surface. The player records play history, updates play counts, supports queue controls, ratings, comments, lyrics, and recommendations where data exists.`,
        ],
        bullets: [
          'A play event increments track play count and stores play history for the current user.',
          'Lyrics can come from stored track lyrics or external lyric lookup when available.',
          'Ratings are 1 to 5 and feed most-liked style rankings.',
        ],
      },
      supportMinimumBlock(['Track title or ID.', 'Action that failed.', 'Whether you were logged in.', 'Browser console or API error if visible.']),
    ]
  }

  if (group.id === 'devices') {
    if (section.id === 'downloads') {
      return [
        {
          paragraphs: [
            `${title} uses server-side media fetching. The backend reads audio from the configured storage service, then returns the file or builds a ZIP for album downloads.`,
          ],
          bullets: [
            'Free accounts receive a Premium-required response for normal track downloads.',
            'Artists can download tracks they manage; admins can download managed content.',
            'A 502-style audio fetch error means the database row exists but the audio object or URL could not be read.',
          ],
        },
        supportMinimumBlock(['Track or album title.', 'Account plan.', 'Whether streaming works but download fails.', 'Storage error text if shown.']),
      ]
    }

    if (section.id === 'devices') {
      return [
        {
          paragraphs: [
            `${title} usually means playback state, browser permissions, or storage URL reachability. The app does not need a native device registry to play audio in the browser.`,
          ],
          bullets: [
            'Check output device, browser autoplay rules, and muted tabs.',
            'If cover gradients are grey, storage image CORS may be missing.',
            'If S3 presigned URLs are enabled, expired links require a fresh API response.',
          ],
        },
        supportMinimumBlock(['Browser and OS.', 'Track or upload title.', 'Whether audio, images, or both fail.', 'Storage backend: local, S3, or Supabase if known.']),
      ]
    }

    return [
      {
        paragraphs: [
          `${title} is usually caused by unreachable media, unsupported uploaded files, expired storage URLs, or browser playback restrictions.`,
        ],
        bullets: [
          'Personal uploads accept mp3, m4a, aac, wav, ogg, oga, opus, flac, and webm up to 50 MB.',
          'Catalogue audio can be stored by key in S3-compatible storage or as an external URL.',
          'The storage proxy can stream images by key when a bucket is not public.',
        ],
      },
      supportMinimumBlock(['File type and size.', 'Track/upload title.', 'Whether the issue happens after refresh.', 'Network or API error text.']),
    ]
  }

  if (group.id === 'privacy') {
    if (section.id === 'reporting') {
      return [
        {
          paragraphs: [
            `${title} is handled as a support/admin workflow. The app has users, artists, playlists, tracks, comments, reposts, and chat surfaces, so reports need enough context to locate the exact record.`,
          ],
          bullets: [
            'Send the profile, artist, playlist, track, comment, or message URL.',
            'Include a short reason and approximate time.',
            'Do not include private passwords, tokens, or full payment details.',
          ],
        },
        supportMinimumBlock(['Content URL or ID.', 'Reporter account email.', 'Reason for report.', 'Screenshot only if it does not expose sensitive data.']),
      ]
    }

    if (section.id === 'privacy-settings') {
      return [
        {
          paragraphs: [
            `${title} is controlled by account settings and visibility rules. Playlists can be public, friends-only, or private; profile and listening features use your authenticated user ID.`,
          ],
          bullets: [
            'Private playlists are owner-only.',
            'Friends-only playlists require an accepted friendship with the owner.',
            'Recent plays and stats are tied to play history stored for your account.',
          ],
        },
        supportMinimumBlock(['Account email.', 'Playlist/profile URL.', 'Visibility expected versus visible result.', 'Friendship status if friends-only content is involved.']),
      ]
    }

    return [
      {
        paragraphs: [
          `${title} covers account access and stored user data. Not Spotify stores profile information, saved library entries, play history, friendships, plan membership, notifications, and chat messages as needed for product features.`,
        ],
        bullets: [
          'Use Account to update basic profile details.',
          'Use logout on shared devices to revoke the current refresh token.',
          'Ask support for data or moderation help with enough IDs to locate records safely.',
        ],
      },
      supportMinimumBlock(['Account email.', 'Feature or data type involved.', 'URL or record identifier if visible.', 'What outcome you expected.']),
    ]
  }

  return [
    {
      paragraphs: [
        `${title} is handled by the ${group.title.toLowerCase()} area. Not Spotify stores relational app data in the API database and media objects through the configured storage service, so support needs the exact account and record involved.`,
      ],
    },
    supportMinimumBlock(['Account email.', 'Page URL.', 'Action attempted.', 'Exact error message.']),
  ]
}

function getArticle(slug: string): ArticleDetail {
  const indexed = ARTICLE_INDEX.get(slug)
  const fallbackGroup = SUPPORT_GROUPS[0]
  const fallbackSection = fallbackGroup.sections[0]
  const articleRef = indexed?.article ?? article(slug, titleFromSlug(slug))
  const group = indexed?.group ?? fallbackGroup
  const section = indexed?.section ?? fallbackSection
  const custom = ARTICLE_DETAILS[slug]

  return {
    slug,
    title: custom?.title ?? articleRef.title,
    groupId: group.id,
    sectionId: section.id,
    groupTitle: group.title,
    blocks: custom?.blocks ?? buildDefaultArticleBlocks(articleRef, group, section),
    related: custom?.related ?? section.articles.filter((item) => item.slug !== slug).slice(0, 4).map((item) => item.slug),
  }
}

function articleBlocksSearchText(blocks: ArticleBlock[]) {
  return blocks
    .flatMap((block) => [
      block.heading,
      ...(block.paragraphs ?? []),
      ...(block.bullets ?? []),
      ...(block.ordered ?? []),
      ...(block.steps ?? []),
      block.cta?.label,
    ])
    .filter(Boolean)
    .join(' ')
}

function getArticleSearchResults(query: string, limit = 20): ArticleDetail[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  const terms = normalized.split(/\s+/).filter(Boolean)

  return Array.from(ARTICLE_INDEX.values())
    .map((entry, index) => {
      const { article, group, section } = entry
      const articleDetail = getArticle(article.slug)
      const title = articleDetail.title.toLowerCase()
      const groupText = group.title.toLowerCase()
      const sectionText = section.title.toLowerCase()
      const slugText = article.slug.replace(/-/g, ' ').toLowerCase()
      const bodyText = articleBlocksSearchText(articleDetail.blocks).toLowerCase()
      const searchable = `${title} ${groupText} ${sectionText} ${slugText} ${bodyText}`

      let score = 0
      if (title === normalized) score += 120
      if (title.startsWith(normalized)) score += 90
      if (title.includes(normalized)) score += 70
      if (slugText.includes(normalized)) score += 45
      if (sectionText.includes(normalized)) score += 28
      if (groupText.includes(normalized)) score += 18
      if (bodyText.includes(normalized)) score += 16

      for (const term of terms) {
        if (title.includes(term)) score += 20
        else if (slugText.includes(term)) score += 14
        else if (sectionText.includes(term) || groupText.includes(term)) score += 8
        else if (bodyText.includes(term)) score += 5
      }

      if (terms.length > 1 && terms.every((term) => searchable.includes(term))) score += 18

      return { article: articleDetail, score, index }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.article)
}

function getArticleSearchSuggestions(query: string, limit = 4): ArticleDetail[] {
  return getArticleSearchResults(query, limit)
}

function getArticleExcerpt(article: ArticleDetail, query: string) {
  const text = articleBlocksSearchText(article.blocks).replace(/\s+/g, ' ').trim()
  if (!text) return `${article.title} is part of ${article.groupTitle}.`

  const normalized = query.trim().toLowerCase()
  const terms = normalized.split(/\s+/).filter(Boolean)
  const haystack = text.toLowerCase()
  const firstMatch = terms.map((term) => haystack.indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0
  const start = Math.max(0, firstMatch - 48)
  const end = Math.min(text.length, start + 190)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < text.length ? '...' : ''

  return `${prefix}${text.slice(start, end).trim()}${suffix}`
}

function highlightQueryText(text: string, query: string) {
  const terms = Array.from(new Set(query.trim().split(/\s+/).filter((term) => term.length > 1)))
  if (terms.length === 0) return text

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'ig')
  return text.split(pattern).map((part, index) => {
    if (terms.some((term) => part.toLowerCase() === term.toLowerCase())) {
      return (
        <mark key={`${part}-${index}`} className="bg-transparent font-black text-white/85">
          {part}
        </mark>
      )
    }

    return part
  })
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function SupportPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const topicSlug = searchParams.get('topic')
  const searchTerm = searchParams.get('search') ?? ''
  const selectedArticle = topicSlug ? getArticle(topicSlug) : null
  useDocumentTitle(selectedArticle?.title ?? (searchTerm.trim() ? `Search results for ${searchTerm.trim()}` : 'Support'))

  const { user, isAuthenticated, logout } = useAuthStore()
  const [query, setQuery] = useState('')
  const [activeMode, setActiveMode] = useState<'ai' | 'basic'>('ai')

  useEffect(() => {
    setQuery(searchTerm)
  }, [searchTerm])

  const submitSearch = () => {
    const normalized = query.trim()
    navigate(normalized ? supportSearchHref(normalized) : '/support')
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white antialiased">
      <SupportHeader user={user} isAuthenticated={isAuthenticated} logout={logout} />
      <main>
        {selectedArticle ? (
          <ArticlePage
            article={selectedArticle}
            query={query}
            setQuery={setQuery}
            activeMode={activeMode}
            setActiveMode={setActiveMode}
            onSearch={submitSearch}
          />
        ) : searchTerm.trim() ? (
          <SearchResultsPage
            searchTerm={searchTerm}
            query={query}
            setQuery={setQuery}
            onSearch={submitSearch}
            onClear={() => navigate('/support')}
          />
        ) : (
          <SupportHome
            query={query}
            setQuery={setQuery}
            activeMode={activeMode}
            setActiveMode={setActiveMode}
            onSearch={submitSearch}
          />
        )}
      </main>
    </div>
  )
}

function SupportHeader({
  user,
  isAuthenticated,
  logout,
}: {
  user: { avatarUrl?: string | null; name?: string | null } | null | undefined
  isAuthenticated: boolean
  logout: () => void
}) {
  return (
    <header className="sticky top-0 z-50 flex h-12 items-center justify-between bg-black px-4 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex min-w-0 items-center gap-6">
        <Link to="/" className="flex items-center gap-2 text-white" aria-label="Not Spotify home">
          <SpotifyMark className="h-6 w-6 text-white" />
          <span className="hidden text-xl font-black tracking-[-0.02em] sm:inline">Not Spotify</span>
        </Link>
        <nav className="hidden items-center gap-7 text-xs font-black text-white md:flex">
          <Link to="/premium" className="transition-colors hover:text-primary">
            Explore Premium
          </Link>
          <InstallAppButton className="transition-colors hover:text-primary" />
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-4 text-xs font-black text-white">
        <button
          type="button"
          className="hidden items-center gap-2 text-white/90 transition-colors hover:text-white sm:flex"
          aria-label="Language"
        >
          <Globe2 className="h-4 w-4" />
        </button>
        {isAuthenticated ? (
          <>
            <button type="button" onClick={logout} className="hidden transition-colors hover:text-primary sm:inline">
              Log out
            </button>
            <Link
              to="/account"
              className="flex h-8 items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-3 text-xs font-black text-black transition-transform hover:scale-105 active:scale-95"
            >
              <Avatar src={user?.avatarUrl} alt={user?.name ?? 'Account'} size="sm" round className="!h-6 !w-6 bg-[#535353] text-[10px] text-white" />
              Account
            </Link>
          </>
        ) : (
          <>
            <Link to="/login" className="hidden transition-colors hover:text-primary sm:inline">
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-full bg-white px-4 py-2 text-xs font-black text-black transition-transform hover:scale-105 active:scale-95"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  )
}

function SupportHome({
  query,
  setQuery,
  activeMode,
  setActiveMode,
  onSearch,
}: {
  query: string
  setQuery: (value: string) => void
  activeMode: 'ai' | 'basic'
  setActiveMode: (value: 'ai' | 'basic') => void
  onSearch: () => void
}) {
  const quickHelp = useMemo(() => QUICK_HELP_SLUGS.map((slug) => getArticle(slug)), [])

  return (
    <>
      <section className="relative z-20 overflow-visible px-4 pb-10 pt-10 sm:pt-11">
        <div className="pointer-events-none absolute left-1/2 top-28 h-36 w-[470px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_50%,rgba(30,215,96,0.18),transparent_38%),radial-gradient(circle_at_72%_55%,rgba(68,122,255,0.2),transparent_42%)] blur-3xl" />

        <div className="relative mx-auto max-w-[520px] text-center">
          <h1 className="text-[32px] font-black leading-none tracking-[-0.02em] text-white sm:text-[40px]">
            Not Spotify Support
          </h1>

          <div className="mx-auto mt-8 max-w-[390px] rounded-[2px] border border-white/35 bg-[#121212] p-2.5 shadow-[0_16px_56px_rgba(0,0,0,0.42)]">
            <SearchModeTabs activeMode={activeMode} setActiveMode={setActiveMode} />

            <SupportSearchField query={query} setQuery={setQuery} onSearch={onSearch} placeholder="Search" />
          </div>
        </div>
      </section>

      <section className="relative z-0 mx-auto max-w-[390px] px-4 pb-10">
        <BrowseHelpArticles groups={SUPPORT_GROUPS} />
      </section>

      <section className="relative z-0 bg-[#2a2a2a] px-4 py-7 sm:py-8">
        <div className="mx-auto max-w-[390px]">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-black tracking-[-0.02em] text-white">Quick help</h2>
            <SlidersHorizontal className="hidden h-4 w-4 text-white/40 sm:block" />
          </div>

          <div className="space-y-1">
            {quickHelp.length > 0 ? (
              quickHelp.map((item) => (
                <Link
                  key={item.slug}
                  to={supportTopicHref(item.slug)}
                  className="flex items-center justify-between py-3 text-xs font-black text-white transition-colors hover:text-[#1ed760]"
                >
                  <span>{item.title}</span>
                  <ChevronRight className="h-5 w-5 text-white/55" />
                </Link>
              ))
            ) : (
              <p className="py-3.5 text-sm font-bold text-white/60">No quick help matches that search.</p>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

function BrowseHelpArticles({ groups }: { groups: HelpGroup[] }) {
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [openSection, setOpenSection] = useState<string | null>(null)

  return (
    <div>
      <h2 className="text-lg font-black tracking-[-0.02em] text-white">Browse help articles</h2>

      <div className="mt-4">
        {groups.length > 0 ? (
          groups.map(({ id, title, Icon, sections }) => {
            const isOpen = openGroup === id

            return (
              <div key={id} className="border-b border-white/20">
                <button
                  type="button"
                  onClick={() => setOpenGroup(isOpen ? null : id)}
                  className="group flex w-full items-center gap-3 py-3.5 text-left"
                  aria-expanded={isOpen}
                >
                  <Icon className="h-4 w-4 shrink-0 text-[#1ed760]" strokeWidth={2.4} />
                  <span className="min-w-0 flex-1 text-xs font-black text-white">{title}</span>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-white/60 transition-transform group-hover:text-white', isOpen && 'rotate-180')} />
                </button>

                <div className={cn('grid transition-[grid-template-rows,opacity] duration-200 ease-out', isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                  <div className="overflow-hidden">
                    <div className="pb-3 pl-6">
                      {sections.map((section) => {
                        const sectionOpen = openSection === section.id
                        return (
                          <div key={section.id}>
                            <button
                              type="button"
                              onClick={() => setOpenSection(sectionOpen ? null : section.id)}
                              className="flex w-full items-center justify-between py-2 text-left text-xs font-black text-white transition-colors hover:text-[#1ed760]"
                              aria-expanded={sectionOpen}
                            >
                              <span>{section.title}</span>
                              <ChevronDown className={cn('h-3.5 w-3.5 text-white/60 transition-transform', sectionOpen && 'rotate-180')} />
                            </button>
                            <div className={cn('grid transition-[grid-template-rows,opacity] duration-200 ease-out', sectionOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                              <div className="overflow-hidden">
                                <div className="pb-2 pl-4">
                                  {section.articles.map((item) => (
                                    <Link
                                      key={item.slug}
                                      to={supportTopicHref(item.slug)}
                                      className="block rounded-sm py-1.5 text-xs font-bold text-white/90 transition-colors hover:text-[#1ed760]"
                                    >
                                      {item.title}
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-md border border-white/15 bg-white/[0.03] p-5 text-sm font-bold text-white/70">
            No help articles match that search.
          </div>
        )}
      </div>
    </div>
  )
}

function SearchResultsPage({
  searchTerm,
  query,
  setQuery,
  onSearch,
  onClear,
}: {
  searchTerm: string
  query: string
  setQuery: (value: string) => void
  onSearch: () => void
  onClear: () => void
}) {
  const normalized = searchTerm.trim()
  const results = useMemo(() => getArticleSearchResults(normalized, 30), [normalized])

  return (
    <section className="px-4 pb-20 pt-7">
      <div className="mx-auto max-w-[390px]">
        <SupportSearchField query={query} setQuery={setQuery} onSearch={onSearch} onClear={onClear} placeholder="Search support" />

        <nav className="mt-5 flex items-center gap-2 text-xs font-black text-white/65">
          <Link to="/support" className="transition-colors hover:text-white">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-white/45" />
          <span className="text-white/80">Search Results</span>
        </nav>

        <p className="mt-7 text-xs font-black text-white/75">
          {results.length} search {results.length === 1 ? 'result' : 'results'} for "{normalized}"
        </p>

        {results.length > 0 ? (
          <div className="mt-3 divide-y divide-white/10">
            {results.map((article) => {
              const excerpt = getArticleExcerpt(article, normalized)

              return (
                <Link key={article.slug} to={supportTopicHref(article.slug)} className="block py-4 text-left transition-colors hover:text-[#1ed760]">
                  <span className="mb-2 flex items-center gap-1.5 text-[10px] font-black text-[#1ed760]">
                    <FileText className="h-3.5 w-3.5" />
                    Help article
                  </span>
                  <span className="block text-xs font-black text-white">{article.title}</span>
                  <span className="mt-1 block text-[11px] font-semibold leading-4 text-white/60">
                    {highlightQueryText(excerpt, normalized)}
                  </span>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-sm border border-white/15 bg-white/[0.03] p-5">
            <p className="text-sm font-black text-white">No results found</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-white/60">Try a different keyword or browse help articles from the support home page.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function ArticlePage({
  article,
  query,
  setQuery,
  activeMode,
  setActiveMode,
  onSearch,
}: {
  article: ArticleDetail
  query: string
  setQuery: (value: string) => void
  activeMode: 'ai' | 'basic'
  setActiveMode: (value: 'ai' | 'basic') => void
  onSearch: () => void
}) {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-5">
      <div className="pointer-events-none absolute left-1/2 top-8 h-44 w-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_25%_35%,rgba(30,215,96,0.14),transparent_40%),radial-gradient(circle_at_70%_35%,rgba(68,122,255,0.18),transparent_45%)] blur-3xl" />

      <div className="relative mx-auto grid max-w-[1120px] gap-12 lg:grid-cols-[minmax(0,650px)_330px] lg:gap-20">
        <div className="min-w-0">
          <nav className="mb-6 flex items-center gap-2 text-sm font-black text-white/75">
            <Link to="/support" className="transition-colors hover:text-white">
              Home
            </Link>
            <ChevronRight className="h-4 w-4 text-white/50" />
            <span className="text-white">{article.groupTitle}</span>
          </nav>

          <ArticleSearchPanel
            query={query}
            setQuery={setQuery}
            activeMode={activeMode}
            setActiveMode={setActiveMode}
            onSearch={onSearch}
          />
          <p className="mt-3 text-xs font-bold text-white/80">You're engaging with an AI-powered tool.</p>

          <Link
            to="/account"
            className="mt-8 flex items-center gap-4 rounded-md bg-[#2a2a2a] p-4 text-left transition-colors hover:bg-[#333]"
          >
            <span className="flex h-14 w-14 shrink-0 rotate-6 items-center justify-center rounded-md bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
              <UserRound className="h-8 w-8 -rotate-6 text-[#1ed760]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-black text-white">Manage your account</span>
              <span className="block text-sm font-semibold text-white/80">Your profile, payment and more.</span>
            </span>
            <ChevronRight className="h-6 w-6 shrink-0 text-white/70" />
          </Link>

          <ArticleContent article={article} />
          <RelatedArticles article={article} />
          <ArticleFeedback slug={article.slug} />
        </div>

        <ArticleSidebar article={article} />
      </div>
    </section>
  )
}

function ArticleSearchPanel({
  query,
  setQuery,
  activeMode,
  setActiveMode,
  onSearch,
}: {
  query: string
  setQuery: (value: string) => void
  activeMode: 'ai' | 'basic'
  setActiveMode: (value: 'ai' | 'basic') => void
  onSearch: () => void
}) {
  return (
    <div className="rounded-[3px] border border-white/35 bg-[#121212] p-2.5 shadow-[0_16px_56px_rgba(0,0,0,0.36)]">
      <SearchModeTabs activeMode={activeMode} setActiveMode={setActiveMode} />
      <SupportSearchField query={query} setQuery={setQuery} onSearch={onSearch} placeholder="Search support" />
    </div>
  )
}

function SupportSearchField({
  query,
  setQuery,
  onSearch,
  onClear,
  placeholder,
}: {
  query: string
  setQuery: (value: string) => void
  onSearch: () => void
  onClear?: () => void
  placeholder: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const normalized = query.trim()
  const suggestions = useMemo(() => getArticleSearchSuggestions(query, 4), [query])
  const showDropdown = isOpen && normalized.length > 0

  const closeWhenFocusLeaves = (event: FocusEvent<HTMLDivElement>) => {
    const nextFocus = event.relatedTarget
    if (!(nextFocus instanceof Node) || !event.currentTarget.contains(nextFocus)) {
      setIsOpen(false)
    }
  }

  const runSearch = () => {
    setIsOpen(false)
    onSearch()
  }

  return (
    <div className="relative text-left" onBlur={closeWhenFocusLeaves}>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-black/75" />
        <input
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              runSearch()
            }
            if (event.key === 'Escape') setIsOpen(false)
          }}
          placeholder={placeholder}
          className="h-10 w-full border border-black/80 bg-white pl-10 pr-10 text-sm font-semibold text-black placeholder:text-black/55 focus:outline-none focus:ring-2 focus:ring-[#1ed760]"
          aria-label="Search support"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setIsOpen(false)
              onClear?.()
            }}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-black/70 transition-colors hover:bg-black/5 hover:text-black"
            aria-label="Clear support search"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </label>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-[1000] -mt-px border border-black/80 bg-white py-1 text-black shadow-[0_18px_38px_rgba(0,0,0,0.35)]" role="listbox">
          {suggestions.map((item) => (
            <Link
              key={item.slug}
              to={supportTopicHref(item.slug)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setIsOpen(false)}
              className="flex min-h-9 items-center gap-2 px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-black/[0.06] focus:bg-black/[0.06] focus:outline-none"
              role="option"
            >
              <FileText className="h-4 w-4 shrink-0 text-black/65" />
              <span className="min-w-0 truncate">{item.title}</span>
            </Link>
          ))}

          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={runSearch}
            className="flex min-h-9 w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-black transition-colors hover:bg-black/[0.06] focus:bg-black/[0.06] focus:outline-none"
          >
            <Search className="h-4 w-4 shrink-0 text-black/65" />
            <span className="min-w-0 truncate font-black">{normalized}</span>
          </button>
        </div>
      )}
    </div>
  )
}

function SearchModeTabs({
  activeMode,
  setActiveMode,
}: {
  activeMode: 'ai' | 'basic'
  setActiveMode: (value: 'ai' | 'basic') => void
}) {
  return (
    <div className="mx-auto mb-2.5 flex h-6 max-w-[215px] rounded-full bg-[#2a2a2a] p-0.5 text-[10px] font-black">
      <button
        type="button"
        onClick={() => setActiveMode('ai')}
        className={cn(
          'flex flex-1 items-center justify-center gap-1.5 rounded-full border transition-colors',
          activeMode === 'ai'
            ? 'border-[#1ed760] bg-[#151515] text-white shadow-sm'
            : 'border-transparent text-white/70 hover:text-white',
        )}
      >
        <Search className="h-3 w-3" />
        Search with AI
      </button>
      <button
        type="button"
        onClick={() => setActiveMode('basic')}
        className={cn(
          'flex flex-1 items-center justify-center gap-1.5 rounded-full border transition-colors',
          activeMode === 'basic'
            ? 'border-white/55 bg-[#2a2a2a] text-white'
            : 'border-transparent text-white/70 hover:text-white',
        )}
      >
        <Bot className="h-3 w-3" />
        Basic Search
      </button>
    </div>
  )
}

/**
 * Interactive follow-along guide. Each step is a tappable checkbox; progress is
 * persisted in localStorage under a per-article-block key, so a reader who steps
 * away keeps their place. Keyboard-accessible (role=checkbox on a <button>).
 */
function GuideSteps({ storageKey, steps }: { storageKey: string; steps: string[] }) {
  const [done, setDone] = useState<boolean[]>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      const parsed = raw ? (JSON.parse(raw) as unknown) : null
      const arr = Array.isArray(parsed) ? (parsed as boolean[]) : []
      return steps.map((_, i) => arr[i] === true)
    } catch {
      return steps.map(() => false)
    }
  })

  const persist = (next: boolean[]) => {
    setDone(next)
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const toggle = (i: number) => {
    const next = done.slice()
    next[i] = !next[i]
    persist(next)
  }

  const completed = done.filter(Boolean).length
  const allDone = completed === steps.length && steps.length > 0
  const pct = steps.length ? Math.round((completed / steps.length) * 100) : 0

  return (
    <div className="rounded-md border border-white/12 bg-[#1c1c1c] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-black text-white">
          {allDone ? "✅ You're all set" : `${completed} of ${steps.length} steps done`}
        </p>
        {completed > 0 && (
          <button
            type="button"
            onClick={() => persist(steps.map(() => false))}
            className="inline-flex items-center gap-1 text-xs font-bold text-white/55 transition-colors hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>

      <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#1ed760] transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>

      <ul className="space-y-0.5">
        {steps.map((step, i) => (
          <li key={`${storageKey}-${i}`}>
            <button
              type="button"
              role="checkbox"
              aria-checked={done[i]}
              onClick={() => toggle(i)}
              className="flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
            >
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors',
                  done[i] ? 'border-[#1ed760] bg-[#1ed760] text-black' : 'border-white/40 text-transparent',
                )}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              <span className={cn('text-[15px] font-semibold leading-6', done[i] ? 'text-white/50 line-through' : 'text-white')}>
                {step}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ArticleContent({ article }: { article: ArticleDetail }) {
  return (
    <article className="mt-8 rounded-md bg-[#2a2a2a] px-7 py-8 text-white shadow-[0_22px_70px_rgba(0,0,0,0.22)] sm:px-8 sm:py-9">
      <h1 className="text-[40px] font-black leading-tight tracking-[-0.04em] sm:text-5xl">{article.title}</h1>

      <div className="mt-8 space-y-8 text-[15px] font-bold leading-6 text-white">
        {article.blocks.map((block, index) => (
          <section key={`${article.slug}-${index}`}>
            {block.heading && <h2 className="mb-4 text-3xl font-black tracking-[-0.04em]">{block.heading}</h2>}
            {block.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mb-4 max-w-[54ch]">
                {paragraph}
              </p>
            ))}
            {block.bullets && (
              <ul className="mb-4 ml-6 max-w-[54ch] list-disc space-y-1.5">
                {block.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {block.ordered && (
              <ol className="mb-4 ml-6 max-w-[54ch] list-decimal space-y-1.5">
                {block.ordered.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            )}
            {block.steps && <GuideSteps storageKey={`ns-support-guide-${article.slug}-${index}`} steps={block.steps} />}
            {block.cta && (
              <Link
                to={block.cta.href}
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#1ed760] px-5 py-3 text-sm font-black text-black transition-transform hover:scale-[1.02] active:scale-95"
              >
                {block.cta.label}
                <ArrowRight className="h-5 w-5" />
              </Link>
            )}
          </section>
        ))}
      </div>
    </article>
  )
}

/** "Was this article helpful?" — v1 is localStorage-only (no backend yet); a future
 *  version can POST to a feedback table (see docs/support-page-roadmap.md §2). */
function ArticleFeedback({ slug }: { slug: string }) {
  const storageKey = `ns-support-feedback-${slug}`
  const [vote, setVote] = useState<'up' | 'down' | null>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      return raw === 'up' || raw === 'down' ? raw : null
    } catch {
      return null
    }
  })

  const record = (next: 'up' | 'down') => {
    setVote(next)
    try {
      window.localStorage.setItem(storageKey, next)
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="mt-8 flex flex-col gap-4 rounded-md bg-[#2a2a2a] p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-base font-black text-white">
        {vote ? 'Thanks for your feedback.' : 'Was this article helpful?'}
      </p>
      {!vote && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => record('up')}
            className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2 text-sm font-black text-white transition-colors hover:border-white hover:bg-white/[0.06]"
          >
            <ThumbsUp className="h-4 w-4" />
            Yes
          </button>
          <button
            type="button"
            onClick={() => record('down')}
            className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2 text-sm font-black text-white transition-colors hover:border-white hover:bg-white/[0.06]"
          >
            <ThumbsDown className="h-4 w-4" />
            No
          </button>
        </div>
      )}
    </section>
  )
}

function RelatedArticles({ article }: { article: ArticleDetail }) {
  if (article.related.length === 0) return null

  return (
    <section className="mt-8 rounded-md bg-[#2a2a2a] p-6">
      <h2 className="text-base font-black text-white">Related Articles</h2>
      <div className="mt-4 divide-y divide-white/10">
        {article.related.map((slug) => {
          const related = getArticle(slug)
          return (
            <Link
              key={slug}
              to={supportTopicHref(slug)}
              className="flex items-center justify-between py-3 text-sm font-black text-white transition-colors hover:text-[#1ed760]"
            >
              {related.title}
              <ChevronRight className="h-5 w-5 text-white/50" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function ArticleSidebar({ article }: { article: ArticleDetail }) {
  const [openGroup, setOpenGroup] = useState<string | null>(article.groupId)
  const [openSection, setOpenSection] = useState<string | null>(article.sectionId)

  useEffect(() => {
    setOpenGroup(article.groupId)
    setOpenSection(article.sectionId)
  }, [article.groupId, article.sectionId, article.slug])

  return (
    <aside className="lg:sticky lg:top-20 lg:self-start">
      <div className="overflow-hidden rounded-md bg-[#2a2a2a] text-white shadow-[0_22px_70px_rgba(0,0,0,0.18)]">
        {SUPPORT_GROUPS.map((group) => {
          const groupOpen = openGroup === group.id
          return (
            <div key={group.id} className="border-b border-white/20 last:border-b-0">
              <button
                type="button"
                onClick={() => setOpenGroup(groupOpen ? null : group.id)}
                className="flex w-full items-center justify-between px-6 py-5 text-left text-base font-black text-white transition-colors hover:bg-white/[0.04]"
                aria-expanded={groupOpen}
              >
                <span>{group.title}</span>
                <ChevronDown className={cn('h-4 w-4 text-white/70 transition-transform', groupOpen && 'rotate-180')} />
              </button>

              <div className={cn('grid transition-[grid-template-rows,opacity] duration-200 ease-out', groupOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                <div className="overflow-hidden">
                  <div className="px-6 pb-4">
                    {group.sections.map((section) => {
                      const sectionOpen = openSection === section.id
                      return (
                        <div key={section.id}>
                          <button
                            type="button"
                            onClick={() => setOpenSection(sectionOpen ? null : section.id)}
                            className="flex w-full items-center justify-between py-3 text-left text-sm font-black text-white transition-colors hover:text-[#1ed760]"
                            aria-expanded={sectionOpen}
                          >
                            <span>{section.title}</span>
                            <ChevronDown className={cn('h-4 w-4 text-white/60 transition-transform', sectionOpen && 'rotate-180')} />
                          </button>
                          <div className={cn('grid transition-[grid-template-rows,opacity] duration-200 ease-out', sectionOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                            <div className="overflow-hidden">
                              <div className="pb-2 pl-4">
                                {section.articles.map((item) => (
                                  <Link
                                    key={item.slug}
                                    to={supportTopicHref(item.slug)}
                                    className={cn(
                                      'block py-2 text-sm font-bold transition-colors hover:text-[#1ed760]',
                                      item.slug === article.slug ? 'text-[#1ed760]' : 'text-white/90',
                                    )}
                                    aria-current={item.slug === article.slug ? 'page' : undefined}
                                  >
                                    {item.title}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
