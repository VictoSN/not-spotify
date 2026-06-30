import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { IndependentSiteLink } from '@/components/common/IndependentSiteLink'

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
        not-spotify is a non-commercial academic parody inspired by familiar music-streaming
        interfaces. It was created solely as a CLOUD course assignment, technical demonstration,
        and lighthearted meme. It is not an official Spotify product and is not affiliated with,
        sponsored by, or endorsed by Spotify AB.
      </p>

      <Section heading="Development team">
        <p>
          The three primary developers of this project are <strong className="text-primary">Stanlie Lin</strong>,{' '}
          <strong className="text-primary">Marvind Meydie Lincoln</strong>, and{' '}
          <strong className="text-primary">Victoria Suwita Nanda</strong>. Together, we designed and
          implemented the application to demonstrate cloud architecture, full-stack development,
          media playback, social features, and modern interface design.
        </p>
      </Section>

      <Section heading="Academic and parody purpose">
        <p>
          This project exists for private educational evaluation and portfolio demonstration. It is
          not intended for commercial operation, public music distribution, or use as a substitute
          for a licensed streaming service. It is not a cracked or modified Spotify website, does
          not bypass subscriptions or digital-rights controls, and is not designed to provide
          unauthorized access to paid services.
        </p>
      </Section>

      <Section heading="Copyright and media notice">
        <p>
          Spotify and all other third-party names, trademarks, logos, artist identities, recordings,
          artwork, and related materials remain the property of their respective owners. The project
          team does not claim ownership of third-party material and respects the rights of creators,
          performers, publishers, and copyright holders.
        </p>
        <p>
          To the best of our knowledge, media used in this assignment was obtained lawfully through
          purchases or legitimate providers and is included only for the limited educational
          demonstration of the application. We do not intend to sell, sublicense, redistribute, or
          facilitate unauthorized downloads of copyrighted media. Anyone deploying or extending this
          project must use only content they have permission or a valid licence to use.
        </p>
        <p>
          Educational or non-commercial status does not by itself grant permission to use copyrighted
          material. Where permission or licensing is required, it must be obtained from the relevant
          rights holder.
        </p>
      </Section>

      <Section heading="Questions and takedown requests">
        <p>
          If you are a rights holder and believe material has been included in error, please visit the{' '}
          <IndependentSiteLink site="support" path="/support?topic=copyright-claims" className="text-primary underline hover:no-underline">
            copyright help article
          </IndependentSiteLink>{' '}
          to contact the team. We will review reasonable notices and remove material when appropriate.
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
          <IndependentSiteLink site="support" path="/support?topic=privacy-settings" className="text-primary underline hover:no-underline">
            privacy help article
          </IndependentSiteLink>
          .
        </p>
      </Section>
    </InfoPageLayout>
  )
}
