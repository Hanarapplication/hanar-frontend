import Link from 'next/link';
import LegalPageFrame from '@/components/legal/LegalPageFrame';

/** @type {import('next').Metadata} */
export const metadata = {
  title: 'Child Safety Standards | Hanar',
  description:
    'Hanar child safety standards: zero tolerance for CSAE and CSAM, reporting and moderation, enforcement, age requirements, and how to contact us about child safety on Hanar.net.',
  openGraph: {
    title: 'Child Safety Standards | Hanar',
    description:
      'How Hanar protects children across Community, Marketplace, Business Profiles, Messaging, and user content on Hanar.net.',
  },
};

const LAST_UPDATED = 'May 19, 2026';

const legalNav = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/child-safety', label: 'Child safety' },
  { href: '/delete-account', label: 'Delete account' },
];

const cardClassName =
  'rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm dark:border-[#3e4042] dark:bg-[#242526]';

const headingClassName = 'text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-3';

export default function ChildSafetyPage() {
  return (
    <LegalPageFrame
      title="Hanar Child Safety Standards"
      navItems={legalNav}
      subtitle={
        <>
          <p>
            Hanar is committed to protecting children and preventing child sexual abuse and exploitation (CSAE)
            across all platform areas including Community, Marketplace, Business Profiles, Messaging, and User Content.
          </p>
          <p className="text-sm text-gray-500 dark:text-[#8a8d91]">Last updated: {LAST_UPDATED}</p>
        </>
      }
    >
      <p className="rounded-xl border border-rose-100 bg-rose-50/80 px-4 py-3 text-sm sm:text-[15px] text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100">
        If you believe a child is in immediate danger, contact your local emergency services first. For suspected child
        sexual abuse material (CSAM) or exploitation on Hanar, report it in the app and email{' '}
        <a
          href="mailto:support@hanar.net?subject=Child%20safety%20report"
          className="font-semibold underline underline-offset-2"
        >
          support@hanar.net
        </a>{' '}
        with the subject line &ldquo;Child safety report.&rdquo;
      </p>

      <section
        id="zero-tolerance"
        aria-labelledby="zero-tolerance-heading"
        className={cardClassName}
      >
        <h2 id="zero-tolerance-heading" className={headingClassName}>
          1. Zero tolerance policy
        </h2>
        <div className="space-y-3">
          <p>
            Hanar has zero tolerance for child sexual abuse material (CSAM), grooming, sexual exploitation of minors,
            predatory behavior, and any illegal content involving minors. Such conduct is prohibited on Hanar.net and in
            any Hanar mobile or progressive web app (PWA) experience.
          </p>
          <p className="font-medium text-gray-900 dark:text-white">The following are strictly prohibited:</p>
          <ul className="list-disc list-outside pl-5 space-y-2">
            <li>Uploading, sharing, soliciting, or linking to CSAM or content that sexualizes minors.</li>
            <li>Grooming, enticement, or attempts to obtain sexual content from anyone you believe is a minor.</li>
            <li>Sexual exploitation, trafficking, or coercion involving minors.</li>
            <li>Predatory conduct in profiles, community posts, comments, marketplace listings, business pages, or messages.</li>
            <li>Using Hanar to arrange offline contact with minors for abusive or sexual purposes.</li>
            <li>Impersonating a minor or misrepresenting age to interact with minors inappropriately.</li>
            <li>Any other activity that violates applicable child protection laws.</li>
          </ul>
          <p>
            Violations may result in immediate content removal, account termination, preservation of evidence as required
            by law, and referral to law enforcement or relevant hotlines.
          </p>
        </div>
      </section>

      <section id="reporting" aria-labelledby="reporting-heading" className={cardClassName}>
        <h2 id="reporting-heading" className={headingClassName}>
          2. Reporting and moderation
        </h2>
        <div className="space-y-3">
          <p>
            Users can help keep Hanar safe by reporting content and behavior that may harm children or violate these
            standards.
          </p>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white pt-1">How to report in the app</h3>
          <ul className="list-disc list-outside pl-5 space-y-2">
            <li>
              <strong>Community posts and comments:</strong> use the report option on the post or comment (flag icon or
              report control).
            </li>
            <li>
              <strong>Marketplace listings:</strong> report the listing; on item pages you may also report the seller
              (individual or business).
            </li>
            <li>
              <strong>Business and organization profiles:</strong> use the report option on the profile page.
            </li>
            <li>
              <strong>Messages:</strong> report a conversation from the messages inbox actions menu, or block the user
              from account settings or conversation controls.
            </li>
            <li>
              <strong>User profiles:</strong> report via available profile or content controls where reporting is offered.
            </li>
          </ul>
          <p>
            When reporting, choose the reason that best describes the issue (for example &ldquo;Inappropriate
            content&rdquo;) and add details such as usernames, links, and why you believe a child may be at risk.
            Logged-in users can submit reports through our reporting system; reports are stored for review by Hanar staff.
          </p>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white pt-1">Review process</h3>
          <ul className="list-disc list-outside pl-5 space-y-2">
            <li>Reports are reviewed by Hanar moderation and safety personnel.</li>
            <li>Priority is given to reports involving potential harm to minors or suspected CSAM.</li>
            <li>Violating content may be removed or restricted without prior notice.</li>
            <li>Accounts may be suspended temporarily or permanently banned for serious or repeat violations.</li>
            <li>We may restrict features (posting, messaging, listings) while an investigation is pending.</li>
          </ul>
          <p>
            You may also email{' '}
            <a
              href="mailto:support@hanar.net"
              className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400"
            >
              support@hanar.net
            </a>{' '}
            if you cannot access in-app reporting or need to escalate an urgent child safety matter.
          </p>
        </div>
      </section>

      <section id="enforcement" aria-labelledby="enforcement-heading" className={cardClassName}>
        <h2 id="enforcement-heading" className={headingClassName}>
          3. Enforcement
        </h2>
        <ul className="list-disc list-outside pl-5 space-y-2">
          <li>
            <strong>Immediate removal:</strong> We act promptly to remove or disable access to content that violates
            these standards, including CSAM and exploitative material.
          </li>
          <li>
            <strong>Account actions:</strong> We may suspend or permanently terminate accounts and related business or
            organization profiles tied to violations.
          </li>
          <li>
            <strong>Legal cooperation:</strong> We cooperate with applicable legal requirements, including valid law
            enforcement requests and mandatory reporting obligations where we are required or permitted to report
            suspected CSAM to authorities (for example, reports to the U.S. National Center for Missing &amp; Exploited
            Children (NCMEC) where applicable).
          </li>
          <li>
            <strong>Escalation:</strong> Serious cases are escalated to senior staff. We preserve relevant records as
            required by law and our{' '}
            <Link href="/privacy" className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400">
              Privacy Policy
            </Link>
            .
          </li>
          <li>
            <strong>Repeat and evasion:</strong> Creating new accounts to evade enforcement is prohibited and may lead to
            additional restrictions.
          </li>
        </ul>
      </section>

      <section id="age" aria-labelledby="age-heading" className={cardClassName}>
        <h2 id="age-heading" className={headingClassName}>
          4. Age requirements
        </h2>
        <div className="space-y-3">
          <p>
            Hanar is not directed to children under 13. Users must satisfy the minimum age required to use online
            services in their country or region (for example, 13 in the United States under COPPA, or higher where local
            law requires).
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2">
            <li>
              By creating an account, you represent that you meet applicable minimum age requirements or have verifiable
              parental consent where required.
            </li>
            <li>
              We do not knowingly collect personal information from children under 13 in violation of applicable law, as
              described in our{' '}
              <Link href="/privacy" className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400">
                Privacy Policy
              </Link>
              .
            </li>
            <li>
              If we learn that an account was created by someone under the applicable minimum age without proper consent,
              we may delete the account and associated data subject to legal and safety exceptions.
            </li>
            <li>
              Parents and guardians who believe a minor has provided information to Hanar should contact{' '}
              <a
                href="mailto:support@hanar.net"
                className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400"
              >
                support@hanar.net
              </a>
              .
            </li>
          </ul>
          <p>
            Additional protections may apply for younger users where required by law or platform policies (for example,
            limiting certain features or data uses).
          </p>
        </div>
      </section>

      <section id="prevention" aria-labelledby="prevention-heading" className={cardClassName}>
        <h2 id="prevention-heading" className={headingClassName}>
          5. Prevention and platform safeguards
        </h2>
        <div className="space-y-3">
          <p>We use a combination of technical and human measures designed to reduce CSAE risk on Hanar, including:</p>
          <ul className="list-disc list-outside pl-5 space-y-2">
            <li>User reporting tools across major surfaces (community, marketplace, profiles, messaging).</li>
            <li>Administrative moderation queues for reported posts, comments, listings, and user reports.</li>
            <li>Ability for users to block other users and limit unwanted contact.</li>
            <li>Rate limiting, abuse prevention, and security logging to detect suspicious activity.</li>
            <li>Terms of Service and acceptable use rules that prohibit harmful and illegal conduct.</li>
            <li>Review of high-risk reports and escalation paths for child safety issues.</li>
          </ul>
          <p>
            We continue to improve our safety systems as Hanar evolves. No system is perfect; we rely on community reports
            and cooperation with users and authorities to identify harm.
          </p>
        </div>
      </section>

      <section id="messaging-media" aria-labelledby="messaging-media-heading" className={cardClassName}>
        <h2 id="messaging-media-heading" className={headingClassName}>
          6. Messaging, media, and user-generated content
        </h2>
        <div className="space-y-3">
          <p>
            Hanar allows users to post text, photos, and videos in community and marketplace contexts, and to exchange
            direct messages. Users must not use these features to target, groom, or exploit minors.
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2">
            <li>Do not request intimate images or personal contact information from minors.</li>
            <li>Do not share CSAM or sexualized depictions of minors in any format.</li>
            <li>Do not use listings, business pages, or organizations as a cover for exploitation or trafficking.</li>
            <li>
              If you receive unsolicited harmful content in messages, report the chat and block the sender; do not
              redistribute illegal material.
            </li>
          </ul>
        </div>
      </section>

      <section id="app-stores" aria-labelledby="app-stores-heading" className={cardClassName}>
        <h2 id="app-stores-heading" className={headingClassName}>
          7. Google Play and Apple App Store
        </h2>
        <div className="space-y-3">
          <p>
            Hanar mobile applications distributed through the Google Play Store and Apple App Store must comply with each
            store&apos;s child safety and user-generated content policies. This page satisfies our published child safety
            standards for those programs.
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2">
            <li>
              <strong>Google Play:</strong> We maintain publicly available standards against CSAE and provide this URL in
              Play Console as required for apps with user-generated content or social features.
            </li>
            <li>
              <strong>Apple App Store:</strong> We address child safety, reporting, and age-appropriate use in line with
              App Review Guidelines for user-generated content and protection of minors.
            </li>
          </ul>
          <p>
            Store ratings and parental controls on devices may provide additional limits; Hanar encourages guardians to
            supervise minors&apos; online activity.
          </p>
        </div>
      </section>

      <section id="contact" aria-labelledby="contact-heading" className={cardClassName}>
        <h2 id="contact-heading" className={headingClassName}>
          8. Contact
        </h2>
        <div className="space-y-3">
          <p>For child safety questions, reports, or law enforcement inquiries related to Hanar:</p>
          <div className="rounded-lg border border-gray-200 bg-gray-50/90 px-4 py-3 dark:border-[#3e4042] dark:bg-[#1c1e21]">
            <p className="mb-1">
              <span className="font-medium text-gray-900 dark:text-white">Email: </span>
              <a
                href="mailto:support@hanar.net"
                className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400"
              >
                support@hanar.net
              </a>
            </p>
            <p className="text-sm text-gray-600 dark:text-[#b0b3b8]">
              Include relevant URLs, usernames, listing or post identifiers, and a clear description. For suspected CSAM,
              use subject line &ldquo;Child safety report&rdquo; and do not attach illegal images.
            </p>
          </div>
        </div>
      </section>

      <section
        className="rounded-xl border border-gray-200 bg-gray-50/90 p-4 sm:p-5 dark:border-[#3e4042] dark:bg-[#242526]"
        aria-labelledby="related"
      >
        <h2 id="related" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Related policies
        </h2>
        <ul className="space-y-2">
          <li>
            <Link href="/terms" className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400">
              Terms of Service
            </Link>
            <span className="text-gray-600 dark:text-[#b0b3b8]"> — acceptable use and moderation</span>
          </li>
          <li>
            <Link href="/privacy" className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400">
              Privacy Policy
            </Link>
            <span className="text-gray-600 dark:text-[#b0b3b8]"> — children&apos;s privacy and data practices</span>
          </li>
          <li>
            <Link
              href="/delete-account"
              className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400"
            >
              Delete account
            </Link>
          </li>
          <li>
            <Link href="/contact" className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400">
              Contact
            </Link>
          </li>
        </ul>
      </section>

      <footer className="text-sm text-gray-500 dark:text-[#8a8d91] pt-2" aria-label="Document version">
        <p>Last updated: {LAST_UPDATED}</p>
      </footer>
    </LegalPageFrame>
  );
}
