import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPageFrame from '@/components/legal/LegalPageFrame';

export const metadata: Metadata = {
  title: 'Privacy Policy | Hanar',
  description:
    'How Hanar collects, uses, and shares personal information for Hanar.net — including community, marketplace, messaging, and location features.',
};

export default function PrivacyPage() {
  return (
    <LegalPageFrame
      title="Privacy Policy"
      subtitle={
        <>
          <p>
            Effective date: May 14, 2026 · Applies to Hanar.net and related Hanar web experiences in the United States.
          </p>
          <p className="text-sm text-gray-500 dark:text-[#8a8d91]">Last updated: May 14, 2026</p>
        </>
      }
    >
      <section aria-labelledby="intro">
        <h2 id="intro" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Introduction
        </h2>
        <p>
          Hanar (“Hanar,” “we,” “us,” or “our”) operates Hanar.net, a platform that connects immigrant-owned businesses,
          organizations, and individuals with local marketplace listings, a community feed, messaging, and related
          tools. This Privacy Policy describes how we collect, use, disclose, and protect personal information when you
          use our services.
        </p>
        <p>
          By using Hanar, you agree to this Privacy Policy. If you do not agree, please do not use the services.
        </p>
      </section>

      <section aria-labelledby="collect">
        <h2 id="collect" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Information we collect
        </h2>
        <p>Depending on how you use Hanar, we may collect the following categories of information:</p>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4">Account and profile</h3>
        <ul className="list-disc list-outside pl-5 space-y-2">
          <li>Name, username, email address, phone number (if you provide it), and account credentials.</li>
          <li>Profile details you choose to add (for example, profile photo, bio, languages spoken, audience or
            preference fields used to personalize content).</li>
          <li>Business, organization, or individual account attributes you submit when creating or managing listings.</li>
        </ul>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4">Content you create</h3>
        <ul className="list-disc list-outside pl-5 space-y-2">
          <li>Community posts, comments, reactions, and media you upload (including photos and videos, subject to our
            technical limits).</li>
          <li>Marketplace listings (retail, vehicles, real estate, and other item types), descriptions, pricing, and
            images.</li>
          <li>Business listings, logos, addresses, and other storefront information you publish.</li>
          <li>Messages you send through Hanar messaging features.</li>
        </ul>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4">Location and local results</h3>
        <ul className="list-disc list-outside pl-5 space-y-2">
          <li>
            Approximate location derived from coordinates you save or device/browser location when you choose “use my
            location,” plus city or region labels we derive through our geocoding services.</li>
          <li>
            Address search and autocomplete queries you enter when picking a location (processed to show nearby
            businesses and marketplace results).</li>
        </ul>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4">Device, technical, and usage data</h3>
        <ul className="list-disc list-outside pl-5 space-y-2">
          <li>IP address, browser type, device identifiers, app/PWA identifiers, and general usage signals.</li>
          <li>Diagnostics and security-related logs (for example, rate limiting, abuse prevention, and error reporting).</li>
          <li>Local storage or similar on-device storage for preferences such as language, dark mode, and cached feed
            data to improve performance.</li>
        </ul>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4">Communications and notifications</h3>
        <ul className="list-disc list-outside pl-5 space-y-2">
          <li>Push notification tokens and related device data when you opt in to web or native push (for example,
            through Firebase Cloud Messaging).</li>
          <li>Records of support requests or emails you send to us.</li>
        </ul>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4">Payments and promotions</h3>
        <ul className="list-disc list-outside pl-5 space-y-2">
          <li>
            When you purchase paid plans or promotional features, our payment processor (for example, Stripe) collects
            and processes billing and payment details on their systems.{' '}
            <span className="font-semibold">Hanar does not store your full payment card number on our servers.</span> We
            may receive limited transaction metadata (such as the last four digits of a card, payment status, and
            subscription or invoice identifiers) needed to provide and support the service.
          </li>
        </ul>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4">Safety and integrity</h3>
        <ul className="list-disc list-outside pl-5 space-y-2">
          <li>Block lists, reports, moderation decisions, and related records used to enforce our Terms and protect
            users.</li>
        </ul>
      </section>

      <section aria-labelledby="sources">
        <h2 id="sources" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          How we collect information
        </h2>
        <ul className="list-disc list-outside pl-5 space-y-2">
          <li>Directly from you when you register, complete forms, post content, send messages, or contact support.</li>
          <li>Automatically through cookies, local storage, server logs, and similar technologies when you use the site.</li>
          <li>From integrated service providers that help us operate the platform (described below).</li>
        </ul>
      </section>

      <section aria-labelledby="use">
        <h2 id="use" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          How we use information
        </h2>
        <p>We use personal information to:</p>
        <ul className="list-disc list-outside pl-5 space-y-2">
          <li>Provide, maintain, and improve Hanar features (feeds, search, distance-based ranking, and recommendations).</li>
          <li>Authenticate you, secure accounts, detect fraud, and enforce our policies.</li>
          <li>Send service-related messages, optional marketing where permitted, and push notifications you enable.</li>
          <li>Process payments and fulfill purchases of plans or promotions.</li>
          <li>Comply with law, respond to lawful requests, and protect rights, safety, and property.</li>
          <li>Generate aggregated or de-identified analytics that do not identify you.</li>
        </ul>
      </section>

      <section aria-labelledby="sharing">
        <h2 id="sharing" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          How we share information
        </h2>
        <p>We may share personal information with:</p>
        <ul className="list-disc list-outside pl-5 space-y-2">
          <li>
            <span className="font-semibold">Service providers</span> who host data, deliver infrastructure, or perform
            functions on our behalf—for example database and authentication (Supabase), cloud hosting, payment
            processing (Stripe), push delivery (Google Firebase / FCM), and mapping or places services (Google Maps /
            Places) where those features are enabled.</li>
          <li>
            <span className="font-semibold">Geocoding</span>: location labels may be resolved using third-party
            geocoders such as OpenStreetMap Nominatim through our server-side API routes.</li>
          <li>
            <span className="font-semibold">Other users</span> as needed to operate a public or semi-public network—for
            example displaying your profile, posts, listings, and messages to recipients you choose.</li>
          <li>
            <span className="font-semibold">Legal and safety</span>: regulators, law enforcement, or others when required
            by law or reasonably necessary to protect Hanar, our users, or the public.</li>
          <li>
            <span className="font-semibold">Business transfers</span>: a successor in connection with a merger,
            acquisition, financing, or sale of assets, subject to appropriate confidentiality and use restrictions.</li>
        </ul>
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-gray-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-[#e4e6eb]">
          <span className="font-semibold">We do not sell your personal information for money</span> as that term is
          commonly understood. Where state laws characterize certain advertising or analytics disclosures as “sharing”
          or “sales,” you may have opt-out rights as described below.
        </p>
      </section>

      <section aria-labelledby="retention">
        <h2 id="retention" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Retention
        </h2>
        <p>
          We keep personal information only as long as needed for the purposes described in this policy, unless a
          longer period is required or permitted by law (for example, tax, fraud prevention, or litigation hold).
        </p>
        <p>
          Account deletion requests are generally processed within 30 days. Some records may be retained where required
          or permitted by law, including payment/order records, fraud prevention logs, moderation records, legal
          compliance records, and backup archives. Backup copies may remain for up to 90 days before being deleted or
          overwritten.
        </p>
        <p>
          When you delete your account, we work to delete or de-identify personal data consistent with our{' '}
          <Link href="/delete-account" className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400">
            account deletion
          </Link>{' '}
          page. You can start in-app deletion from{' '}
          <Link href="/settings" className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400">
            Settings
          </Link>{' '}
          while signed in. Our{' '}
          <Link href="/terms" className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400">
            Terms of Service
          </Link>{' '}
          describe account rules and enforcement.
        </p>
      </section>

      <section aria-labelledby="security">
        <h2 id="security" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Security
        </h2>
        <p>
          We use administrative, technical, and organizational measures designed to protect personal information. No
          method of transmission or storage is 100% secure; you use Hanar at your own risk to that extent.
        </p>
      </section>

      <section aria-labelledby="children">
        <h2 id="children" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Children
        </h2>
        <p>
          Hanar is not directed to children under 13, and we do not knowingly collect personal information from children
          under 13 in a manner that violates the U.S. Children’s Online Privacy Protection Act (COPPA). If you believe we
          have collected information from a child under 13, contact us and we will take appropriate steps.
        </p>
      </section>

      <section aria-labelledby="rights">
        <h2 id="rights" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Your privacy rights (United States)
        </h2>
        <p>
          Depending on where you live, you may have rights to access, correct, delete, or obtain a copy of certain
          personal information, and to opt out of certain processing. Laws vary by state.
        </p>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4">Texas residents</h3>
        <p>
          If you are a Texas resident, you may have privacy rights under the Texas Data Privacy and Security Act (TDPSA)
          and other Texas consumer protection laws when those laws apply to our processing. Those rights can include
          access, correction, deletion, portability (where applicable), and opting out of certain uses of sensitive or
          profiling data, subject to exceptions. To exercise rights, email{' '}
          <a href="mailto:support@hanar.net" className="font-medium text-rose-700 underline dark:text-rose-400">
            support@hanar.net
          </a>{' '}
          with a description of your request. We may need to verify your identity before responding.
        </p>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4">California residents</h3>
        <p>
          California residents may have additional rights under the California Consumer Privacy Act (CCPA) as amended by
          the California Privacy Rights Act (CPRA), including rights to know, delete, correct, and opt out of certain
          “sharing” or “sales” of personal information. We do not knowingly “sell” personal information of minors under
          16. You may designate an authorized agent where permitted by law.
        </p>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4">Other U.S. states</h3>
        <p>
          Several other states have enacted consumer privacy laws with varying scopes. If a law applies to our
          processing of your information, we will honor applicable requests in line with that law.
        </p>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4">Appeals</h3>
        <p>
          Where required, you may appeal our response to a privacy request by contacting us at the same support address
          and describing your concern.
        </p>
      </section>

      <section aria-labelledby="cookies">
        <h2 id="cookies" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Cookies and similar technologies
        </h2>
        <p>
          We use cookies, local storage, and similar technologies for authentication, preferences, performance, analytics,
          and security. You can control some technologies through your browser settings; blocking cookies may limit
          certain features (for example staying signed in).
        </p>
      </section>

      <section aria-labelledby="international">
        <h2 id="international" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          International users
        </h2>
        <p>
          Hanar is operated in the United States. If you access Hanar from outside the United States, you understand
          that your information may be transferred to, stored, and processed in the United States and other jurisdictions
          where our service providers operate.
        </p>
      </section>

      <section aria-labelledby="changes">
        <h2 id="changes" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Changes to this policy
        </h2>
        <p>
          We may update this Privacy Policy from time to time. We will post the updated version on this page and adjust
          the effective date. Where required by law, we will provide additional notice.
        </p>
      </section>

      <section
        className="rounded-xl border border-gray-200 bg-gray-50/90 p-4 sm:p-5 dark:border-[#3e4042] dark:bg-[#242526]"
        aria-labelledby="related-links"
      >
        <h2 id="related-links" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Related
        </h2>
        <ul className="space-y-2">
          <li>
            <Link href="/terms" className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400">
              Terms of Service
            </Link>
          </li>
          <li>
            <Link
              href="/child-safety"
              className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400"
            >
              Child Safety Standards
            </Link>
          </li>
          <li>
            <Link
              href="/delete-account"
              className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400"
            >
              Delete your account
            </Link>
          </li>
          <li>
            <Link href="/settings" className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400">
              Settings
            </Link>
          </li>
        </ul>
      </section>
    </LegalPageFrame>
  );
}
