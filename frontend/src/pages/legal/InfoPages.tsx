import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/**
 * Shared layout for the static footer pages (About, Legal, Privacy). Keeps the
 * same centered, readable column the rest of the app uses for text-heavy views
 * and sets the document title. These are public pages (no auth) so footer links
 * resolve for guests and members alike.
 */
function InfoPageLayout({
  title,
  updated,
  children,
}: {
  title: string
  updated?: string
  children: ReactNode
}) {
  useDocumentTitle(title)
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold text-primary">{title}</h1>
      {updated && <p className="mt-1 text-sm text-secondary">Last updated {updated}</p>}
      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-secondary">{children}</div>
    </div>
  )
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold text-primary">{heading}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export function AboutPage() {
  return (
    <InfoPageLayout title="About">
      <p>
        not-spotify is a full-stack music-streaming demo built to explore what a modern listening
        experience looks like end to end — discovery, playback, playlists, social listening, and a
        creator-facing artist dashboard. It is an educational project, not a commercial service, and
        it is not affiliated with Spotify AB.
      </p>
      <Section heading="What it is">
        <p>
          A React and TypeScript front end backed by an ASP.NET Core API, with Supabase for data and
          Stripe for subscription billing. The catalogue, recommendations, and stats are all wired to
          real services so the app behaves like a production product rather than a static mockup.
        </p>
      </Section>
      <Section heading="What you can do">
        <ul className="list-disc space-y-1 pl-5">
          <li>Stream music, build playlists, and follow artists.</li>
          <li>See what friends are playing and share tracks in chat.</li>
          <li>Upgrade to Premium for higher quality, downloads, and ad-free listening.</li>
          <li>Publish and manage releases from the artist dashboard.</li>
        </ul>
      </Section>
      <Section heading="Get in touch">
        <p>
          Questions or feedback? Visit the{' '}
          <Link to="/support" className="text-primary underline hover:no-underline">
            Support center
          </Link>{' '}
          to browse help articles or contact the team.
        </p>
      </Section>
    </InfoPageLayout>
  )
}

export function LegalPage() {
  return (
    <InfoPageLayout title="Legal" updated="June 2026">
      <p>
        These terms govern your use of not-spotify. By creating an account or using the app, you
        agree to them. Because this is a demonstration project, the service is provided “as is” with
        no warranties and may change or be taken offline at any time.
      </p>
      <Section heading="Your account">
        <p>
          You are responsible for keeping your login credentials secure and for activity on your
          account. Do not share your password — support will never ask for it. We may suspend
          accounts that abuse the service or violate these terms.
        </p>
      </Section>
      <Section heading="Acceptable use">
        <ul className="list-disc space-y-1 pl-5">
          <li>Don't attempt to disrupt, reverse-engineer, or overload the service.</li>
          <li>Don't upload content you don't have the rights to distribute.</li>
          <li>Don't use the app to harass other users or infringe others' rights.</li>
        </ul>
      </Section>
      <Section heading="Subscriptions and billing">
        <p>
          Premium plans are billed through Stripe. You can cancel at any time from your account;
          cancellation stops future renewals and downgrades you to the free tier. Refunds are handled
          case by case via the Support center.
        </p>
      </Section>
      <Section heading="Cookies">
        <p>
          The app uses cookies and local storage strictly to keep you signed in and to remember
          preferences such as theme and playback settings. See the{' '}
          <Link to="/privacy" className="text-primary underline hover:no-underline">
            Privacy Policy
          </Link>{' '}
          for details on the data we store.
        </p>
      </Section>
    </InfoPageLayout>
  )
}

export function PrivacyPolicyPage() {
  return (
    <InfoPageLayout title="Privacy Policy" updated="June 2026">
      <p>
        This policy explains what data not-spotify collects and how it is used. As a demonstration
        project, we collect the minimum needed to run the app and never sell your data.
      </p>
      <Section heading="What we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>Account details you provide: name, email, and country.</li>
          <li>Listening activity — plays, likes, and library — to power history and recommendations.</li>
          <li>Subscription status from Stripe (we never store your full card details).</li>
        </ul>
      </Section>
      <Section heading="How we use it">
        <p>
          Your data is used to operate core features: signing you in, syncing your library across
          devices, generating recommendations, and showing friends what you're listening to when you
          allow it. You can limit social visibility with Private listening in{' '}
          <Link to="/settings" className="text-primary underline hover:no-underline">
            Settings
          </Link>
          .
        </p>
      </Section>
      <Section heading="Your choices">
        <ul className="list-disc space-y-1 pl-5">
          <li>Edit or remove your profile information at any time from your account.</li>
          <li>Turn on Private listening to stop recording plays and presence.</li>
          <li>Clear cached media and data from your browser via Settings.</li>
        </ul>
      </Section>
      <Section heading="Contact">
        <p>
          For privacy questions, reach the team through the{' '}
          <Link to="/support" className="text-primary underline hover:no-underline">
            Support center
          </Link>
          .
        </p>
      </Section>
    </InfoPageLayout>
  )
}
