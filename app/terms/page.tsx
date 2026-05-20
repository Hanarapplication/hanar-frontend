import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPageFrame from '@/components/legal/LegalPageFrame';

export const metadata: Metadata = {
  title: 'Terms of Service | Hanar',
  description:
    'Terms governing use of Hanar.net — accounts, community, marketplace, messaging, acceptable use, and dispute resolution under Texas law.',
};

export default function TermsPage() {
  return (
    <LegalPageFrame
      title="Terms of Service"
      subtitle="Effective date: May 14, 2026 · These Terms form an agreement between you and Hanar regarding Hanar.net and related Hanar web services."
    >
      <section aria-labelledby="accept">
        <h2 id="accept" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Agreement to terms
        </h2>
        <p>
          By accessing or using Hanar.net and related Hanar services (collectively, the “Services”), you agree to be
          bound by these Terms of Service (“Terms”). If you do not agree, do not use the Services. You must be at least
          the age of majority in your jurisdiction to create an account, or you must have verifiable parental consent
          where required by law.
        </p>
      </section>

      <section aria-labelledby="service">
        <h2 id="service" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Description of the Services
        </h2>
        <p>Hanar provides an online platform that may include, among other features:</p>
        <ul className="list-disc list-outside pl-5 space-y-2">
          <li>Profiles and pages for individuals, businesses, and organizations.</li>
          <li>A community feed with posts, comments, media uploads, and engagement tools.</li>
          <li>Marketplace listings (for example retail items, vehicles, real estate, and peer listings).</li>
          <li>Location-aware discovery (such as nearby businesses and listings) when you choose to share location.</li>
          <li>Messaging between users and system notifications (including optional push notifications).</li>
          <li>Account settings, safety tools (such as blocking), and promotional or subscription offerings.</li>
        </ul>
        <p>
          Features may change over time. We may add, modify, or discontinue functionality with reasonable notice where
          required by law.
        </p>
      </section>

      <section aria-labelledby="accounts">
        <h2 id="accounts" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Accounts, eligibility, and security
        </h2>
        <ul className="list-disc list-outside pl-5 space-y-2">
          <li>You must provide accurate registration information and keep it up to date.</li>
          <li>You are responsible for activity under your account and for safeguarding your credentials.</li>
          <li>You may not impersonate others, create accounts to evade enforcement, or misuse another person’s identity.</li>
          <li>We may require verification for certain actions (for example payouts, business claims, or safety reviews).</li>
        </ul>
      </section>

      <section aria-labelledby="content">
        <h2 id="content" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          User content and license
        </h2>
        <p>
          You retain ownership of content you submit. You grant Hanar a worldwide, non-exclusive, royalty-free license
          to host, reproduce, modify (for formatting and display), distribute, publicly perform/display, and create
          limited technical copies of your content solely to operate, improve, promote, and secure the Services, and to
          comply with law. You represent that you have the rights needed to grant this license.
        </p>
        <p>
          You may delete certain content or your account subject to backup, legal, and integrity exceptions described
          in our{' '}
          <Link href="/privacy" className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link
            href="/delete-account"
            className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400"
          >
            account deletion
          </Link>{' '}
          page.
        </p>
      </section>

      <section aria-labelledby="conduct">
        <h2 id="conduct" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Acceptable use
        </h2>
        <p>You agree not to:</p>
        <ul className="list-disc list-outside pl-5 space-y-2">
          <li>Violate applicable law, including export, sanctions, consumer protection, and intellectual property laws.</li>
          <li>Harass, threaten, defame, discriminate against, or endanger others.</li>
          <li>Post or sell illegal goods or services, stolen property, counterfeit items, or fraudulent listings.</li>
          <li>Upload malware, scrape the Services in a way that impairs performance, or attempt unauthorized access.</li>
          <li>Circumvent security, rate limits, or moderation; or interfere with other users’ use of the Services.</li>
          <li>Use the Services to build competing databases or to spam, phish, or send unsolicited bulk messages.</li>
          <li>Misrepresent your affiliation with Hanar, another user, or a business.</li>
        </ul>
      </section>

      <section aria-labelledby="marketplace">
        <h2 id="marketplace" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Marketplace, businesses, and third parties
        </h2>
        <p>
          Listings may link to third-party checkout sites or contact flows. Transactions between buyers and sellers may
          occur outside Hanar. Hanar is not a party to those transactions unless expressly stated. You are responsible
          for taxes, permits, warranties, and legal compliance for items you sell or promote.
        </p>
      </section>

      <section aria-labelledby="moderation">
        <h2 id="moderation" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Moderation and enforcement
        </h2>
        <p>
          We may remove or restrict content, suspend or terminate accounts, throttle features, or take other enforcement
          actions when we reasonably believe it is necessary to protect users, comply with law, or enforce these Terms.
          We are not obligated to monitor all content but may do so.
        </p>
      </section>

      <section aria-labelledby="ip">
        <h2 id="ip" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Hanar intellectual property
        </h2>
        <p>
          The Services, including branding, logos, layouts, and software, are owned by Hanar or our licensors and are
          protected by intellectual property laws. Except for the limited rights expressly granted in these Terms, no
          rights are granted to you.
        </p>
      </section>

      <section aria-labelledby="dmca">
        <h2 id="dmca" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Copyright complaints (DMCA)
        </h2>
        <p>
          If you believe content on Hanar infringes your copyright, send a notice to{' '}
          <a href="mailto:support@hanar.net" className="font-medium text-rose-700 underline dark:text-rose-400">
            support@hanar.net
          </a>{' '}
          with the information required by 17 U.S.C. § 512(c)(3), including identification of the work, the allegedly
          infringing material, your contact information, a statement of good faith, and a statement under penalty of
          perjury that you are authorized to act. We may remove or disable access to material in appropriate cases and
          may terminate repeat infringers where permitted by law.
        </p>
      </section>

      <section aria-labelledby="disclaimers">
        <h2 id="disclaimers" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Disclaimers
        </h2>
        <p className="uppercase text-sm font-semibold tracking-wide text-gray-700 dark:text-[#b0b3b8]">
          THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS,
          IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE,
          AND NON-INFRINGEMENT, TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW.
        </p>
        <p className="mt-3">
          Hanar does not warrant that the Services will be uninterrupted, error-free, or free of harmful components. We
          do not endorse user content and are not responsible for third-party sites linked from the Services.
        </p>
      </section>

      <section aria-labelledby="liability">
        <h2 id="liability" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Limitation of liability
        </h2>
        <p className="uppercase text-sm font-semibold tracking-wide text-gray-700 dark:text-[#b0b3b8]">
          TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, HANAR AND ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AND
          AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE
          DAMAGES, OR ANY LOSS OF PROFITS, DATA, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATED TO YOUR
          USE OF THE SERVICES.
        </p>
        <p className="mt-3">
          TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, HANAR’S AGGREGATE LIABILITY FOR ANY CLAIM ARISING OUT OF OR
          RELATED TO THESE TERMS OR THE SERVICES WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID TO HANAR FOR THE
          SERVICES GIVING RISE TO THE CLAIM DURING THE TWELVE (12) MONTHS BEFORE THE CLAIM, OR (B) ONE HUNDRED U.S.
          DOLLARS (US $100), IF YOU HAVE NOT HAD ANY SUCH PAYMENTS.
        </p>
        <p className="mt-3 text-sm text-gray-600 dark:text-[#b0b3b8]">
          Some jurisdictions do not allow certain limitations; in those cases, our liability is limited to the maximum
          extent permitted by law.
        </p>
      </section>

      <section aria-labelledby="indemnity">
        <h2 id="indemnity" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Indemnity
        </h2>
        <p>
          To the fullest extent permitted by law, you will defend, indemnify, and hold harmless Hanar and its affiliates
          from any claims, liabilities, damages, losses, and expenses (including reasonable attorneys’ fees) arising
          out of your content, your use of the Services, or your violation of these Terms or applicable law.
        </p>
      </section>

      <section aria-labelledby="law">
        <h2 id="law" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Governing law and venue
        </h2>
        <p>
          These Terms are governed by the laws of the <span className="font-semibold">State of Texas</span>, without
          regard to conflict-of-law principles that would require the application of another jurisdiction’s laws. Subject
          to applicable federal law and mandatory consumer protections in your state of residence, you agree that
          exclusive jurisdiction and venue for any dispute arising out of or relating to these Terms or the Services
          will lie in the state and federal courts located in <span className="font-semibold">Texas</span>, and you
          waive any objection to personal jurisdiction or venue there, except where prohibited by law.
        </p>
      </section>

      <section aria-labelledby="general">
        <h2 id="general" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          General
        </h2>
        <ul className="list-disc list-outside pl-5 space-y-2">
          <li>
            <span className="font-semibold">Entire agreement</span>: These Terms and our Privacy Policy are the entire
            agreement between you and Hanar regarding the Services and supersede prior understandings on this subject.</li>
          <li>
            <span className="font-semibold">Severability</span>: If any provision is held invalid, the remainder remains
            in effect.</li>
          <li>
            <span className="font-semibold">No waiver</span>: Failure to enforce a provision is not a waiver.</li>
          <li>
            <span className="font-semibold">Assignment</span>: You may not assign these Terms without our consent; we may
            assign them in connection with a merger, acquisition, or sale of assets.</li>
        </ul>
      </section>

      <section aria-labelledby="changes-terms">
        <h2 id="changes-terms" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Changes to these Terms
        </h2>
        <p>
          We may modify these Terms from time to time. We will post the updated Terms on this page and update the
          effective date. If a change is material, we will provide additional notice where required by law. Your
          continued use after the effective date constitutes acceptance of the updated Terms.
        </p>
      </section>

      <section
        className="rounded-xl border border-gray-200 bg-gray-50/90 p-4 sm:p-5 dark:border-[#3e4042] dark:bg-[#242526]"
        aria-labelledby="related-terms"
      >
        <h2 id="related-terms" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Related
        </h2>
        <ul className="space-y-2">
          <li>
            <Link href="/privacy" className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400">
              Privacy Policy
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
