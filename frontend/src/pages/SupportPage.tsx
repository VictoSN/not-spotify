import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
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
          article('cant-play-abroad', "Can't play abroad"),
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
    description: 'Playback, downloads, audio, and connected devices.',
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
        ],
      },
      {
        id: 'reporting',
        title: 'Reporting',
        articles: [
          article('report-content-or-users', 'Report content or users'),
          article('blocked-users', 'Blocked users'),
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
        ordered: [
          'Go to Account.',
          'Open the plan members section.',
          'Enter the member email address.',
          'Send the invite. If the user already has an account, they also receive an in-app notification.',
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
        bullets: [
          'Check your internet connection.',
          'Make sure the app is not muted and the device volume is turned up.',
          'Restart the app and try another song.',
          'If only one track fails, its stored audio key or external audio URL may be missing or unreachable.',
          'If every track fails after login, check whether your session expired and sign in again.',
        ],
      },
      {
        heading: 'If playback stops or skips',
        bullets: [
          'Turn off data saver or battery saver temporarily.',
          'Clear the app cache.',
          'For local uploads, confirm the file type is mp3, m4a, aac, wav, ogg, oga, opus, flac, or webm and under 50 MB.',
          'For S3-backed media, check bucket CORS and whether presigned URLs are expiring too quickly.',
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

function findArticleByQuery(query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return null

  return (
    Array.from(ARTICLE_INDEX.values()).find(({ article, group, section }) =>
      [article.title, group.title, section.title].some((value) => value.toLowerCase().includes(normalized)),
    ) ?? null
  )
}

function filterGroups(query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return SUPPORT_GROUPS

  return SUPPORT_GROUPS.map((group) => {
    const groupMatches = group.title.toLowerCase().includes(normalized) || group.description.toLowerCase().includes(normalized)
    if (groupMatches) return group

    const sections = group.sections
      .map((section) => {
        const sectionMatches = section.title.toLowerCase().includes(normalized)
        const articles = sectionMatches
          ? section.articles
          : section.articles.filter((item) => item.title.toLowerCase().includes(normalized))
        return articles.length > 0 ? { ...section, articles } : null
      })
      .filter((section): section is HelpSection => Boolean(section))

    return sections.length > 0 ? { ...group, sections } : null
  }).filter((group): group is HelpGroup => Boolean(group))
}

export function SupportPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const topicSlug = searchParams.get('topic')
  const selectedArticle = topicSlug ? getArticle(topicSlug) : null
  useDocumentTitle(selectedArticle?.title ?? 'Support')

  const { user, isAuthenticated, logout } = useAuthStore()
  const [query, setQuery] = useState('')
  const [activeMode, setActiveMode] = useState<'ai' | 'basic'>('ai')

  const submitSearch = () => {
    const match = findArticleByQuery(query)
    if (match) navigate(supportTopicHref(match.article.slug))
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
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between bg-black px-4 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex min-w-0 items-center gap-7">
        <Link to="/" className="flex items-center gap-2.5 text-white" aria-label="Not Spotify home">
          <SpotifyMark className="h-8 w-8 text-white" />
          <span className="hidden text-2xl font-black tracking-[-0.02em] sm:inline">Not Spotify</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-black text-white md:flex">
          <Link to="/premium" className="transition-colors hover:text-primary">
            Explore Premium
          </Link>
          <InstallAppButton className="transition-colors hover:text-primary" />
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-5 text-sm font-black text-white">
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
              className="flex h-10 items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-sm font-black text-black transition-transform hover:scale-105 active:scale-95"
            >
              <Avatar src={user?.avatarUrl} alt={user?.name ?? 'Account'} size="sm" round className="!h-8 !w-8 bg-[#535353] text-xs text-white" />
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
              className="rounded-full bg-white px-5 py-2.5 text-sm font-black text-black transition-transform hover:scale-105 active:scale-95"
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
  const visibleGroups = useMemo(() => filterGroups(query), [query])
  const visibleQuickHelp = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const quick = QUICK_HELP_SLUGS.map((slug) => getArticle(slug))
    if (!normalized) return quick
    return quick.filter((item) => item.title.toLowerCase().includes(normalized))
  }, [query])

  return (
    <>
      <section className="relative overflow-hidden px-4 pb-14 pt-16 sm:pt-20">
        <div className="pointer-events-none absolute left-1/2 top-36 h-44 w-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_50%,rgba(30,215,96,0.22),transparent_38%),radial-gradient(circle_at_72%_55%,rgba(68,122,255,0.26),transparent_42%)] blur-3xl" />

        <div className="relative mx-auto max-w-[610px] text-center">
          <h1 className="text-[40px] font-black leading-none tracking-[-0.02em] text-white sm:text-6xl">
            Not Spotify Support
          </h1>

          <div className="mx-auto mt-10 rounded-[2px] border border-white/35 bg-[#121212] p-3 shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
            <SearchModeTabs activeMode={activeMode} setActiveMode={setActiveMode} />

            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-black/70" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSearch()
                }}
                placeholder="Search"
                className="h-14 w-full bg-white pl-14 pr-4 text-base font-semibold text-black placeholder:text-black/55 focus:outline-none focus:ring-2 focus:ring-[#1ed760]"
                aria-label="Search support"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[680px] px-4 pb-16">
        <BrowseHelpArticles groups={visibleGroups} />
      </section>

      <section className="bg-[#2a2a2a] px-4 py-10 sm:py-12">
        <div className="mx-auto max-w-[610px]">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-[-0.02em] text-white">Quick help</h2>
            <SlidersHorizontal className="hidden h-5 w-5 text-white/40 sm:block" />
          </div>

          <div className="space-y-1">
            {visibleQuickHelp.length > 0 ? (
              visibleQuickHelp.map((item) => (
                <Link
                  key={item.slug}
                  to={supportTopicHref(item.slug)}
                  className="flex items-center justify-between py-3.5 text-base font-black text-white transition-colors hover:text-[#1ed760]"
                >
                  <span>{item.title}</span>
                  <ChevronRight className="h-6 w-6 text-white/55" />
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
  const [openGroup, setOpenGroup] = useState<string | null>('payments')
  const [openSection, setOpenSection] = useState<string | null>('charge-help')

  return (
    <div>
      <h2 className="text-2xl font-black tracking-[-0.02em] text-white">Browse help articles</h2>

      <div className="mt-5">
        {groups.length > 0 ? (
          groups.map(({ id, title, Icon, sections }) => {
            const isOpen = openGroup === id

            return (
              <div key={id} className="border-b border-white/20">
                <button
                  type="button"
                  onClick={() => setOpenGroup(isOpen ? null : id)}
                  className="group flex w-full items-center gap-4 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <Icon className="h-5 w-5 shrink-0 text-[#1ed760]" strokeWidth={2.4} />
                  <span className="min-w-0 flex-1 text-base font-black text-white">{title}</span>
                  <ChevronDown className={cn('h-5 w-5 shrink-0 text-white/60 transition-transform group-hover:text-white', isOpen && 'rotate-180')} />
                </button>

                <div className={cn('grid transition-[grid-template-rows,opacity] duration-200 ease-out', isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                  <div className="overflow-hidden">
                    <div className="pb-5 pl-7">
                      {sections.map((section) => {
                        const sectionOpen = openSection === section.id
                        return (
                          <div key={section.id}>
                            <button
                              type="button"
                              onClick={() => setOpenSection(sectionOpen ? null : section.id)}
                              className="flex w-full items-center justify-between py-2.5 text-left text-sm font-black text-white transition-colors hover:text-[#1ed760]"
                              aria-expanded={sectionOpen}
                            >
                              <span>{section.title}</span>
                              <ChevronDown className={cn('h-4 w-4 text-white/60 transition-transform', sectionOpen && 'rotate-180')} />
                            </button>
                            <div className={cn('grid transition-[grid-template-rows,opacity] duration-200 ease-out', sectionOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                              <div className="overflow-hidden">
                                <div className="pb-2 pl-5">
                                  {section.articles.map((item) => (
                                    <Link
                                      key={item.slug}
                                      to={supportTopicHref(item.slug)}
                                      className="block rounded-sm py-2 text-sm font-bold text-white/90 transition-colors hover:text-[#1ed760]"
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
    <section className="relative overflow-hidden px-4 pb-20 pt-6">
      <div className="pointer-events-none absolute left-1/2 top-8 h-56 w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_25%_35%,rgba(30,215,96,0.18),transparent_40%),radial-gradient(circle_at_70%_35%,rgba(68,122,255,0.24),transparent_45%)] blur-3xl" />

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
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSearch()
      }}
      className="rounded-[3px] border border-white/35 bg-[#121212] p-3 shadow-[0_18px_70px_rgba(0,0,0,0.38)]"
    >
      <SearchModeTabs activeMode={activeMode} setActiveMode={setActiveMode} />
      <div className="relative">
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask a question or describe your issue"
          rows={2}
          className="min-h-20 w-full resize-none bg-transparent pb-10 pr-14 pt-3 text-base font-semibold text-white placeholder:text-white/82 focus:outline-none"
          aria-label="Ask a support question"
        />
        <button
          type="submit"
          className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-[#1ed760] text-black transition-transform hover:scale-105 active:scale-95"
          aria-label="Search support"
        >
          <ArrowRight className="h-6 w-6" />
        </button>
      </div>
    </form>
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
    <div className="mx-auto mb-3 flex h-8 max-w-[360px] rounded-full bg-[#2a2a2a] p-0.5 text-[12px] font-black">
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
        <Search className="h-3.5 w-3.5" />
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
        <Bot className="h-3.5 w-3.5" />
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
                className="flex w-full items-center justify-between px-6 py-5 text-left text-base font-black transition-colors hover:bg-white/[0.04]"
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
